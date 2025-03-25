const Keyv = require('keyv');
const db = new Keyv('sqlite://delhi.db');

module.exports = { db }
