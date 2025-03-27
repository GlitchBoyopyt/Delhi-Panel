const express = require("express");
const router = express.Router();
const { db } = require("../../handlers/db.js");
const { isUserAuthorizedForContainer } = require("../../utils/authHelper");
const { editFile } = require("../../utils/fileHelper");

router.post("/instance/:id/files/edit/:filename", async (req, res) => {
    if (!req.user) return res.status(401).send("Authentication required");

    const { id, filename } = req.params;
    const { content } = req.body;
    const filePath = req.query.path || "";

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) {
            console.error(`[Delhi Panel] Instance ${id} not found.`);
            return res.status(404).send("Instance not found.");
        }

        const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
        if (!isAuthorized) {
            console.error(`[Delhi Panel] Unauthorized access attempt by user ${req.user.userId} on instance ${id}.`);
            return res.status(403).send("Unauthorized access to this instance.");
        }

        if (!instance.suspended) {
            instance.suspended = false;
            await db.set(`${id}_instance`, instance);
        }

        if (instance.suspended === true) {
            return res.redirect(`../../instance/${id}/suspended`);
        }

        if (!instance.Node?.address || !instance.Node?.port) {
            console.error(`[Delhi Panel] Invalid node configuration for instance ${id}.`);
            return res.status(500).send("Invalid instance node configuration.");
        }

        const result = await editFile(instance, filename, content, filePath);
        console.log(`[Delhi Panel] File ${filename} edited successfully for instance ${id}.`);
        res.json(result);
    } catch (error) {
        console.error(`[Delhi Panel] Error editing file ${filename} for instance ${id}: ${error.message}`);
        if (error.response) {
            return res.status(error.response.status).send(error.response.data);
        } else {
            return res.status(500).send({ message: "Failed to communicate with node." });
        }
    }
});

module.exports = router;
