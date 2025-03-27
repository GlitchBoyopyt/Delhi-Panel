const express = require("express");
const router = express.Router();
const axios = require("axios");
const { db } = require("../../handlers/db.js");
const { isUserAuthorizedForContainer } = require("../../utils/authHelper");

const { loadPlugins } = require("../../plugins/loadPls.js");
const path = require("path");

const plugins = loadPlugins(path.join(__dirname, "../../plugins"));

router.get("/instance/:id/files/unzip/:file", async (req, res) => {
    if (!req.user) return res.redirect("/");

    const { id, file } = req.params;
    const subPath = req.query.path ? `?path=${req.query.path}` : "";

    try {
        const instance = await db.get(`${id}_instance`);
        if (!instance) {
            console.error(`[Delhi Panel] Instance with ID ${id} not found.`);
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
            return res.redirect("../../instances?err=SUSPENDED");
        }

        if (!instance.VolumeId) {
            console.error(`[Delhi Panel] Instance ${id} missing VolumeId.`);
            return res.redirect("../instances");
        }

        const apiUrl = `http://${instance.Node.address}:${instance.Node.port}/fs/${instance.VolumeId}/files/unzip/${file}${subPath}`;

        try {
            await axios.post(apiUrl, {}, {
                auth: {
                    username: "Skyport",
                    password: instance.Node.apiKey
                }
            });

            console.log(`[Delhi Panel] Successfully unzipped ${file} for instance ${id}.`);
            return res.redirect(`/instance/${id}/files?err=UNZIPPED&path=${req.query.path || ""}`);
        } catch (error) {
            const status = error.response?.status || 500;
            const message = error.response?.data || "Failed to communicate with node.";

            console.error(`[Delhi Panel] API communication failure: ${status} - ${message}`);
            return res.status(status).json({ error: message });
        }
    } catch (err) {
        console.error(`[Delhi Panel] Error processing unzip request for instance ${id}: ${err.message}`);
        return res.status(500).send({ message: "Internal Server Error" });
    }
});

module.exports = router;
                  
