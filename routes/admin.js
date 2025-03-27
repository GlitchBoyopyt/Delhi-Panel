/**
 * @fileoverview This module sets up administrative routes for managing and monitoring server nodes
 * within the network. It provides functionality to create, delete, and debug nodes, as well as check
 * their current status. User authentication and admin role verification are enforced for access to
 * these routes.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { db } = require('../handlers/db.js');
const config = require('../config.json');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const multer = require('multer');
const path = require('path');
const fs = require('node:fs');
const { logAudit } = require('../handlers/auditlog.js');
const nodemailer = require('nodemailer');
const { sendTestEmail } = require('../handlers/email.js');

/**
 * Middleware to verify if the user is an administrator.
 */
function isAdmin(req, res, next) {
  if (!req.user || req.user.admin !== true) {
    return res.redirect('../');
  }
  next();
}

async function doesUserExist(username) {
  const users = await db.get('users');
  return users ? users.some(user => user.username === username) : false;
}

async function doesEmailExist(email) {
  const users = await db.get('users');
  return users ? users.some(user => user.email === email) : false;
}

/**
 * Checks the operational status of a node.
 */
async function checkNodeStatus(node) {
  try {
    const RequestData = {
      method: 'get',
      url: `http://${node.address}:${node.port}/`,
      auth: {
        username: 'Skyport',
        password: node.apiKey
      },
      headers: { 'Content-Type': 'application/json' }
    };
    const response = await axios(RequestData);
    const { versionFamily, versionRelease, online, remote, docker } = response.data;

    node.status = 'Online';
    node.versionFamily = versionFamily;
    node.versionRelease = versionRelease;
    node.remote = remote;

    await db.set(`${node.id}_node`, node);
    return node;
  } catch (error) {
    node.status = 'Offline';
    await db.set(`${node.id}_node`, node);
    return node;
  }
}

router.get('/admin/apikeys', isAdmin, async (req, res) => {
  try {
    res.render('admin/apikeys', {
      req,
      user: req.user,
      apiKeys: await db.get('apiKeys') || [],
      name: await db.get('name') || 'Delhi Panel',
      logo: await db.get('logo') || false
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve API keys' });
  }
});

router.post('/apikeys/create', isAdmin, async (req, res) => {
  try {
    const newApiKey = {
      id: uuidv4(),
      key: 'hpk_' + uuidv4(),
      createdAt: new Date().toISOString()
    };

    let apiKeys = await db.get('apiKeys') || [];
    apiKeys.push(newApiKey);
    await db.set('apiKeys', apiKeys);

    res.status(201).json(newApiKey);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

router.delete('/apikeys/delete', isAdmin, async (req, res) => {
  try {
    const { keyId } = req.body;
    let apiKeys = await db.get('apiKeys') || [];
    apiKeys = apiKeys.filter(key => key.id !== keyId);
    await db.set('apiKeys', apiKeys);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

router.get('/admin/overview', isAdmin, async (req, res) => {
  try {
    const users = await db.get('users') || [];
    const nodes = await db.get('nodes') || [];
    const images = await db.get('images') || [];
    const instances = await db.get('instances') || [];

    res.render('admin/overview', {
      req,
      user: req.user,
      name: await db.get('name') || 'Delhi Panel',
      logo: await db.get('logo') || false,
      usersTotal: users.length,
      nodesTotal: nodes.length,
      imagesTotal: images.length,
      instancesTotal: instances.length,
      version: config.version
    });
  } catch (error) {
    res.status(500).send({ error: 'Failed to retrieve data from the database.' });
  }
});

router.get('/admin/nodes', isAdmin, async (req, res) => {
  let nodes = await db.get('nodes') || [];
  let instances = await db.get('instances') || [];
  let set = {};
  
  nodes.forEach(node => {
    set[node] = instances.filter(instance => instance.Node.id === node).length;
  });

  nodes = await Promise.all(nodes.map(id => db.get(id + '_node').then(checkNodeStatus)));

  res.render('admin/nodes', {
    req,
    user: req.user,
    name: await db.get('name') || 'Delhi Panel',
    logo: await db.get('logo') || false,
    nodes,
    set
  });
});

router.get('/admin/settings', isAdmin, async (req, res) => {
  res.render('admin/settings/appearance', {
    req,
    user: req.user,
    name: await db.get('name') || 'Delhi Panel',
    logo: await db.get('logo') || false,
    settings: await db.get('settings')
  });
});

module.exports = router;
