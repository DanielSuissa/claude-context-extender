// File: src/cli/CLIManager.js
// Location: /claude-context-extender/src/cli/CLIManager.js
// מנהל ממשק שורת הפקודה

'use strict';

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const logger = require('../utils/Logger');
const configManager = require('../utils/ConfigManager');

class CLIManager {
  constructor(appController) {
    this.appController = appController;
    this.program = new Command();
    this.config = configManager;
    
    this._setupProgram();
    
    logger.debug('CLIManager initialized');
  }

  /**
   * מגדיר את התוכנית וכל הפקודות
   * @private
   */
  _setupProgram() {
    this.program
      .name('context-extender')
      .description('CLI tool for extending Claude\'s context window capabilities')
      .version('1.0.0');
    
    // פקודת יצירת אינדקס
    this.program
      .command('index <path>')
      .description('Create an index from a file or directory')
      .option('-n, --name <name>', 'Name for the index')
      .option('-s, --store-content', 'Store content in the index (uses more space)')
      .action(async (path, options) => {
        try {
          console.log(chalk.blue(`Creating index for: ${path}`));
          const indexId = await this.appController.createIndex(path, options);
          console.log(chalk.green(`✅ Index created successfully with ID: ${indexId}`));
        } catch (error) {
          console.error(chalk.red(`❌ Error: ${error.message}`));
        }
      });
    
    // פקודת שאילתה
    this.program
      .command('query [indexId]')
      .description('Query an index')
      .option('-q, --question <question>', 'Question to ask')
      .option('-c, --conversation <id>', 'Conversation ID to continue')
      .action(async (indexId, options) => {
        try {
          await this._handleQuery(indexId, options);
        } catch (error) {
          console.error(chalk.red(`❌ Error: ${error.message}`));
        }
      });
    
    // פקודת רשימת אינדקסים
    this.program
      .command('list')
      .description('List all available indexes')
      .action(async () => {
        try {
          const indexes = await this.appController.listIndexes();
          console.log(chalk.blue(`Found ${indexes.length} indexes:`));
          
          if (indexes.length === 0) {
            console.log('No indexes found. Create one with the `index` command.');
            return;
          }
          
          indexes.forEach(index => {
            console.log(`- ${chalk.green(index.id)}: ${index.name} (${index.chunkCount} chunks, created: ${new Date(index.createdAt).toLocaleString()})`);
          });
        } catch (error) {
          console.error(chalk.red(`❌ Error: ${error.message}`));
        }
      });
    
    // פקודת מידע על אינדקס
    this.program
      .command('info <indexId>')
      .description('Get information about an index')
      .action(async (indexId) => {
        try {
          const indexInfo = await this.appController.getIndexInfo(indexId);
          
          if (!indexInfo) {
            console.log(chalk.yellow(`Index not found: ${indexId}`));
            return;
          }
          
          console.log(chalk.blue(`Information for index: ${indexId}`));
          console.log(`Name: ${indexInfo.name}`);
          console.log(`Created: ${new Date(indexInfo.createdAt).toLocaleString()}`);
          console.log(`Updated: ${new Date(indexInfo.updatedAt).toLocaleString()}`);
          console.log(`Chunks: ${indexInfo.chunkCount}`);
          console.log(`Keywords: ${indexInfo.keywords.length > 0 ? indexInfo.keywords.slice(0, 10).join(', ') + (indexInfo.keywords.length > 10 ? '...' : '') : 'None'}`);
          console.log('\nOverall Summary:');
          console.log(chalk.gray(indexInfo.overallSummary || 'No summary available'));
        } catch (error) {
          console.error(chalk.red(`❌ Error: ${error.message}`));
        }
      });
    
    // פקודת מחיקת אינדקס
    this.program
      .command('delete <indexId>')
      .description('Delete an index')
      .action(async (indexId) => {
        try {
          // אישור לפני מחיקה
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete index: ${indexId}?`,
            default: false
          }]);
          
          if (!confirm) {
            console.log(chalk.yellow('Operation cancelled'));
            return;
          }
          
          const success = await this.appController.deleteIndex(indexId);
          
          if (success) {
            console.log(chalk.green(`✅ Index ${indexId} deleted successfully`));
          } else {
            console.log(chalk.yellow(`Index not found: ${indexId}`));
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error: ${error.message}`));
        }
      });
    
    // פקודת הגדרות
    this.program
      .command('config')
      .description('View or update configuration')
      .option('-v, --view', 'View current configuration')
      .option('-u, --update', 'Update configuration')
      .action(async (options) => {
        try {
          if (options.view) {
            this._viewConfig();
          } else if (options.update) {
            await this._updateConfig();
          } else {
            // אם לא הוגדרה אפשרות, נציג את ההגדרות
            this._viewConfig();
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error: ${error.message}`));
        }
      });
    
    // פקודת רשימת שיחות
    this.program
      .command('conversations [indexId]')
      .description('List conversations, optionally filtered by index ID')
      .action(async (indexId) => {
        try {
          const conversations = await this.appController.listConversations(indexId);
          console.log(chalk.blue(`Found ${conversations.length} conversations${indexId ? ` for index ${indexId}` : ''}:`));
          
          if (conversations.length === 0) {
            console.log('No conversations found.');
            return;
          }
          
          conversations.forEach(conversation => {
            console.log(`- ${chalk.green(conversation.id)}: Index ${conversation.indexId} (${conversation.exchangeCount} exchanges, updated: ${new Date(conversation.updatedAt).toLocaleString()})`);
          });
        } catch (error) {
          console.error(chalk.red(`❌ Error: ${error.message}`));
        }
      });
  }

  /**
   * התחלת ה-CLI
   * @param {Array} argv - ארגומנטים משורת הפקודה
   */
  async start(argv) {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      logger.error('CLI error', { error: error.message });
      console.error(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  /**
   * טיפול בפקודת שאילתה
   * @param {string} indexId - מזהה האינדקס
   * @param {Object} options - אפשרויות השאילתה
   * @private
   */
  async _handleQuery(indexId, options) {
    // אם לא נמסר מזהה אינדקס, נבקש מהמשתמש לבחור
    if (!indexId) {
      const indexes = await this.appController.listIndexes();
      
      if (indexes.length === 0) {
        console.log(chalk.yellow('No indexes found. Create one with the `index` command first.'));
        return;
      }
      
      const { selectedIndex } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedIndex',
        message: 'Select an index:',
        choices: indexes.map(idx => ({
          name: `${idx.name} (${idx.chunkCount} chunks)`,
          value: idx.id
        }))
      }]);
      
      indexId = selectedIndex;
    }
    
    // התחלת מצב אינטראקטיבי או שימוש בשאלה שסופקה
    let conversation = null;
    let conversationId = options.conversation;
    
    if (conversationId) {
      conversation = await this.appController.getConversationInfo(conversationId);
      if (!conversation) {
        console.log(chalk.yellow(`Conversation not found: ${conversationId}`));
        conversationId = null;
      } else if (conversation.indexId !== indexId) {
        console.log(chalk.yellow(`Conversation ${conversationId} is associated with a different index (${conversation.indexId})`));
        const { shouldContinue } = await inquirer.prompt([{
          type: 'confirm',
          name: 'shouldContinue',
          message: 'Do you want to continue with this conversation anyway?',
          default: false
        }]);
        
        if (!shouldContinue) {
          conversationId = null;
        }
      }
    }
    
    // אם יש שאלה בארגומנטים, נשתמש בה
    if (options.question) {
      await this._processQuestion(indexId, options.question, conversationId);
      return;
    }
    
    // מצב אינטראקטיבי
    console.log(chalk.blue(`Starting interactive query mode for index: ${indexId}`));
    console.log(chalk.gray('Type "exit" or "quit" to end the session\n'));
    
    let exitRequested = false;
    
    while (!exitRequested) {
      const { question } = await inquirer.prompt([{
        type: 'input',
        name: 'question',
        message: 'Ask a question:',
        validate: input => input.trim().length > 0 || 'Please enter a question'
      }]);
      
      const normalizedQuestion = question.trim().toLowerCase();
      
      // בדיקה אם המשתמש ביקש לצאת
      if (normalizedQuestion === 'exit' || normalizedQuestion === 'quit') {
        exitRequested = true;
        console.log(chalk.blue('Exiting interactive mode'));
        continue;
      }
      
      // עיבוד השאלה
      const result = await this._processQuestion(indexId, question, conversationId);
      
      // שמירת מזהה השיחה להמשך
      if (result && result.conversationId) {
        conversationId = result.conversationId;
      }
    }
  }

  /**
   * עיבוד שאלה ספציפית
   * @param {string} indexId - מזהה האינדקס
   * @param {string} question - השאלה לעיבוד
   * @param {string} conversationId - מזהה שיחה (אם קיים)
   * @returns {Promise<Object>} - תוצאת העיבוד
   * @private
   */
  async _processQuestion(indexId, question, conversationId) {
    try {
      console.log(chalk.gray('Processing question...'));
      
      // בקשת תשובה מהבקר
      const result = await this.appController.answerQuestion(indexId, question, conversationId);
      
      // הצגת התשובה
      console.log(chalk.green('\nAnswer:'));
      console.log(result.answer);
      console.log('\n');
      
      return result;
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      return null;
    }
  }

  /**
   * הצגת ההגדרות הנוכחיות
   * @private
   */
  _viewConfig() {
    const config = this.config.getAll();
    console.log(chalk.blue('Current Configuration:'));
    console.log(JSON.stringify(config, null, 2));
  }

  /**
   * עדכון הגדרות
   * @private
   */
  async _updateConfig() {
    const config = this.config.getAll();
    
    console.log(chalk.blue('Update Configuration:'));
    console.log(chalk.gray('Press Enter to keep the current value'));
    
    // יצירת שאלות עבור כל ההגדרות הניתנות לעריכה
    const questions = [];
    
    // הגדרות קלוד
    questions.push({
      type: 'input',
      name: 'claude.model',
      message: 'Claude model:',
      default: config.claude.model
    });
    
    questions.push({
      type: 'input',
      name: 'claude.maxTokens',
      message: 'Claude max tokens (context window):',
      default: String(config.claude.maxTokens),
      validate: value => !isNaN(value) || 'Please enter a number'
    });
    
    // הגדרות החלוקה לקטעים
    questions.push({
      type: 'input',
      name: 'chunking.chunkSizePercentage',
      message: 'Chunk size (% of context window):',
      default: String(config.chunking.chunkSizePercentage),
      validate: value => {
        const num = Number(value);
        return (!isNaN(num) && num > 0 && num <= 100) || 'Please enter a number between 1 and 100';
      }
    });
    
    // הגדרות שיחה
    questions.push({
      type: 'input',
      name: 'conversation.maxRecentExchanges',
      message: 'Max number of recent exchanges to keep:',
      default: String(config.conversation.maxRecentExchanges),
      validate: value => !isNaN(value) || 'Please enter a number'
    });
    
    questions.push({
      type: 'input',
      name: 'conversation.mergeFrequency',
      message: 'Merge conversation history every X exchanges:',
      default: String(config.conversation.mergeFrequency),
      validate: value => !isNaN(value) || 'Please enter a number'
    });
    
    // קבלת התשובות מהמשתמש
    const answers = await inquirer.prompt(questions);
    
    // עדכון ההגדרות
    for (const [key, value] of Object.entries(answers)) {
      if (value) {
        const parts = key.split('.');
        
        // המרת ערכים מספריים
        let processedValue = value;
        if (!isNaN(value) && value !== '') {
          processedValue = Number(value);
        }
        
        this.config.set(key, processedValue);
      }
    }
    
    // שמירת ההגדרות
    await this.config.save();
    
    console.log(chalk.green('✅ Configuration updated successfully'));
  }
}

module.exports = CLIManager;
