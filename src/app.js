// File: src/app.js
// Location: /claude-context-extender/src/app.js
// נקודת הכניסה הראשית לאפליקציה

'use strict';

require('dotenv').config();
const CLIManager = require('./cli/CLIManager');
const AppController = require('./controllers/AppController');
const logger = require('./utils/Logger');

/**
 * פונקציית הפעלה ראשית
 */
async function main() {
  try {
    logger.info('Starting Claude Context Extender');
    
    // יצירת בקר ראשי
    const appController = new AppController();
    
    // יצירת מנהל CLI והעברת פקודות לבקר
    const cliManager = new CLIManager(appController);
    
    // הפעלת ה-CLI
    await cliManager.start(process.argv);
    
    logger.info('Operation completed successfully');
  } catch (error) {
    logger.error('Application error:', { error: error.message, stack: error.stack });
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// הפעלת התוכנית
main();
