const express = require('express');
const router = express.Router();
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');

router.post("/instance/:id/power", async (req, res) => {
    if (!req.user) return res.redirect('/');
    
    const { id } = req.params;
    if (!id) return res.redirect('/instances');

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return res.status(404).send('Instance not found.');

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) return res.status(403).send('Unauthorized access.');

        if (instance.suspended) return res.redirect(`/instance/${id}/suspended`);

        const apiUrl = `http://${instance.Node.address}:${instance.Node.port}/instances/${instance.ContainerId}/stop`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`Skyport:${instance.Node.apiKey}`).toString('base64')}`
            },
            body: JSON.stringify({ command: instance.StopCommand })
        });

        if (!response.ok) {
            throw new Error(`Failed to send power command: ${response.statusText}`);
        }

        const data = await response.json();
        res.json({ message: 'Instance power command executed', response: data });
    } catch (error) {
        console.error('[Delhi Panel] Error sending power command:', error);
        res.status(500).send(error.message || 'Failed to communicate with node.');
    }
});

module.exports = router;
