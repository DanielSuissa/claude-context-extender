// File: src/utils/ConfigManager.js
// Location: /claude-context-extender/src/utils/ConfigManager.js
// מנהל הגדרות האפליקציה עם לוגיקת ניפוי שגיאות משופרת

'use strict';

const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');

class ConfigManager {
  constructor() {
    console.log('[ConfigManager] Initializing...');
    
    this.config = {}; // הגדרות נוכחיות
    this.defaultConfigPath = path.join(process.cwd(), 'config', 'default.json');
    this.userConfigPath = path.join(process.cwd(), 'config', 'user.json');
    
    // יצירת תיקיית ההגדרות אם לא קיימת
    try {
      fs.ensureDirSync(path.dirname(this.defaultConfigPath));
      console.log(`[ConfigManager] Config directory ensured: ${path.dirname(this.defaultConfigPath)}`);
    } catch (error) {
      console.error(`[ConfigManager] Error ensuring config directory: ${error.message}`);
    }
    
    // טעינת ההגדרות
    this._loadConfig();
    
    // הדפסת סטטוס האתחול
    this._logInitializationStatus();
  }

  /**
   * קבלת ערך הגדרה
   * @param {string} key - מפתח ההגדרה (למשל 'claude.maxTokens')
   * @param {*} [defaultValue] - ערך ברירת מחדל אם ההגדרה לא קיימת
   * @returns {*} - ערך ההגדרה
   */
  get(key, defaultValue = undefined) {
    const value = _.get(this.config, key, defaultValue);
    // console.log(`[ConfigManager] get('${key}') => ${JSON.stringify(value)}`);
    return value;
  }

  /**
   * הגדרת ערך הגדרה
   * @param {string} key - מפתח ההגדרה
   * @param {*} value - ערך ההגדרה
   */
  set(key, value) {
    // console.log(`[ConfigManager] set('${key}', ${JSON.stringify(value)})`);
    _.set(this.config, key, value);
  }

  /**
   * קבלת כל ההגדרות
   * @returns {Object} - אובייקט ההגדרות המלא
   */
  getAll() {
    return _.cloneDeep(this.config);
  }

  /**
   * שמירת ההגדרות
   * @returns {Promise<void>}
   */
  async save() {
    try {
      console.log(`[ConfigManager] Saving configuration to ${this.userConfigPath}`);
      await fs.writeJson(this.userConfigPath, this.config, { spaces: 2 });
      console.log('[ConfigManager] Configuration saved successfully');
    } catch (error) {
      console.error(`[ConfigManager] Error saving configuration: ${error.message}`);
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * טעינת ההגדרות מהקבצים
   * @private
   */
  _loadConfig() {
    console.log('[ConfigManager] Loading configuration...');
    
    // טעינת הגדרות ברירת מחדל
    try {
      if (fs.existsSync(this.defaultConfigPath)) {
        console.log(`[ConfigManager] Default config exists at ${this.defaultConfigPath}`);
        const defaultConfig = this._loadConfigFile(this.defaultConfigPath);
        this.config = defaultConfig;
        console.log('[ConfigManager] Default config loaded successfully');
      } else {
        console.log('[ConfigManager] Default config not found, creating...');
        // יצירת קובץ הגדרות ברירת מחדל אם לא קיים
        this._createDefaultConfig();
      }
    } catch (error) {
      console.error(`[ConfigManager] Error loading default configuration: ${error.message}`);
      console.log('[ConfigManager] Using initial config as fallback');
      this.config = this._getInitialConfig();
    }
    
    // טעינת הגדרות משתמש אם קיימות
    try {
      if (fs.existsSync(this.userConfigPath)) {
        console.log(`[ConfigManager] User config exists at ${this.userConfigPath}`);
        const userConfig = this._loadConfigFile(this.userConfigPath);
        // מיזוג עם הגדרות ברירת מחדל
        this.config = _.merge({}, this.config, userConfig);
        console.log('[ConfigManager] User config merged successfully');
      } else {
        console.log('[ConfigManager] No user config found (this is normal)');
      }
    } catch (error) {
      console.error(`[ConfigManager] Error loading user configuration: ${error.message}`);
    }
    
    console.log(`[ConfigManager] Configuration loaded with ${Object.keys(this.config).length} top-level keys`);
  }

  /**
   * הדפסת סטטוס האתחול
   * @private
   */
  _logInitializationStatus() {
    console.log('\n[ConfigManager] Initialization Status:');
    console.log(`- Default config path: ${this.defaultConfigPath}`);
    console.log(`- User config path: ${this.userConfigPath}`);
    
    // בדיקת ערכי מפתח חשובים
    const criticalKeys = [
      'claude.model',
      'claude.maxTokens', 
      'chunking.chunkSizePercentage'
    ];
    
    for (const key of criticalKeys) {
      const value = this.get(key);
      if (value !== undefined) {
        console.log(`- ${key}: ${JSON.stringify(value)}`);
      } else {
        console.warn(`- ${key}: MISSING!`);
      }
    }
    
    console.log('[ConfigManager] Initialization complete\n');
  }

  /**
   * טעינת קובץ הגדרות
   * @param {string} filePath - נתיב לקובץ ההגדרות
   * @returns {Object} - אובייקט ההגדרות
   * @private
   */
  _loadConfigFile(filePath) {
    try {
      const config = fs.readJsonSync(filePath);
      
      // בדיקה שאכן קיבלנו אובייקט
      if (!config || typeof config !== 'object') {
        throw new Error('Config file does not contain a valid object');
      }
      
      return config;
    } catch (error) {
      console.error(`[ConfigManager] Error reading config file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * יצירת קובץ הגדרות ברירת מחדל
   * @private
   */
  _createDefaultConfig() {
    try {
      const defaultConfig = this._getInitialConfig();
      fs.writeJsonSync(this.defaultConfigPath, defaultConfig, { spaces: 2 });
      this.config = defaultConfig;
      console.log(`[ConfigManager] Created default config at ${this.defaultConfigPath}`);
    } catch (error) {
      console.error(`[ConfigManager] Error creating default configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * קבלת הגדרות ברירת מחדל ראשוניות
   * @returns {Object} - אובייקט הגדרות התחלתי
   * @private
   */
  _getInitialConfig() {
    console.log('[ConfigManager] Building initial config object');
    
    return {
      // הגדרות קלוד
      claude: {
        model: 'claude-3-opus-20240229',
        maxTokens: 100000,
        responseMaxTokens: 4000,
        defaultSystemPrompt: 'You are a helpful AI assistant with access to a large document. Answer questions based only on the content provided.'
      },
      
      // הגדרות עיבוד קבצים
      fileProcessing: {
        supportedTextExtensions: ['.txt', '.md', '.json', '.js', '.py', '.html', '.css', '.csv', '.xml', '.yaml', '.yml'],
        supportedPdfExtensions: ['.pdf'],
        maxFileSizeInMemoryMb: 50
      },
      
      // הגדרות חלוקה לקטעים
      chunking: {
        chunkSizePercentage: 40,
        overlapPercentage: 10,
        preserveParagraphs: true
      },
      
      // הגדרות אינדוקס
      indexing: {
        noIndexThresholdPercentage: 30, // אחוז מחלון ההקשר שמתחתיו לא ניצור אינדקס מלא
        maxOverallSummaryLength: 2000
      },
      
      // הגדרות שאילתה
      query: {
        maxChunksPerQuery: 5,
        stopWords: ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'of', 'to', 'in', 'on', 'by', 'with', 'about', 'for', 'from'],
        // הגדרות לגישת חיפוש סמנטי באמצעות LLM
        useSplitStrategyForLargeIndices: true,
        llmChunkSize: 50
      },
      
      // הגדרות שיחה
      conversation: {
        maxRecentExchanges: 5,
        maxSummaryTokens: 500,
        mergeFrequency: 3
      },
      
      // תבניות פרומפט
      prompts: {
        summarizeTemplate: `
          Please analyze the following content and provide:
          1. A concise summary (3-5 sentences)
          2. 5-10 important keywords or key phrases that represent the main topics
          
          Format your response exactly like this:
          Summary: [your summary here]
          
          Keywords: [keyword1], [keyword2], [keyword3], etc.
          
          Content to analyze:
          {{CONTENT}}
        `,
        
        answerTemplate: `
          You are assisting with questions about a document. Please answer based only on the information provided.
          
          {{HISTORY}}
          
          {{RELEVANT_INFO}}
          
          USER QUESTION: {{QUESTION}}
          
          Provide a clear, concise answer based only on the relevant information provided above. If the information doesn't contain the answer, say "I don't have information about that in the provided content."
        `
      }
    };
  }
}

// סינגלטון אחד לכל האפליקציה
const configManager = new ConfigManager();
module.exports = configManager;