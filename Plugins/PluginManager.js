const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const { db } = require('../handlers/db.js');
const CatLoggr = require('cat-loggr');
const log = new CatLoggr();

// Plugin-related variables
let pluginList = [];
let pluginNames = [];
let pluginsidebar = {};
let sidebar = {};

// Plugin directories
const pluginsDir = path.join(__dirname, '../plugins');
const pluginsJsonPath = path.join(pluginsDir, 'plugins.json');

/**
 * Reads and parses the `plugins.json` file.
 * @returns {Promise<Object>} Parsed JSON object of plugins.
 */
async function readPluginsJson() {
    try {
        const data = await fs.promises.readFile(pluginsJsonPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        log.error('Failed to read plugins.json:', error);
        return {};
    }
}

/**
 * Writes updated data to the `plugins.json` file.
 * @param {Object} plugins - Updated plugin configurations.
 */
async function writePluginsJson(plugins) {
    try {
        await fs.promises.writeFile(pluginsJsonPath, JSON.stringify(plugins, null, 4), 'utf8');
    } catch (error) {
        log.error('Failed to write plugins.json:', error);
    }
}

/**
 * Loads and activates plugins from the plugins directory.
 * Only enabled plugins from `plugins.json` will be initialized.
 */
async function loadAndActivatePlugins() {
    // Reset plugin lists
    pluginList = [];
    pluginNames = [];
    pluginsidebar = {};
    sidebar = {};

    // Clear require cache to reload plugins
    Object.keys(require.cache).forEach(key => {
        if (key.startsWith(pluginsDir)) delete require.cache[key];
    });

    let pluginsJson = await readPluginsJson();
    const pluginDirs = await fs.promises.readdir(pluginsDir);

    // Ensure all found plugins exist in plugins.json
    for (const pluginName of pluginDirs) {
        const manifestPath = path.join(pluginsDir, pluginName, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = require(manifestPath);
            if (!pluginsJson[manifest.name]) {
                pluginsJson[manifest.name] = { enabled: true };
            }
        }
    }
    await writePluginsJson(pluginsJson);

    // Load enabled plugins
    for (const pluginName of pluginDirs) {
        const pluginPath = path.join(pluginsDir, pluginName);
        const manifestPath = path.join(pluginPath, 'manifest.json');

        if (!fs.existsSync(manifestPath)) continue;

        try {
            const manifest = require(manifestPath);
            if (!pluginsJson[manifest.name]?.enabled) {
                log.info(`Plugin ${pluginName} is disabled.`);
                pluginList.push(manifest);
                continue;
            }

            manifest.directoryname = pluginName;
            manifest.manifestpath = manifestPath;
            pluginList.push(manifest);
            pluginNames.push(manifest.name);

            const mainFilePath = path.join(pluginPath, manifest.main);
            const pluginModule = require(mainFilePath);

            if (typeof pluginModule.register === 'function') {
                pluginModule.register(global.pluginmanager);
            } else {
                log.error(`Error: Plugin ${manifest.name} is missing a 'register' function.`);
            }

            if (pluginModule.router) {
                router.use(`/${manifest.router}`, pluginModule.router);
            } else {
                log.error(`Error: Plugin ${manifest.name} is missing a 'router' property.`);
            }

            if (manifest.adminsidebar) {
                Object.assign(pluginsidebar, manifest.adminsidebar);
                Object.assign(sidebar, manifest.sidebar);
            }
        } catch (error) {
            log.error(`Error loading plugin ${pluginName}:`, error);
        }
    }
}

/**
 * Middleware to check if the user is an admin.
 */
function isAdmin(req, res, next) {
    if (!req.user || req.user.admin !== true) {
        return res.redirect('../');
    }
    next();
}

/**
 * Admin page to manage plugins.
 */
router.get('/admin/plugins', isAdmin, async (req, res) => {
    const pluginsJson = await readPluginsJson();
    const pluginArray = Object.entries(pluginsJson).map(([name, details]) => ({
        name,
        ...details
    }));
    const enabledPlugins = pluginArray.filter(plugin => plugin.enabled);

    res.render('admin/plugins', {
        req,
        plugins: pluginList,
        pluginsidebar,
        enabledPlugins,
        user: req.user,
        name: await db.get('name') || 'DelhiPanel',
        logo: await db.get('logo') || false
    });
});

/**
 * Toggle plugin activation status.
 */
router.post('/admin/plugins/:name/toggle', isAdmin, async (req, res) => {
    const name = req.params.name;
    const pluginsJson = await readPluginsJson();

    if (pluginsJson[name]) {
        pluginsJson[name].enabled = !pluginsJson[name].enabled;
        await writePluginsJson(pluginsJson);
        await loadAndActivatePlugins();
    }
    res.send('OK');
});

/**
 * Edit a plugin's manifest file.
 */
router.get('/admin/plugins/:dir/edit', isAdmin, async (req, res) => {
    const dir = req.params.dir;
    const manifestPath = path.join(pluginsDir, dir, 'manifest.json');

    try {
        const manifestJson = await fs.promises.readFile(manifestPath, 'utf8');
        res.render('admin/plugin', {
            req,
            pluginsidebar,
            dir,
            content: manifestJson,
            user: req.user,
            name: await db.get('name') || 'DelhiPanel',
            logo: await db.get('logo') || false
        });
    } catch (error) {
        log.error(`Error reading manifest for plugin ${dir}:`, error);
        res.status(500).send('Error loading plugin configuration.');
    }
});

/**
 * Save changes to a plugin's manifest file.
 */
router.post('/admin/plugins/:dir/save', isAdmin, async (req, res) => {
    const dir = req.params.dir;
    const content = req.body.content;
    const manifestPath = path.join(pluginsDir, dir, 'manifest.json');

    try {
        await fs.promises.writeFile(manifestPath, content, 'utf8');
        res.redirect(`/admin/plugins/${dir}/edit`);
    } catch (error) {
        log.error(`Error saving manifest for plugin ${dir}:`, error);
        res.status(500).send('Error saving plugin configuration.');
    }
});

/**
 * Reload all plugins.
 */
router.post('/admin/plugins/reload', isAdmin, async (req, res) => {
    await loadAndActivatePlugins();
    res.redirect('/admin/plugins');
});

// Load plugins on startup
loadAndActivatePlugins();

module.exports = router;
          
