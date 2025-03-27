const express = require('express');
const axios = require('axios');
const { db } = require('../../handlers/db.js');
const { logAudit } = require('../../handlers/auditlog');
const { v4: uuid } = require('uuid');

const router = express.Router();

/**
 * Middleware to verify if the user is an administrator.
 */
function isAdmin(req, res, next) {
    if (!req.user || req.user.admin !== true) {
        return res.redirect('../');
    }
    next();
}

/**
 * GET /instances/redeploy/:id
 * Handles the redeployment of an existing instance.
 */
router.get('/instances/redeploy/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    if (!id) return res.redirect('/admin/instances');

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return res.redirect('/admin/instances');

        const nodeId = instance.Node?.id;
        const { image, memory, cpu, ports, name, user, primary } = req.query;

        if (!image || !memory || !cpu || !ports || !nodeId || !name || !user || !primary) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const shortimageMatch = image.match(/\(([^)]+)\)/);
        const shortimage = shortimageMatch ? shortimageMatch[1] : null;
        if (!shortimage) return res.status(400).json({ error: 'Invalid image format' });

        const node = await db.get(`${nodeId}_node`);
        if (!node) return res.status(400).json({ error: 'Invalid node' });

        const requestData = await prepareRequestData(shortimage, memory, cpu, ports, name, node, id, instance.ContainerId, instance.Env);
        const response = await axios(requestData);

        await updateDatabaseWithNewInstance(response.data, user, node, shortimage, memory, cpu, ports, primary, name, id, instance.Env, instance.imageData);

        logAudit(req.user.userId, req.user.username, 'instance:redeploy', req.ip);
        res.status(201).json({
            message: 'Container redeployed successfully and updated in user\'s servers',
            containerId: response.data.containerId,
            volumeId: response.data.volumeId
        });
    } catch (error) {
        console.error('[Delhi Panel] Error redeploying instance:', error);
        res.status(500).json({
            error: 'Failed to redeploy container',
            details: error.response ? error.response.data : 'No additional error info'
        });
    }
});

async function prepareRequestData(image, memory, cpu, ports, name, node, id, containerId, Env) {
    const rawImages = await db.get('images');
    const imageData = rawImages.find(i => i.Image === image);

    const requestData = {
        method: 'post',
        url: `http://${node.address}:${node.port}/instances/redeploy/${containerId}`,
        auth: {
            username: 'DelhiPanel',
            password: node.apiKey
        },
        headers: { 'Content-Type': 'application/json' },
        data: {
            Name: name,
            Id: id,
            Image: image,
            Env,
            Scripts: imageData ? imageData.Scripts : undefined,
            Memory: parseInt(memory),
            Cpu: parseInt(cpu),
            ExposedPorts: {},
            PortBindings: {},
            AltImages: imageData ? imageData.AltImages : []
        }
    };

    if (ports) {
        ports.split(',').forEach(portMapping => {
            const [containerPort, hostPort] = portMapping.split(':');
            const key = `${containerPort}/tcp`;
            requestData.data.ExposedPorts[key] = {};
            requestData.data.PortBindings[key] = [{ HostPort: hostPort }];
        });
    }
    return requestData;
}

async function updateDatabaseWithNewInstance(responseData, userId, node, image, memory, cpu, ports, primary, name, id, Env, imageData) {
    const rawImages = await db.get('images');
    const updatedImageData = rawImages.find(i => i.Image === image);
    const altImages = updatedImageData ? updatedImageData.AltImages : [];

    const instanceData = {
        Name: name,
        Id: id,
        Node: node,
        User: userId,
        ContainerId: responseData.containerId,
        VolumeId: id,
        Memory: parseInt(memory),
        Cpu: parseInt(cpu),
        Ports: ports,
        Primary: primary,
        Env,
        Image: image,
        AltImages: altImages,
        imageData
    };

    let userInstances = await db.get(`${userId}_instances`) || [];
    userInstances = userInstances.filter(instance => instance.Id !== id);
    userInstances.push(instanceData);
    await db.set(`${userId}_instances`, userInstances);

    let globalInstances = await db.get('instances') || [];
    globalInstances = globalInstances.filter(instance => instance.Id !== id);
    globalInstances.push(instanceData);
    await db.set('instances', globalInstances);

    await db.set(`${id}_instance`, instanceData);
}

module.exports = router;
                                                     
