const express = require("express");
const passport = require("passport");
const config = require("../config.json");
const LocalStrategy = require("passport-local").Strategy;
const { v4: uuidv4 } = require("uuid");
const { db } = require("../handlers/db.js");
const { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } = require("../handlers/email.js");
const speakeasy = require("speakeasy");
const bcrypt = require("bcrypt");

const saltRounds = 10;
const router = express.Router();

// Initialize Passport
router.use(passport.initialize());
router.use(passport.session());

// Configure Passport Local Strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const settings = (await db.get("settings")) || {};
      const users = (await db.get("users")) || [];

      if (!users.length) return done(null, false, { message: "No users found." });

      const user = users.find((user) => user.username === username || user.email === username);
      if (!user) return done(null, false, { message: "Incorrect username or email." });

      if (!user.verified && settings.emailVerification) {
        return done(null, false, { message: "Email not verified. Please verify your email.", userNotVerified: true });
      }

      const match = await bcrypt.compare(password, user.password);
      return match ? done(null, user) : done(null, false, { message: "Incorrect password." });
    } catch (error) {
      return done(error);
    }
  })
);

// Serialize & Deserialize User
passport.serializeUser((user, done) => done(null, user.username));
passport.deserializeUser(async (username, done) => {
  try {
    const users = await db.get("
