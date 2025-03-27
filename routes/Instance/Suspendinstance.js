const express = require('express');
const router = express.Router();
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');

router.get("/instance/:id/suspended", async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    if (!id) return res.redirect('../instances');

    const instance = await db.get(`${id}_instance`).catch(err => {
        console.error('[Delhi Panel] Failed to fetch instance:', err);
        return null;
    });

    if (!instance || !instance.VolumeId) return res.redirect('../instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return res.status(403).send('Unauthorized access.');

    if (!instance.suspended) {
        instance.suspended = false;
        await db.set(`${id}_instance`, instance);
    }

    if (!instance.suspended) return res.redirect(`../instance/${id}`);

    res.render('instance/suspended', {
        req,
        user: req.user,
        name: await db.get('name') || 'Delhi Panel',
        logo: await db.get('logo') || false
    });
});

module.exports = router;
