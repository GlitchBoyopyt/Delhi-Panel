const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const axios = require('axios');
const { db } = require('../handlers/db.js');
const config = require('../config.json');
const bcrypt = require('bcrypt');
const WebSocket = require('ws');
const saltRounds = 10;
const { logAudit } = require('../handlers/auditlog.js');
const { isAuthenticated } = require('../handlers/auth.js');
const rateLimit = require('express-rate-limit'); // Rate limiting
const speakeasy = require('speakeasy'); // 2FA
const qrcode = require('qrcode');

// Basic API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
});

// Apply limiter to all API routes
router.use(apiLimiter);

// Function to generate 2FA Secret
router.get('/enable-2fa', isAuthenticated, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `Delhi Panel (${req.user.email})` });
  await db.set(`2fa-${req.user.email}`, secret.base32);
  const qr = await qrcode.toDataURL(secret.otpauth_url);

  res.render('2fa', {
    qrCode: qr,
    secret: secret.base32,
    user: req.user,
  });
});

// Verify 2FA
router.post('/verify-2fa', isAuthenticated, async (req, res) => {
  const { token } = req.body;
  const storedSecret = await db.get(`2fa-${req.user.email}`);

  if (!storedSecret) return res.redirect('/dashboard?err=2FA_NOT_ENABLED');

  const verified = speakeasy.totp.verify({
    secret: storedSecret,
    encoding: 'base32',
    token
  });

  if (verified) {
    return res.redirect('/dashboard?success=2FA_VERIFIED');
  } else {
    return res.redirect('/dashboard?err=INVALID_2FA');
  }
});

// Enhanced AFK Earning System
router.ws('/afkwspath', async (ws, req) => {
  let earners = {};
  
  if (!req.user) return ws.close();
  const email = req.user.email;

  if (earners[email]) return ws.close(); 

  earners[email] = true;
  let time = process.env.AFK_TIME || 60;
  let bonusThreshold = 5; // Every 5 cycles, give a bonus

  let afkInterval = setInterval(async () => {
    time--;

    if (time <= 0) {
      time = process.env.AFK_TIME || 60;
      let coins = await db.get(`coins-${email}`) || 0;
      let bonus = coins % bonusThreshold === 0 ? 10 : 5; // Bonus coins every 5th time
      await db.set(`coins-${email}`, coins + bonus);
      ws.send(JSON.stringify({ type: "coin", bonus }));
    }

    ws.send(JSON.stringify({ type: "count", amount: time }));
  }, 1000);

  ws.on('close', () => {
    delete earners[email];
    clearInterval(afkInterval);
  });
});

// Restart Server Functionality
router.get('/restart/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const instance = await db.get(id + '_instance');

  if (!instance) return res.redirect('/dashboard?err=INSTANCE_NOT_FOUND');
  if (instance.User !== req.user.userId) return res.redirect('/dashboard?err=NO_PERMISSION');

  try {
    await axios.post(`http://${instance.Node.address}:${instance.Node.port}/instances/${instance.ContainerId}/restart`, {}, {
      auth: { username: 'Skyport', password: instance.Node.apiKey }
    });
    res.redirect('/dashboard?success=SERVER_RESTARTED');
  } catch (error) {
    console.error("Error restarting instance:", error);
    res.redirect('/dashboard?err=SERVER_RESTART_FAILED');
  }
});

// User Roles & Permissions System
const checkRole = async (email, role) => {
  const user = await db.get(`user-${email}`);
  return user && user.role === role;
};

router.get('/admin', isAuthenticated, async (req, res) => {
  if (!(await checkRole(req.user.email, 'admin'))) {
    return res.redirect('/dashboard?err=NO_PERMISSION');
  }

  res.render('admin', { users: await db.get('users') || [] });
});

// Resource Transfer Feature
router.post('/transfer-resource', isAuthenticated, async (req, res) => {
  const { recipientEmail, resource, amount } = req.body;
  if (!recipientEmail || !resource || !amount) return res.redirect('/dashboard?err=MISSING_FIELDS');

  const senderResources = await db.get(`resources-${req.user.email}`);
  const recipientResources = await db.get(`resources-${recipientEmail}`) || { ram: 0, disk: 0, cores: 0 };

  if (!senderResources || senderResources[resource] < amount) {
    return res.redirect('/dashboard?err=NOT_ENOUGH_RESOURCE');
  }

  senderResources[resource] -= amount;
  recipientResources[resource] += amount;

  await db.set(`resources-${req.user.email}`, senderResources);
  await db.set(`resources-${recipientEmail}`, recipientResources);

  res.redirect('/dashboard?success=RESOURCE_TRANSFERRED');
});

// Delete Server with Confirmation
router.get('/delete/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const instance = await db.get(id + '_instance');

  if (!instance) return res.redirect('/dashboard?err=INSTANCE_NOT_FOUND');
  if (instance.User !== req.user.userId) return res.redirect('/dashboard?err=NO_PERMISSION');

  try {
    await axios.get(`http://Skyport:${instance.Node.apiKey}@${instance.Node.address}:${instance.Node.port}/instances/${instance.ContainerId}/delete`);

    let userInstances = await db.get(instance.User + '_instances') || [];
    userInstances = userInstances.filter(obj => obj.ContainerId !== instance.ContainerId);
    await db.set(instance.User + '_instances', userInstances);
    
    let globalInstances = await db.get('instances') || [];
    globalInstances = globalInstances.filter(obj => obj.ContainerId !== instance.ContainerId);
    await db.set('instances', globalInstances);
    
    await db.delete(instance.ContainerId + '_instance');

    res.redirect('/dashboard?success=INSTANCE_DELETED');
  } catch (error) {
    console.error("Error deleting instance:", error);
    res.redirect('/dashboard?err=DELETE_FAILED');
  }
});

module.exports = router;
          
