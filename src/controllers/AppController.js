// File: src/controllers/AppController.js
// Location: /claude-context-extender/src/controllers/AppController.js
// עדכון בקר ראשי עם שימוש בשיטה האיטרטיבית

'use strict';

const FileProcessor = require('../services/FileProcessor');
const IndexManager = require('../services/IndexManager');
const ClaudeClient = require('../services/ClaudeClient');
const ConversationManager = require('../services/ConversationManager');
const IterativeAnswerer = require('../services/IterativeAnswerer'); // Import the new service
const configManager = require('../utils/ConfigManager');
const logger = require('../utils/Logger');

class AppController {
  constructor() {
    this.fileProcessor = new FileProcessor();
    this.indexManager = new IndexManager();
    this.claudeClient = new ClaudeClient();
    this.conversationManager = new ConversationManager();
    this.iterativeAnswerer = new IterativeAnswerer(); // Initialize the new service
    this.config = configManager;
    
    logger.debug('AppController initialized');
  }

  /**
   * יוצר אינדקס מקובץ או תיקייה
   * @param {string} path - נתיב לקובץ או תיקייה
   * @param {Object} options - אפשרויות יצירת האינדקס
   * @returns {Promise<string>} - מזהה האינדקס החדש
   */
  async createIndex(path, options = {}) {
    try {
      logger.info(`Creating index for: ${path}`, { options });
      const startTime = Date.now();
      
      console.log(`Processing path for indexing: ${path}`);
      // בדיקה אם הקובץ קטן מספיק כדי להיכנס לחלון ההקשר
      const shouldCreateFullIndex = await this._shouldCreateFullIndex(path);
      
      // עיבוד הקבצים וחלוקה לקטעים
      console.log(`Starting to process path: ${path}`);
      const chunks = await this.fileProcessor.processPath(path);
      console.log(`Processed path ${path}, got ${chunks.length} chunks`);
      logger.info(`Processed ${chunks.length} chunks from ${path}`);
      
      // יצירת תקצירים ומילות מפתח באמצעות קלוד
      if (shouldCreateFullIndex) {
        console.log(`Creating full index with enriched chunks...`);
        const enrichedChunks = await this._enrichChunks(chunks);
        
        // יצירת האינדקס
        const indexId = await this.indexManager.createIndex(enrichedChunks, options);
        
        const endTime = Date.now();
        logger.logPerformance('Create index', endTime - startTime, { 
          path, 
          indexId,
          chunksCount: chunks.length
        });
        
        return indexId;
      } else {
        console.log(`Creating simplified index...`);
        // במקרה של קובץ קטן, ניתן להשתמש בקטעים כפי שהם בלי העשרה מלאה
        // אם יש רק קטע אחד, נוסיף לו תקציר בסיסי
        if (chunks.length === 1) {
          console.log(`Single chunk index, creating basic summary...`);
          const summary = await this.claudeClient.createSummary(chunks[0].content);
          chunks[0].summary = summary;
        }
        
        // יצירת אינדקס פשוט יותר
        const indexId = await this.indexManager.createIndex(chunks, options);
        
        const endTime = Date.now();
        logger.logPerformance('Create simplified index', endTime - startTime, { 
          path, 
          indexId,
          chunksCount: chunks.length
        });
        
        return indexId;
      }
    } catch (error) {
      logger.error(`Error creating index for: ${path}`, { error: error.message });
      throw new Error(`Failed to create index: ${error.message}`);
    }
  }

  /**
   * מענה לשאלה על אינדקס באמצעות השיטה האיטרטיבית
   * @param {string} indexId - מזהה האינדקס
   * @param {string} question - שאלת המשתמש
   * @param {string} conversationId - מזהה השיחה (אם ממשיכים שיחה קיימת)
   * @returns {Promise<Object>} - תשובה ומידע נוסף
   */
  async answerQuestion(indexId, question, conversationId = null) {
    try {
      logger.info(`Answering question for index: ${indexId} using iterative approach`, { conversationId });
      const startTime = Date.now();
      
      // טעינת האינדקס
      const index = await this.indexManager.loadIndex(indexId);
      if (!index) {
        throw new Error(`Index ${indexId} not found`);
      }
      
      // מציאת הקטעים הרלוונטיים לשאלה
      const relevantChunks = await this.indexManager.findRelevantChunks(index, question);
      logger.debug(`Found ${relevantChunks.length} relevant chunks`);
      
      // טיפול בשיחה
      let conversation;
      let conversationHistory = '';
      
      if (conversationId) {
        // המשך שיחה קיימת
        conversation = await this.conversationManager.getConversation(conversationId);
        if (!conversation) {
          throw new Error(`Conversation ${conversationId} not found`);
        }
        
        // הכנת היסטורית השיחה לפרומפט
        conversationHistory = this._prepareConversationHistory(conversation);
      } else {
        // יצירת שיחה חדשה
        conversation = await this.conversationManager.createConversation(indexId);
        conversationId = conversation.id;
      }
      
      // באמצעות השיטה האיטרטיבית - עיבוד קטע אחר קטע
      const answer = await this.iterativeAnswerer.generateAnswer(
        question,
        relevantChunks,
        conversationHistory
      );
      
      // עדכון היסטוריית השיחה
      await this.conversationManager.addExchange(
        conversationId,
        question,
        answer
      );
      
      const endTime = Date.now();
      logger.logPerformance('Answer question (iterative)', endTime - startTime, { 
        indexId, 
        conversationId,
        relevantChunksCount: relevantChunks.length
      });
      
      return {
        answer,
        conversationId,
        relevantChunks: relevantChunks.map(chunk => ({ id: chunk.id, relevanceScore: chunk.relevanceScore }))
      };
    } catch (error) {
      logger.error(`Error answering question for index: ${indexId}`, { error: error.message });
      throw new Error(`Failed to answer question: ${error.message}`);
    }
  }

  /**
   * הכנת היסטוריית השיחה לפרומפט
   * @param {Object} conversation - אובייקט השיחה
   * @returns {string} - היסטוריית השיחה מעובדת
   * @private
   */
  _prepareConversationHistory(conversation) {
    let history = '';
    
    // הוספת סיכום היסטוריה
    if (conversation.historySummary && conversation.historySummary.trim() !== '') {
      history += `Previous conversation summary:\n${conversation.historySummary}\n\n`;
    }
    
    // הוספת החילופים האחרונים
    if (conversation.recentExchanges && conversation.recentExchanges.length > 0) {
      history += 'Recent exchanges:\n';
      
      for (const exchange of conversation.recentExchanges) {
        history += `User: ${exchange.question}\n\nAssistant: ${exchange.answer}\n\n`;
      }
    }
    
    return history;
  }

  /**
   * רשימת כל האינדקסים
   * @returns {Promise<Array>} - רשימת האינדקסים
   */
  async listIndexes() {
    try {
      return await this.indexManager.listIndexes();
    } catch (error) {
      logger.error('Error listing indexes', { error: error.message });
      throw new Error(`Failed to list indexes: ${error.message}`);
    }
  }

  /**
   * מידע על אינדקס ספציפי
   * @param {string} indexId - מזהה האינדקס
   * @returns {Promise<Object>} - מידע על האינדקס
   */
  async getIndexInfo(indexId) {
    try {
      return await this.indexManager.getIndexInfo(indexId);
    } catch (error) {
      logger.error(`Error getting info for index: ${indexId}`, { error: error.message });
      throw new Error(`Failed to get index info: ${error.message}`);
    }
  }

  /**
   * מחיקת אינדקס
   * @param {string} indexId - מזהה האינדקס
   * @returns {Promise<boolean>} - האם המחיקה הצליחה
   */
  async deleteIndex(indexId) {
    try {
      return await this.indexManager.deleteIndex(indexId);
    } catch (error) {
      logger.error(`Error deleting index: ${indexId}`, { error: error.message });
      throw new Error(`Failed to delete index: ${error.message}`);
    }
  }

  /**
   * רשימת כל השיחות
   * @param {string} [indexId] - מזהה אינדקס (אופציונלי, לסינון)
   * @returns {Promise<Array>} - רשימת השיחות
   */
  async listConversations(indexId = null) {
    try {
      return await this.conversationManager.listConversations(indexId);
    } catch (error) {
      logger.error('Error listing conversations', { error: error.message });
      throw new Error(`Failed to list conversations: ${error.message}`);
    }
  }

  /**
   * מידע על שיחה ספציפית
   * @param {string} conversationId - מזהה השיחה
   * @returns {Promise<Object>} - מידע על השיחה
   */
  async getConversationInfo(conversationId) {
    try {
      return await this.conversationManager.getConversation(conversationId);
    } catch (error) {
      logger.error(`Error getting info for conversation: ${conversationId}`, { error: error.message });
      throw new Error(`Failed to get conversation info: ${error.message}`);
    }
  }

  /**
   * מחיקת שיחה
   * @param {string} conversationId - מזהה השיחה
   * @returns {Promise<boolean>} - האם המחיקה הצליחה
   */
  async deleteConversation(conversationId) {
    try {
      return await this.conversationManager.deleteConversation(conversationId);
    } catch (error) {
      logger.error(`Error deleting conversation: ${conversationId}`, { error: error.message });
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }

  // ------------------------ פונקציות עזר פנימיות ------------------------
  
  /**
   * בדיקה אם יש צורך ליצור אינדקס מלא
   * @param {string} path - נתיב לקובץ
   * @returns {Promise<boolean>} - האם יש צורך באינדקס מלא
   * @private
   */
  async _shouldCreateFullIndex(path) {
    try {
      console.log(`Checking if full index is needed for: ${path}`);
      const stats = await this.fileProcessor.getFileStats(path);
      
      // אם זו תיקייה, תמיד ניצור אינדקס מלא
      if (stats.isDirectory) {
        console.log(`${path} is a directory, full index is needed`);
        return true;
      }
      
      // הערכה גסה של מספר הטוקנים - לפי יחס של 4 תווים לטוקן
      const estimatedTokens = stats.totalSize / 4;
      console.log(`Estimated tokens: ${estimatedTokens}`);
      
      // גודל חלון ההקשר של קלוד
      const claudeMaxTokens = this.config.get('claude.maxTokens');
      
      // אחוז מחלון ההקשר המקסימלי שלא דורש אינדקס
      const thresholdPercentage = this.config.get('indexing.noIndexThresholdPercentage') || 30;
      const thresholdTokens = claudeMaxTokens * (thresholdPercentage / 100);
      
      console.log(`Threshold tokens: ${thresholdTokens}, Claude max tokens: ${claudeMaxTokens}`);
      return estimatedTokens > thresholdTokens;
    } catch (error) {
      console.error(`Error determining if full index is needed: ${error.message}`);
      logger.error(`Error determining if full index is needed: ${path}`, { error: error.message });
      // במקרה של ספק, ניצור אינדקס מלא
      return true;
    }
  }

  /**
   * העשרת הקטעים באמצעות קלוד (תקצירים ומילות מפתח)
   * @param {Array} chunks - מערך של קטעים
   * @returns {Promise<Array>} - קטעים מועשרים
   * @private
   */
  async _enrichChunks(chunks) {
    logger.info(`Enriching ${chunks.length} chunks with summaries and keywords`);
    console.log(`Enriching ${chunks.length} chunks with summaries and keywords...`);
    
    const enrichedChunks = [];
    
    // מעבר על כל הקטעים
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.debug(`Enriching chunk ${i+1}/${chunks.length}: ${chunk.id}`);
      console.log(`Enriching chunk ${i+1}/${chunks.length}: ${chunk.id}`);
      
      try {
        // יצירת תקציר ומילות מפתח לקטע
        console.log(`Sending chunk to Claude for summarization...`);
        const { summary, keywords } = await this.claudeClient.createSummaryAndKeywords(chunk.content);
        console.log(`Received summary (${summary.length} chars) and ${keywords.length} keywords`);
        
        // הוספת המידע לקטע
        enrichedChunks.push({
          ...chunk,
          summary,
          keywords
        });
        
        console.log(`Chunk ${i+1}/${chunks.length} enriched successfully`);
      } catch (error) {
        console.error(`Error enriching chunk ${chunk.id}: ${error.message}`);
        logger.warn(`Error enriching chunk ${chunk.id}`, { error: error.message });
        // במקרה של שגיאה, נוסיף את הקטע בלי העשרה
        enrichedChunks.push({
          ...chunk,
          summary: 'Summary generation failed',
          keywords: []
        });
        console.log(`Added chunk without enrichment due to error`);
      }
      const calculateWaitTime = (inputString, tokenRatePerMinute) => Math.ceil(((inputString.length / 4) / tokenRatePerMinute) * 60 * 1000);
      await new Promise(resolve => setTimeout(resolve, calculateWaitTime(chunk.content, 50000)));
    }
    
    console.log(`Enrichment complete. Enriched ${enrichedChunks.length} chunks.`);
    return enrichedChunks;
  }
}

module.exports = AppController;