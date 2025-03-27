const express = require('express');
const router = express.Router();
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');
const { createFile } = require('../../utils/fileHelper');

router.post("/instance/:id/imagefeatures/eula", async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    const instance = await db.get(`${id}_instance`).catch(err => {
        console.error('[Delhi Panel] Failed to fetch instance:', err);
        return null;
    });

    if (!instance || !instance.VolumeId) return res.redirect('../instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

    if (!instance.suspended) {
        instance.suspended = false;
        await db.set(`${id}_instance`, instance);
    }

    if (instance.suspended === true) {
        return res.redirect(`../../instance/${id}/suspended`);
    }

    createFile(instance, 'eula.txt', 'eula=true');
    console.log(`[Delhi Panel] EULA accepted for instance: ${id}`);
    
    res.status(200).send('OK');
});

router.get("/instance/:id/imagefeatures/cracked", async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id } = req.params;
    const instance = await db.get(`${id}_instance`).catch(err => {
        console.error('[Delhi Panel] Failed to fetch instance:', err);
        return null;
    });

    if (!instance || !instance.VolumeId) return res.redirect('../instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) return res.status(403).send('Unauthorized access to this instance.');

    if (!instance.suspended) {
        instance.suspended = false;
        await db.set(`${id}_instance`, instance);
    }

    if (instance.suspended === true) {
        return res.redirect(`../../instance/${id}/suspended`);
    }

    const serverPort = instance.Ports.split(':')[1];

    const now = new Date();
    const formattedDateTime = `#${now.getDate().toString().padStart(2, '0')} ${now.getMonth() + 1} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} UTC ${now.getFullYear()}`;

    console.log(`[Delhi Panel] Successfully enabled Cracked Mode for instance: ${id} on port ${serverPort}`);

    const serverProperties = `
#Minecraft server properties
${formattedDateTime}
accepts-transfers=false
allow-flight=false
allow-nether=true
broadcast-console-to-ops=true
broadcast-rcon-to-ops=true
debug=false
difficulty=easy
enable-command-block=false
enable-status=true
enforce-secure-profile=true
force-gamemode=false
gamemode=survival
generate-structures=true
level-name=world
max-players=20
motd=A Minecraft Server
network-compression-threshold=256
online-mode=false
pvp=true
server-ip=
server-port=${serverPort}
view-distance=10
white-list=false
`;

    createFile(instance, 'server.properties', serverProperties);
    res.redirect(`/instance/${id}`);
});

module.exports = router;
