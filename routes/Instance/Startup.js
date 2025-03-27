const express = require('express');
const axios = require('axios');
const { db } = require('../../handlers/db.js');
const { logAudit } = require('../../handlers/auditlog');
const { v4: uuid } = require('uuid');
const { loadPlugins } = require('../../plugins/loadPls.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');
const path = require('path');

const plugins = loadPlugins(path.join(__dirname, '../../plugins'));
const router = express.Router();
const allPluginData = Object.values(plugins).map(plugin => plugin.config);

/**
 * GET /instance/:id/startup
 * Renders the instance startup page with available alternative images.
 */
router.get('/instance/:id/startup', async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    if (!id) return res.redirect('/instances');

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return res.redirect('../../instances');

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) return res.status(403).send('Unauthorized access.');

        if (instance.suspended) return res.redirect(`../../instance/${id}/suspended`);

        res.render('instance/startup.ejs', {
            req,
            user: req.user,
            name: await db.get('name') || 'Delhi Panel',
            logo: await db.get('logo') || false,
            instance,
            addons: { plugins: allPluginData }
        });
    } catch (error) {
        console.error('[Delhi Panel] Error fetching instance:', error);
        res.status(500).json({ error: 'Failed to load instance data', details: error.message });
    }
});

/**
 * POST /instances/startup/changevariable/:id
 * Modifies an instance's environment variable.
 */
router.post('/instances/startup/changevariable/:id', async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    const { variable, value, user } = req.query;

    if (!id || !variable || !user) return res.status(400).json({ error: 'Missing parameters' });

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return res.status(404).json({ error: 'Instance not found' });

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) return res.status(403).send('Unauthorized access.');

        if (instance.suspended) return res.redirect(`../../instance/${id}/suspended`);

        instance.Env = instance.Env.map(envVar => {
            const [key] = envVar.split('=');
            return key === variable ? `${key}=${value}` : envVar;
        });

        await db.set(`${id}_instance`, instance);
        logAudit(req.user.userId, req.user.username, 'instance:variableChange', req.ip);
        res.json({ success: true });

    } catch (error) {
        console.error('[Delhi Panel] Error updating variable:', error);
        res.status(500).json({ error: 'Failed to update environment variable', details: error.message });
    }
});

/**
 * GET /instances/startup/changeimage/:id
 * Updates the instance image.
 */
router.get('/instances/startup/changeimage/:id', async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    if (!id) return res.redirect('/instances');

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return res.redirect('/instances');

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) return res.status(403).send('Unauthorized access.');

        if (instance.suspended) return res.redirect(`../../instance/${id}/suspended`);

        const nodeId = instance.Node.id;
        const { image, user } = req.query;
        if (!image || !user || !nodeId) return res.status(400).json({ error: 'Missing parameters' });

        const node = await db.get(`${nodeId}_node`);
        if (!node) return res.status(400).json({ error: 'Invalid node' });

        const requestData = await prepareRequestData(image, instance, node);
        const response = await axios(requestData);

        await updateDatabaseWithNewInstance(response.data, user, node, instance, image);
        logAudit(req.user.userId, req.user.username, 'instance:imageChange', req.ip);

        res.status(201).redirect(`/instance/${id}/startup`);
    } catch (error) {
        console.error('[Delhi Panel] Error changing instance image:', error);
        res.status(500).json({ error: 'Failed to change container image', details: error.response?.data || 'No additional info' });
    }
});

async function prepareRequestData(image, instance, node) {
    const rawImages = await db.get('images');
    const imageData = rawImages.find(i => i.Image === image) || {};

    const requestData = {
        method: 'post',
        url: `http://${node.address}:${node.port}/instances/redeploy/${instance.ContainerId}`,
        auth: { username: 'Skyport', password: node.apiKey },
        headers: { 'Content-Type': 'application/json' },
        data: {
            Name: instance.Name,
            Id: instance.Id,
            Image: image,
            Env: instance.Env,
            Scripts: imageData.Scripts,
            Memory: instance.Memory ? parseInt(instance.Memory) : undefined,
            Cpu: instance.Cpu ? parseInt(instance.Cpu) : undefined,
            ExposedPorts: {},
            PortBindings: {},
            AltImages: imageData.AltImages || []
        }
    };

    if (instance.Ports) {
        instance.Ports.split(',').forEach(portMapping => {
            const [containerPort, hostPort] = portMapping.split(':');
            const key = `${containerPort}/tcp`;
            requestData.data.ExposedPorts[key] = {};
            requestData.data.PortBindings[key] = [{ HostPort: hostPort }];
        });
    }

    return requestData;
}

async function updateDatabaseWithNewInstance(responseData, userId, node, instance, newImage) {
    const rawImages = await db.get('images');
    const imageData = rawImages.find(i => i.Image === newImage) || {};
    
    const updatedInstance = {
        ...instance,
        ContainerId: responseData.containerId,
        Image: newImage,
        AltImages: imageData.AltImages || [],
        imageData: instance.imageData
    };

    let userInstances = await db.get(`${userId}_instances`) || [];
    userInstances = userInstances.filter(i => i.Id !== instance.Id);
    userInstances.push(updatedInstance);
    await db.set(`${userId}_instances`, userInstances);

    let globalInstances = await db.get('instances') || [];
    globalInstances = globalInstances.filter(i => i.Id !== instance.Id);
    globalInstances.push(updatedInstance);
    await db.set('instances', globalInstances);

    await db.set(`${instance.Id}_instance`, updatedInstance);
}

module.exports = router;
