const readline = require('readline');
const { db } = require('../handlers/db.js');
const config = require('../config.json')
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const CatLoggr = require('cat-loggr');
const log = new CatLoggr();
const saltRounds = process.env.SALT_ROUNDS || 10;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function doesUserExist(username) {
    const users = await db.get('users');
    if (users) {
        return users.some(user => user.username === username);
    } else {
        return false;
    }
}

async function doesEmailExist(email) {
    const users = await db.get('users');
    if (users) {
        return users.some(user => user.email === email);
    } else {
        return false;
    }
}

async function initializeUsersTable(username, email, password) {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();
    const users = [{ userId, username, email, password: hashedPassword, accessTo: [], admin: true, verified: true }];
    return db.set('users', users);
}

async function createUser(username, email, password) {
    const users = await db.get('users') || {};
  
    if (!users) {
      const default_resources = {
        ram: config.total_resources.ram,
        disk: config.total_resources.disk,
        cores: config.total_resources.cores
      };
      
      const max_resources = await db.get('resources-'+ email)
      if (!max_resources) {
        // console.log('Starting Resources Creation for '+ email);
        await db.set('resources-' + email, default_resources);
       //  console.log('Resources created for '+ email , await db.get('resources-'+ email));
      }
      return addUserToUsersTable(username, email, password, true);
    } else {
      const default_resources = {
        ram: config.total_resources.ram,
        disk: config.total_resources.disk,
        cores: config.total_resources.cores
      };
      
      const max_resources = await db.get('resources-'+ email)
      if (!max_resources) {
        console.log('Starting Resources Creation for '+ email);
        await db.set('resources-' + email, default_resources);
        console.log('Resources created for '+ email , await db.get('resources-'+ email));
      }
      return addUserToUsersTable(username, email, password, true);
    }
  }
  
  async function addUserToUsersTable(username, email, password, verified) {
    try {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const userId = uuidv4();
      const verificationToken = verified ? null : generateRandomCode(30);
      let users = await db.get('users') || [];
      const newUser = { userId, username, email, password: hashedPassword, accessTo: [], admin: true, welcomeEmailSent: false, verified, verificationToken };
      users.push(newUser);
      await db.set('users', users);
  
  
      return users;
    } catch (error) {
      console.error('Error adding user to database:', error);
      throw error;
    }
  }
  

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function main() {
    const args = process.argv.slice(2);
    const flags = {};
    args.forEach(arg => {
        const [key, value] = arg.split('=');
        if (key.startsWith('--')) {
            flags[key.slice(2)] = value;
        }
    });

    const username = flags.username || await askQuestion("Username: ");
    const email = flags.email || await askQuestion("Email: ");

    if (!isValidEmail(email)) {
        log.error("Invalid email!");
        if (!flags.email) return main(); // Retry if no email flag is passed
    }

    const password = flags.password || await askQuestion("Password: ");

    const userExists = await doesUserExist(username);
    const emailExists = await doesEmailExist(email);
    if (userExists || emailExists) {
        log.error("User already exists!");
        if (!flags.username || !flags.email) return main(); // Retry if no flags are passed
    }

    try {
        await createUser(username, email, password);
        log.info("Done! User created.");
        rl.close();
    } catch (err) {
        log.error('Error creating user:', err);
        rl.close();
    }
}

main().catch(err => {
    console.error('Unexpected error:', err);
    rl.close();
});
