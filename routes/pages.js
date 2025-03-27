/**
 * @fileoverview This module dynamically sets up express routes for different pages based on
 * configuration read from a JSON file. It utilizes middleware for authentication checks and
 * accesses a database to fetch user-specific or global information to render pages.
 */

const express = require('express');
const fs = require('fs').promises;
const router = express.Router();
const config = require('../config.json');

const { isAuthenticated } = require('../handlers/auth.js');
const { db } = require('../handlers/db.js');

/**
 * Dynamically reads the page configurations from a JSON file and sets up express routes accordingly.
 * Each page configuration can specify if authentication is required. Authenticated routes fetch
 * user-specific instance data from the database, while non-authenticated routes fetch general data.
 */
async function setupRoutes() {
    try {
        const data = await fs.readFile('pages.json', 'utf8'); 
        const pages = JSON.parse(data);

        for (const page of pages) {
            if (page.requiresAuth) {
                router.get(page.path, isAuthenticated, async (req, res) => {
                    try {
                        const userId = req.user.userId;
                        let instances = await db.get(userId + '_instances') || [];
                        let adminInstances = [];

                        if (req.user.admin) {
                            const allInstances = await db.get('instances') || [];
                            adminInstances = allInstances.filter(instance => instance.User === userId);
                        }

                        const users = await db.get('users') || [];
                        const authenticatedUser = users.find(user => user.userId === userId);
                        if (!authenticatedUser) {
                            return res.status(404).send('User not found.');
                        }

                        const subUserInstances = authenticatedUser.accessTo || [];
                        const subInstancesPromises = subUserInstances.map(id => db.get(`${id}_instance`));
                        const subInstances = (await Promise.all(subInstancesPromises)).filter(instance => instance);

                        instances = [...instances, ...subInstances];

                        const [name, logo, settings] = await Promise.all([
                            db.get('name') || 'Delhi Panel',
                            db.get('logo') || false,
                            db.get('settings') || {}
                        ]);

                        res.render(page.template, { 
                            req, user: req.user, name, logo, settings, config, instances, adminInstances 
                        });

                    } catch (error) {
                        console.error('Error fetching subuser instances:', error);
                        res.status(500).send('Internal Server Error');
                    }
                });

            } else {
                router.get(page.path, async (req, res) => {
                    try {
                        const [name, logo, settings] = await Promise.all([
                            db.get('name') || 'Delhi Panel',
                            db.get('logo') || false,
                            db.get('settings') || {}
                        ]);

                        res.render(page.template, { req, name, logo, settings });

                    } catch (error) {
                        console.error('Error rendering public page:', error);
                        res.status(500).send('Internal Server Error');
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error setting up routes:', error);
    }
}

/**
 * GET /
 * Redirects the user to the dashboard page.
 */
router.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Setup dynamic routes
setupRoutes();

module.exports = router;
                          
