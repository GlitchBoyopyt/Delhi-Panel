/**
 * @fileoverview This module handles user account management, including authentication,
 * username updates, two-factor authentication (2FA), and password changes.
 */

const express = require('express');
const router = express.Router();
const { db } = require('../handlers/db.js');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const saltRounds = process.env.SALT_ROUNDS || 10;

async function doesUserExist(username) {
    const users = await db.get('users');
    return users ? users.some(user => user.username === username) : false;
}

router.get('/account', async (req, res) => {
    res.render('account', {
        req,
        user: req.user,
        users: await db.get('users') || [],
        name: await db.get('name') || 'Delhi Panel',
        logo: await db.get('logo') || false
    });
});

router.get('/accounts', async (req, res) => {
    res.send(await db.get('users') || []);
});

router.get('/check-username', async (req, res) => {
    const username = req.query.username;
    if (!username) return res.status(400).send('Username parameter is required.');

    res.json({ exists: await doesUserExist(username) });
});

router.post('/update-username', async (req, res, next) => {
    const { currentUsername, newUsername } = req.body;
    if (!currentUsername || !newUsername) return res.status(400).send('Current and new username parameters are required.');

    if (!req.isAuthenticated()) return res.status(401).send('User is not authenticated.');

    req.logout(async (err) => {
        if (err) return next(err);

        if (!await doesUserExist(currentUsername)) return res.status(404).send('Current username does not exist.');
        if (await doesUserExist(newUsername)) return res.status(409).send('New username is already taken.');

        const users = await db.get('users');
        await db.set('users', users.map(user => user.username === currentUsername ? { ...user, username: newUsername } : user));

        res.status(200).json({ success: true, username: newUsername });
    });
});

router.get('/enable-2fa', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('User is not authenticated.');

    const users = await db.get('users');
    const currentUser = users.find(user => user.username === req.user.username);
    const secret = speakeasy.generateSecret({ length: 20, name: `Delhi Panel (${currentUser.username})`, issuer: 'Delhi Panel' });

    await db.set('users', users.map(user => user.username === req.user.username ? { ...user, twoFASecret: secret.base32, twoFAEnabled: false } : user));

    qrcode.toDataURL(secret.otpauth_url, async (err, data_url) => {
        if (err) return res.status(500).send('Error generating QR Code');
        res.render('enable-2fa', {
            req,
            user: req.user,
            users,
            name: await db.get('name') || 'Delhi Panel',
            logo: await db.get('logo') || false,
            qrCode: data_url
        });
    });
});

router.post('/verify-2fa', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('User is not authenticated.');

    const { token } = req.body;
    const users = await db.get('users');
    const currentUser = users.find(user => user.username === req.user.username);

    if (speakeasy.totp.verify({ secret: currentUser.twoFASecret, encoding: 'base32', token })) {
        await db.set('users', users.map(user => user.username === req.user.username ? { ...user, twoFAEnabled: true } : user));
        res.redirect('/account?msg=2FAEnabled');
    } else {
        res.status(400).send('Invalid token');
    }
});

router.post('/disable-2fa', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('User is not authenticated.');

    const users = await db.get('users');
    await db.set('users', users.map(user => user.username === req.user.username ? { ...user, twoFAEnabled: false, twoFASecret: null } : user));

    res.redirect('/account');
});

router.post('/change-password', async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).send('Current and new password parameters are required.');

    if (!req.isAuthenticated()) return res.status(401).send('User is not authenticated.');

    const users = await db.get('users');
    const currentUser = users.find(user => user.username === req.user.username);

    if (!await bcrypt.compare(currentPassword, currentUser.password)) return res.status(401).send('Current password is incorrect.');

    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    await db.set('users', users.map(user => user.username === req.user.username ? { ...user, password: hashedNewPassword } : user));

    req.logout(async (err) => {
        if (err) return next(err);
    });

    res.status(200).redirect('/login?err=UpdatedCredentials');
});

router.post('/validate-password', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'User is not authenticated.' });

    const { currentPassword } = req.body;
    const users = await db.get('users');
    const currentUser = users.find(user => user.username === req.user.username);

    if (currentUser?.password && await bcrypt.compare(currentPassword, currentUser.password)) {
        res.status(200).json({ valid: true });
    } else {
        res.status(200).json({ valid: false });
    }
});

module.exports = router;
      
