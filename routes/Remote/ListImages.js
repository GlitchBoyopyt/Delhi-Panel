const express = require('express');
const { db } = require('../../handlers/db.js');

const router = express.Router();

/**
 * GET /images/list
 * Retrieves a list of all stored images for HydraDaemon initialization.
 *
 * @returns {Response} JSON response containing an array of images or an error message.
 */
router.get('/images/list', async (req, res) => {
    try {
        const images = await db.get('images') || []; // Default empty array if no images
        res.json({ success: true, images });
    } catch (error) {
        console.error('[Delhi Panel] Error fetching images:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch images' });
    }
});

module.exports = router;
