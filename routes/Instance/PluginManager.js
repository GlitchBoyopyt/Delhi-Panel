const express = require('express');
const axios = require('axios');
const router = express.Router();
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');
const { fetchFiles } = require('../../utils/fileHelper');
const { loadPlugins } = require('../../plugins/loadPls.js');
const path = require('path');

const plugins = loadPlugins(path.join(__dirname, '../../plugins'));

const API_URL = 'https://api.spiget.org/v2/resources/free';
const DEFAULT_LOGO_URL = 'https://static.spigotmc.org/styles/spigot/xenresource/resource_icon.png';
const ITEMS_PER_PAGE = 50;

/**
 * Fetches the list of popular plugins.
 */
async function getPluginList() {
    try {
        const page = 1;
        const response = await axios.get(`${API_URL}?size=${ITEMS_PER_PAGE}&page=${page}&sort=-downloads`);
        return response.data;
    } catch (error) {
        console.error('[Delhi Panel] Error fetching plugin list:', error);
        return [];
    }
}

router.get("/instance/:id/plugins", async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    if (!id) return res.redirect('/');

    let instance = await db.get(`${id}_instance`);
    if (!instance) return res.redirect('../instances');

    const JAVA_IMAGE = 'quay.io/skyport/java:21';
    if (instance.Image !== JAVA_IMAGE) return res.redirect(`../../instance/${id}`);

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return res.status(403).send('Unauthorized access.');

    if (instance.suspended) return res.redirect('../../instances?err=SUSPENDED');

    const config = require('../../config.json');
    const { port, domain } = config;
    const allPluginData = Object.values(plugins).map(plugin => plugin.config);

    res.render('instance/plugin_manager', {
        req,
        ContainerId: instance.ContainerId,
        instance,
        port,
        domain,
        user: req.user,
        name: await db.get('name') || 'Delhi Panel',
        logo: await db.get('logo') || false,
        files: await fetchFiles(instance, ""),
        addons: {
            plugins: allPluginData
        }
    });
});

router.get("/instance/:id/plugins/download", async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    let { downloadUrl, plugin_name } = req.query;
    if (!id) return res.redirect('/instances');

    let instance = await db.get(`${id}_instance`);
    if (!instance) return res.redirect('../instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return res.status(403).send('Unauthorized access.');

    if (instance.suspended) return res.redirect('../../instances?err=SUSPENDED');

    try {
        if (downloadUrl.includes("</pre>")) {
            downloadUrl = downloadUrl.replace("</pre>", "");
        }
        const encodedDownloadUrl = encodeURIComponent(downloadUrl);

        const requestData = {
            method: 'post',
            url: `http://${instance.Node.address}:${instance.Node.port}/fs/${instance.VolumeId}/files/plugin/${encodedDownloadUrl}/${plugin_name}`,
            auth: {
                username: 'Skyport',
                password: instance.Node.apiKey,
            },
            headers: {
                'Content-Type': 'application/json',
            },
            data: {},
        };

        const downloadResponse = await axios(requestData);
        if (downloadResponse.status === 200) {
            return res.redirect(`/instance/${id}/plugins?success=true`);
        } else {
            return res.status(500).json({ success: false, message: "Error downloading plugin." });
        }
    } catch (error) {
        console.error('[Delhi Panel] Error during plugin download:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: "An error occurred while processing your request." });
    }
});

module.exports = router;
