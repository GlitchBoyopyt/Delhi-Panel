const express = require('express');
const router = express.Router();
const WebSocket = require('ws');
const axios = require('axios');
const { db } = require('../../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../../utils/authHelper');

router.ws("/console/:id", async (ws, req) => {
    if (!req.user) return ws.close(1008, "Authorization required");

    const { id } = req.params;
    const instance = await db.get(`${id}_instance`);

    if (!instance) return ws.close(1008, "Invalid instance ID");

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return ws.close(1008, "Unauthorized access");

    const { Node: node, ContainerId } = instance;
    const socket = new WebSocket(`ws://${node.address}:${node.port}/exec/${ContainerId}`);

    socket.onopen = () => {
        socket.send(JSON.stringify({ event: "auth", args: [node.apiKey] }));
    };

    socket.onmessage = (msg) => ws.send(msg.data);

    socket.onerror = () => {
        ws.send('\x1b[31;1mDelhi Panel instance appears to be down\x1b[0m');
    };

    ws.onmessage = (msg) => socket.send(msg.data);

    ws.on('close', () => socket.close());
});

/**
 * Handles instance power actions (start, stop, restart)
 */
router.get('/instance/action/:power/:id', async (req, res) => {
    if (!req.user) return res.status(403).json({ error: 'Login First' });

    const { power, id } = req.params;
    if (!['start', 'stop', 'restart'].includes(power)) {
        return res.status(400).json({ error: 'Invalid action. Valid actions: start, stop, restart.' });
    }

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return res.status(404).json({ error: 'Instance not found' });

        const { Node: node } = instance;
        const url = `http://${node.address}:${node.port}/instances/${id}/${power}`;

        try {
            const response = await axios.post(url, {}, {
                auth: { username: 'Skyport', password: node.apiKey }
            });

            if (response.status === 200) {
                return res.json({ message: `Instance ${power}ed successfully.` });
            } else {
                return res.status(response.status).json({ error: `Failed to ${power} instance.` });
            }
        } catch (error) {
            console.error('Error communicating with node:', error.message);
            return res.status(500).json({ error: 'Failed to communicate with node.' });
        }
    } catch (error) {
        console.error('Internal server error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
