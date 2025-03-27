const express = require('express');
const router = express.Router();
const axios = require('axios');
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');
const { loadPlugins } = require('../../plugins/loadPls.js');
const path = require('path');

const plugins = loadPlugins(path.join(__dirname, '../../plugins'));

/**
 * GET /instance/:id/archives
 * Lists all archives for a specific instance and renders them on an EJS page.
 */
router.get("/instance/:id/archives", async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    if (!id) return res.redirect('/instances');

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance || !instance.ContainerId) return res.redirect('/instances');

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

        if (instance.Node && instance.Node.address && instance.Node.port) {
            try {
                const response = await axios.get(`http://${instance.Node.address}:${instance.Node.port}/archive/${instance.ContainerId}/archives`, {
                    auth: { username: 'Skyport', password: instance.Node.apiKey },
                    headers: { 'Content-Type': 'application/json' }
                });

                const archives = response.data.archives || [];
                const allPluginData = Object.values(plugins).map(plugin => plugin.config);
                const settings = await db.get('settings');

                res.render('instance/archives', { 
                    req, 
                    user: req.user, 
                    instance,
                    name: await db.get('name') || 'Delhi Panel',
                    logo: await db.get('logo') || false, 
                    archives, 
                    settings,
                    addons: { plugins: allPluginData }
                });
            } catch (error) {
                console.error('Error fetching archives from node:', error.message);
                res.status(500).send({ message: 'Connection to node failed.' });
            }
        } else {
            res.status(500).send('Invalid instance node configuration');
        }
    } catch (err) {
        console.error('Error fetching instance or settings:', err);
        res.status(500).send('Server error');
    }
});

/**
 * POST /instance/:id/archives/create
 * Creates a new archive for the specified instance.
 */
router.post('/instance/:id/archives/create', async (req, res) => {
    const { id } = req.params;
    if (!req.user) return res.redirect('/');

    const instance = await db.get(`${id}_instance`);
    if (!instance || !instance.ContainerId) return res.redirect('/instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

    try {
        const response = await axios.post(`http://${instance.Node.address}:${instance.Node.port}/archive/${instance.ContainerId}/archives/${instance.VolumeId}/create`, {}, {
            auth: { username: 'Skyport', password: instance.Node.apiKey },
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 200) {
            res.redirect(`/instance/${id}/archives`);
        } else {
            res.status(500).send('Failed to create archive');
        }
    } catch (error) {
        console.error('Error creating archive:', error.message);
        res.status(500).send('Failed to create archive');
    }
});

/**
 * POST /instance/:id/archives/delete/:archivename
 * Deletes an archive from the instance.
 */
router.post('/instance/:id/archives/delete/:archivename', async (req, res) => {
    const { id, archivename } = req.params;
    if (!req.user) return res.redirect('/');

    const instance = await db.get(`${id}_instance`);
    if (!instance || !instance.ContainerId) return res.redirect('/instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

    try {
        const response = await axios.post(`http://${instance.Node.address}:${instance.Node.port}/archive/${instance.ContainerId}/archives/delete/${archivename}`, {}, {
            auth: { username: 'Skyport', password: instance.Node.apiKey },
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 200) {
            res.redirect(`/instance/${id}/archives`);
        } else {
            res.status(500).send('Failed to delete archive');
        }
    } catch (error) {
        console.error('Error deleting archive:', error.message);
        res.status(500).send('Failed to delete archive');
    }
});

/**
 * POST /instance/:id/archives/rollback/:archivename
 * Rolls back the instance to a specific archive.
 */
router.post('/instance/:id/archives/rollback/:archivename', async (req, res) => {
    const { id, archivename } = req.params;
    if (!req.user) return res.redirect('/');

    const instance = await db.get(`${id}_instance`);
    if (!instance || !instance.ContainerId) return res.redirect('/instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

    try {
        const response = await axios.post(`http://${instance.Node.address}:${instance.Node.port}/archive/${instance.ContainerId}/archives/rollback/${instance.VolumeId}/${archivename}`, {}, {
            auth: { username: 'Skyport', password: instance.Node.apiKey },
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 200) {
            res.redirect(`/instance/${id}/archives`);
        } else {
            res.status(500).send('Failed to rollback archive');
        }
    } catch (error) {
        console.error('Error rolling back archive:', error.message);
        res.status(500).send('Failed to rollback archive');
    }
});

module.exports = router;
            
