const express = require('express');
const router = express.Router();
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');
const { loadPlugins } = require('../../plugins/loadPls.js');
const path = require('path');

const plugins = loadPlugins(path.join(__dirname, '../../plugins'));

/**
 * GET /instance/:id/users
 * Fetches users with access to a specific instance.
 */
router.get('/instance/:id/users', async (req, res) => {
    const { id } = req.params;

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return res.status(404).send('Instance not found.');

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

        const users = (await db.get('users') || []).filter(user => user?.accessTo?.includes(instance.Id));
        const allPluginData = Object.values(plugins).map(plugin => plugin.config);

        res.render('instance/users', {
            req,
            instance,
            user: req.user,
            name: await db.get('name') || 'Delhi Panel',
            logo: await db.get('logo') || false,
            users,
            addons: { plugins: allPluginData }
        });
    } catch (err) {
        console.error('[Delhi Panel] Error fetching instance users:', err);
        res.status(500).send('Internal Server Error.');
    }
});

/**
 * POST /instance/:id/users/add
 * Adds a user to an instance's access list.
 */
router.post('/instance/:id/users/add', async (req, res) => {
    const { id } = req.params;
    const { username } = req.body;

    try {
        let usersData = await db.get('users') || [];
        let user = usersData.find(user => user.username === username);

        if (!user) return res.redirect(`/instance/${id}/users?err=usernotfound`);

        if (!user.accessTo.includes(id)) {
            user.accessTo.push(id);
            await db.set('users', usersData);
        }

        res.redirect(`/instance/${id}/users`);
    } catch (error) {
        console.error('[Delhi Panel] Error adding user to instance:', error);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * GET /instance/:id/users/remove/:username
 * Removes a user from an instance's access list.
 */
router.get('/instance/:id/users/remove/:username', async (req, res) => {
    const { id, username } = req.params;

    try {
        let usersData = await db.get('users') || [];
        let user = usersData.find(user => user.username === username);

        if (!user) return res.redirect(`/instance/${id}/users?err=usernotfound`);

        user.accessTo = user.accessTo.filter(accessId => accessId !== id);
        await db.set('users', usersData);

        res.redirect(`/instance/${id}/users`);
    } catch (error) {
        console.error('[Delhi Panel] Error removing user from instance:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
