const express = require('express');
const router = express.Router();
const axios = require('axios');
const { db } = require('../handlers/db.js');
const { logAudit } = require('../handlers/auditlog.js');

/**
 * Middleware to verify if the user is an administrator.
 */
function isAdmin(req, res, next) {
    if (!req.user || req.user.admin !== true) {
        return res.redirect('../');
    }
    next();
}

router.get('/scan/sedar', isAdmin, async (req, res) => {
    try {
        const instances = await getInstances();
        if (!instances.length) {
            return res.json({ success: false, message: 'No instances found.' });
        }

        let suspendedServers = [];
        for (const instance of instances) {
            if (!instance.suspended) {
                await getInstanceFiles(instance.Id, '', suspendedServers);
            }
        }

        // Encode Suspended Servers List
        const encodedSuspendedServers = encodeURIComponent(JSON.stringify(suspendedServers));

        res.redirect(`/admin/nodes?scan=success&suspendedServers=${encodedSuspendedServers}`);
    } catch (err) {
        console.error('Error scanning instances:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

async function getInstanceFiles(id, path, suspendedServers) {
    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return console.error(`Instance ${id} not found in DB.`);

        const url = `http://${instance.Node.address}:${instance.Node.port}/fs/${id}/files?path=${path}`;
        const response = await axios.get(url, {
            auth: { username: 'Skyport', password: instance.Node.apiKey }
        });

        if (response.status !== 200) {
            console.error(`Failed to retrieve files for instance ${id}. Status: ${response.status}`);
            return;
        }

        const files = response.data.files;
        if (!Array.isArray(files)) return console.error('Invalid file structure received.');

        for (const file of files) {
            if (file.isDirectory && !file.isEditable) {
                await getInstanceFiles(id, file.name, suspendedServers);
            }

            // Check for suspicious files
            const suspiciousFiles = ['script', 'xmrig', 'server.jar'];
            if (suspiciousFiles.includes(file.name) || file.purpose === 'script') {
                const sizeInBytes = parseFileSize(file.size);
                if (sizeInBytes && sizeInBytes < 18 * 1024 * 1024) {
                    const reason = `Suspicious ${file.name} detected.`;
                    await suspendServer(id, suspendedServers, reason);
                }
            }
        }
    } catch (error) {
        console.error(`Error processing files for instance ${id}:`, error);
    }
}

async function getInstances() {
    try {
        return await db.get('instances') || [];
    } catch (error) {
        console.error('Error retrieving instances:', error.message);
        return [];
    }
}

async function suspendServer(id, suspendedServers, reason) {
    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) return console.error(`Instance ${id} not found.`);

        instance.sedar = { reason };
        instance.suspended = true;
        await db.set(`${id}_instance`, instance);

        let instances = await db.get('instances') || [];
        const instanceToSuspend = instances.find(obj => obj.ContainerId === instance.ContainerId);
        if (instanceToSuspend) instanceToSuspend.suspended = true;

        await db.set('instances', instances);

        // Log suspension
        logAudit(`Server ${id} suspended: ${reason}`);

        suspendedServers.push({ id: instance.Id, name: instance.Name });
    } catch (error) {
        console.error(`Error suspending server ${id}:`, error);
    }
}

function parseFileSize(size) {
    if (!size) return null;
    if (size.includes('MB')) return parseFloat(size) * 1024 * 1024;
    if (size.includes('KB')) return parseFloat(size) * 1024;
    if (size.includes('B')) return parseFloat(size);
    console.error('Unknown size format:', size);
    return null;
}

module.exports = router;
      
