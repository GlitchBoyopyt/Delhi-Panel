const express = require('express');
const router = express.Router();
const WebSocket = require('ws');
const { db } = require('../../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../../utils/authHelper');

router.ws("/stats/:id", async (ws, req) => {
    if (!req.user) return ws.close(1008, "Authorization required");

    const { id } = req.params;
    const instance = await db.get(`${id}_instance`);

    if (!instance) return ws.close(1008, "Invalid instance ID");

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return ws.close(1008, "Unauthorized access");

    const { Node: node, VolumeId, ContainerId } = instance;
    const socket = new WebSocket(`ws://${node.address}:${node.port}/stats/${ContainerId}/${VolumeId}`);

    socket.onopen = () => {
        socket.send(JSON.stringify({ event: "auth", args: [node.apiKey] }));
    };

    socket.onmessage = (msg) => ws.send(msg.data);

    socket.onerror = () => {
        ws.send('\x1b[31;1mDelhi Panel instance is unavailable! Retrying...\x1b[0m');
    };

    ws.onmessage = (msg) => socket.send(msg.data);

    ws.on('close', () => socket.close());
});

module.exports = router;
