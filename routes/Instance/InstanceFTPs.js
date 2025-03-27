const express = require('express');
const router = express.Router();
const axios = require('axios');
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');
const { loadPlugins } = require('../../plugins/loadPls.js');
const path = require('path');

const plugins = loadPlugins(path.join(__dirname, '../../plugins'));

router.get("/instance/:id/ftp", async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    if (!id) return res.redirect('../../../../instances');

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance || !instance.VolumeId) return res.redirect('../../../../instances');

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

        if (!instance.suspended) {
            instance.suspended = false;
            await db.set(`${id}_instance`, instance);
        }

        if (instance.suspended === true) {
            return res.redirect(`../../instance/${id}/suspended`);
        }

        if (instance.Node?.address && instance.Node?.port) {
            const requestData = {
                method: 'get',
                url: `http://${instance.Node.address}:${instance.Node.port}/ftp/info/${instance.VolumeId}`,
                auth: {
                    username: 'DelhiPanel',
                    password: instance.Node.apiKey
                },
                headers: { 'Content-Type': 'application/json' }
            };

            const allPluginData = Object.values(plugins).map(plugin => plugin.config);
            const response = await axios(requestData);
            const logindata = response.data || [];

            const settings = await db.get('settings');
            res.render('instance/ftp', {
                req,
                logindata,
                instance,
                user: req.user,
                name: await db.get('name') || 'Delhi Panel',
                logo: await db.get('logo') || false,
                addons: { plugins: allPluginData },
                settings
            });
        } else {
            res.status(500).send('Invalid instance node configuration');
        }
    } catch (error) {
        console.error('[Delhi Panel] Error fetching FTP details:', error);
        const errorMessage = error.response?.data?.message || 'Connection to node failed.';
        res.status(500).send({ message: errorMessage });
    }
});

module.exports = router;
                       
