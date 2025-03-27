const express = require('express');
const router = express.Router();
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');
const { fetchFileContent } = require('../../utils/fileHelper');

const { loadPlugins } = require('../../plugins/loadPls.js');
const path = require('path');

const plugins = loadPlugins(path.join(__dirname, '../../plugins'));

router.get('/instance/:id/files/view/:file', async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id, file } = req.params;
    if (!id || !file) return res.redirect('../instances');

    try {
        const instance = await db.get(id + '_instance');
        if (!instance || !instance.VolumeId) return res.redirect('../instances');

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

        if (!instance.suspended) {
            instance.suspended = false;
            await db.set(id + '_instance', instance);
        }

        if (instance.suspended) {
            return res.redirect(`../../instance/${id}/suspended`);
        }

        const allPluginData = Object.values(plugins).map(plugin => plugin.config);
        const fileContent = await fetchFileContent(instance, file, req.query.path);

        res.render('instance/file', { 
            req, 
            instance,
            file: fileContent, 
            user: req.user, 
            name: await db.get('name') || 'Delhi Panel', 
            logo: await db.get('logo') || false,
            addons: { plugins: allPluginData }
        });

    } catch (error) {
        console.error('[Delhi Panel] Error fetching file:', error);
        const errorMessage = error.response?.data?.message || 'Connection to node failed.';

        res.status(500).render('500', { 
            error: errorMessage, 
            req, 
            user: req.user, 
            name: await db.get('name') || 'Delhi Panel', 
            logo: await db.get('logo') || false,
            addons: { plugins: Object.values(plugins).map(plugin => plugin.config) }
        });
    }
});

module.exports = router;
          
