const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

/**
 * Load enabled plugins from the specified directory.
 * It ensures only plugins listed in `manifest.json` are loaded.
 *
 * @param {string} pluginDir - The directory where plugins are stored.
 * @returns {Object} An object containing loaded plugins and their configurations.
 */
function loadPlugins(pluginDir) {
    const plugins = {};
    const pluginFolders = fs.readdirSync(pluginDir);

    pluginFolders.forEach(folder => {
        const folderPath = path.join(pluginDir, folder);
        const indexPath = path.join(folderPath, 'index.js');
        const configPath = path.join(folderPath, 'manifest.json');

        // Ensure both index.js and manifest.json exist before loading the plugin
        if (fs.existsSync(indexPath) && fs.existsSync(configPath)) {
            const pluginConfig = require(configPath);
            const pluginModule = require(indexPath);

            plugins[folder] = {
                config: pluginConfig,
                module: pluginModule
            };
        }
    });

    return plugins;
}

module.exports = router;
module.exports.loadPlugins = loadPlugins;
