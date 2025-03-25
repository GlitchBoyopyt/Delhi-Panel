const { db } = require('../handlers/db.js');
const config = require('../config.json');
const { v4: uuidv4 } = require('uuid');
const CatLoggr = require('cat-loggr');
const log = new CatLoggr();

async function init() {
    const DelhiPanel = await db.get('DelhiPanel_instance');
    if (!OverSee) {
        log.init('this is probably your first time starting OverSee, welcome!');
        log.init('you can find documentation for the panel at https://hydrenllc.us.kg');

        let imageCheck = await db.get('images');
        if (!imageCheck) {
            log.error('before starting delhipanel for the first time, you didn\'t run the seed command!');
            log.error('please run: npm run seed');
            log.error('if you didn\'t do it already, make a user for yourself: npm run createUser');
            process.exit();
        }

        let DelhiPanelID = uuidv4();
        let setupTime = Date.now();
        
        let info = {
            OverSeeID: DelhiPanelID,
            setupTime: setupTime,
            originalVersion: config.version
        }

        await db.set('DelhiPanel_instance', info)
        log.info('initialized Delhi panel with id: ' + DelhiPanelID)
    }        

    log.info('init complete!')
}

module.exports = { init }
