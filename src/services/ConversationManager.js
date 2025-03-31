// File: src/services/ConversationManager.js
// Location: /claude-context-extender/src/services/ConversationManager.js
// שירות לניהול שיחות ושמירת היסטוריית השיחה

'use strict';

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const configManager = require('../utils/ConfigManager');
const logger = require('../utils/Logger');
const ClaudeClient = require('./ClaudeClient');

class ConversationManager {
  constructor() {
    this.config = configManager;
    this.conversationsDir = path.join(process.cwd(), 'data', 'conversations');
    this.claudeClient = new ClaudeClient();
    
    // יצירת תיקיית השיחות אם לא קיימת
    fs.ensureDirSync(this.conversationsDir);
    
    logger.debug('ConversationManager initialized');
  }

  /**
   * יצירת שיחה חדשה
   * @param {string} indexId - מזהה האינדקס הקשור לשיחה
   * @returns {Promise<Object>} - אובייקט השיחה החדשה
   */
  async createConversation(indexId) {
    try {
      const conversationId = uuidv4();
      logger.info(`Creating new conversation: ${conversationId}`, { indexId });
      
      const conversation = {
        id: conversationId,
        indexId: indexId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // שמירת X חילופים אחרונים במלואם
        recentExchanges: [],
        // סיכום של שיחה ישנה יותר
        historySummary: '',
        // ספירת סך כל החילופים
        exchangeCount: 0,
        // מתי בוצע המיזוג האחרון
        lastMergeCount: 0
      };
      
      await this._saveConversation(conversationId, conversation);
      
      return conversation;
    } catch (error) {
      logger.error('Error creating conversation', { error: error.message });
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }

  /**
   * קבלת שיחה לפי מזהה
   * @param {string} conversationId - מזהה השיחה
   * @returns {Promise<Object>} - אובייקט השיחה
   */
  async getConversation(conversationId) {
    try {
      const conversationPath = path.join(this.conversationsDir, `${conversationId}.json`);
      if (!await fs.pathExists(conversationPath)) {
        logger.warn(`Conversation not found: ${conversationId}`);
        return null;
      }
      
      const conversationData = await fs.readJson(conversationPath);
      logger.debug(`Loaded conversation: ${conversationId}`);
      return conversationData;
    } catch (error) {
      logger.error(`Error loading conversation: ${conversationId}`, { error: error.message });
      throw new Error(`Failed to load conversation: ${error.message}`);
    }
  }

  /**
   * רשימת כל השיחות
   * @param {string} [indexId] - מזהה אינדקס לסינון (אופציונלי)
   * @returns {Promise<Array>} - רשימת שיחות
   */
  async listConversations(indexId = null) {
    try {
      const files = await fs.readdir(this.conversationsDir);
      const conversations = [];
      
      for (const file of files) {
        if (path.extname(file) === '.json') {
          try {
            const conversationId = path.basename(file, '.json');
            const conversationData = await this.getConversation(conversationId);
            
            if (conversationData && (!indexId || conversationData.indexId === indexId)) {
              conversations.push({
                id: conversationId,
                indexId: conversationData.indexId,
                createdAt: conversationData.createdAt,
                updatedAt: conversationData.updatedAt,
                exchangeCount: conversationData.exchangeCount
              });
            }
          } catch (error) {
            logger.warn(`Error loading conversation from file: ${file}`, { error: error.message });
            // נמשיך לקובץ הבא
          }
        }
      }
      
      return conversations;
    } catch (error) {
      logger.error('Error listing conversations', { error: error.message });
      throw new Error(`Failed to list conversations: ${error.message}`);
    }
  }

  /**
   * מחיקת שיחה
   * @param {string} conversationId - מזהה השיחה
   * @returns {Promise<boolean>} - האם המחיקה הצליחה
   */
  async deleteConversation(conversationId) {
    try {
      const conversationPath = path.join(this.conversationsDir, `${conversationId}.json`);
      
      if (!await fs.pathExists(conversationPath)) {
        logger.warn(`Conversation not found for deletion: ${conversationId}`);
        return false;
      }
      
      await fs.remove(conversationPath);
      logger.info(`Deleted conversation: ${conversationId}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting conversation: ${conversationId}`, { error: error.message });
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }

  /**
   * הוספת חילוף לשיחה (שאלה ותשובה)
   * @param {string} conversationId - מזהה השיחה
   * @param {string} question - שאלת המשתמש
   * @param {string} answer - תשובת המערכת
   * @returns {Promise<Object>} - השיחה המעודכנת
   */
  async addExchange(conversationId, question, answer) {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      // יצירת אובייקט חילוף חדש
      const exchange = {
        timestamp: new Date().toISOString(),
        question,
        answer
      };
      
      // מספר החילופים המקסימלי לשמירה בזיכרון
      const maxRecentExchanges = this.config.get('conversation.maxRecentExchanges') || 5;
      
      // תדירות המיזוג (כל כמה חילופים)
      const mergeFrequency = this.config.get('conversation.mergeFrequency') || 3;
      
      // עדכון השיחה
      conversation.recentExchanges.push(exchange);
      conversation.exchangeCount += 1;
      conversation.updatedAt = new Date().toISOString();
      
      // בדיקה אם צריך למזג חילופים לסיכום
      if (conversation.recentExchanges.length > maxRecentExchanges && 
          conversation.exchangeCount - conversation.lastMergeCount >= mergeFrequency) {
        await this._mergeExchangesToSummary(conversation, maxRecentExchanges);
      }
      
      // שמירת השיחה המעודכנת
      await this._saveConversation(conversationId, conversation);
      
      return conversation;
    } catch (error) {
      logger.error(`Error adding exchange to conversation: ${conversationId}`, { error: error.message });
      throw new Error(`Failed to add exchange: ${error.message}`);
    }
  }

  /**
   * בניית פרומפט לקלוד המשלב היסטוריית שיחה וקטעים רלוונטיים
   * @param {Object} conversation - אובייקט השיחה
   * @param {string} question - שאלה נוכחית
   * @param {Object} index - אובייקט האינדקס
   * @param {Array} relevantChunks - קטעים רלוונטיים לשאלה
   * @returns {Promise<string>} - פרומפט מוכן
   */
  async buildPrompt(conversation, question, index, relevantChunks) {
    try {
      // טעינת תבנית הפרומפט מההגדרות
      let promptTemplate = this.config.get('prompts.answerTemplate');
      
      // יצירת החלק של ההיסטוריה
      let historySection = '';
      
      // אם יש סיכום היסטוריה, נוסיף אותו
      if (conversation.historySummary) {
        historySection += `### Previous Conversation Summary:\n${conversation.historySummary}\n\n`;
      }
      
      // הוספת החילופים האחרונים במלואם
      if (conversation.recentExchanges.length > 0) {
        historySection += `### Recent Conversation:\n`;
        
        for (const exchange of conversation.recentExchanges) {
          historySection += `User: ${exchange.question}\n\nAssistant: ${exchange.answer}\n\n`;
        }
      }
      
      // יצירת החלק של המידע הרלוונטי
      let relevantInfoSection = '';
      
      // הוספת תקציר כללי של האינדקס
      relevantInfoSection += `### Document Overall Summary:\n${index.overallSummary || 'No overall summary available.'}\n\n`;
      
      // הוספת הקטעים הרלוונטיים
      relevantInfoSection += `### Relevant Content Sections:\n`;
      
      for (let i = 0; i < relevantChunks.length; i++) {
        const chunk = relevantChunks[i];
        relevantInfoSection += `#### Section ${i + 1}: ${chunk.filePath}\n${chunk.content}\n\n`;
      }
      
      // מילוי התבנית
      promptTemplate = promptTemplate
        .replace('{{HISTORY}}', historySection)
        .replace('{{RELEVANT_INFO}}', relevantInfoSection)
        .replace('{{QUESTION}}', question);
      
      return promptTemplate;
    } catch (error) {
      logger.error('Error building prompt', { error: error.message });
      throw new Error(`Failed to build prompt: ${error.message}`);
    }
  }

  // ------------------------ פונקציות עזר פנימיות ------------------------

  /**
   * שמירת שיחה לקובץ
   * @param {string} conversationId - מזהה השיחה
   * @param {Object} conversationData - נתוני השיחה
   * @returns {Promise<void>}
   * @private
   */
  async _saveConversation(conversationId, conversationData) {
    try {
      const conversationPath = path.join(this.conversationsDir, `${conversationId}.json`);
      await fs.writeJson(conversationPath, conversationData, { spaces: 2 });
      logger.debug(`Saved conversation to ${conversationPath}`);
    } catch (error) {
      logger.error(`Error saving conversation: ${conversationId}`, { error: error.message });
      throw new Error(`Failed to save conversation: ${error.message}`);
    }
  }

  /**
   * מיזוג חילופים ישנים לסיכום
   * @param {Object} conversation - אובייקט השיחה
   * @param {number} maxRecentExchanges - מספר החילופים המקסימלי לשמירה בזיכרון
   * @returns {Promise<void>}
   * @private
   */
  async _mergeExchangesToSummary(conversation, maxRecentExchanges) {
    try {
      logger.info(`Merging older exchanges to summary for conversation: ${conversation.id}`);
      
      // מספר החילופים שנרצה להעביר לסיכום
      const exchangesToMerge = conversation.recentExchanges.slice(0, conversation.recentExchanges.length - maxRecentExchanges);
      
      // עדכון רשימת החילופים האחרונים
      conversation.recentExchanges = conversation.recentExchanges.slice(conversation.recentExchanges.length - maxRecentExchanges);
      
      // אם אין מה למזג, נסיים
      if (exchangesToMerge.length === 0) {
        return;
      }
      
      // הגבלת גודל סיכום ההיסטוריה בטוקנים
      const maxSummaryTokens = this.config.get('conversation.maxSummaryTokens') || 500;
      
      // יצירת טקסט של החילופים למיזוג
      let exchangesText = '';
      for (const exchange of exchangesToMerge) {
        exchangesText += `User: ${exchange.question}\n\nAssistant: ${exchange.answer}\n\n`;
      }
      
      // בניית פרומפט למיזוג
      const summaryPrompt = `
      Here is the existing conversation summary:
      "${conversation.historySummary}"
      
      Here are the new conversation exchanges to merge:
      ${exchangesText}
      
      Please merge these new exchanges into the existing summary to create an updated summary.
      Focus on the most important and relevant information.
      Keep the summary concise, within approximately ${maxSummaryTokens} tokens (roughly ${maxSummaryTokens * 4} characters).
      `;
      
      // שליחה לקלוד ליצירת סיכום מעודכן
      const newSummary = await this.claudeClient.createConversationSummary(summaryPrompt);
      
      // עדכון הסיכום בשיחה
      conversation.historySummary = newSummary;
      
      // עדכון הספירה האחרונה של מיזוג
      conversation.lastMergeCount = conversation.exchangeCount;
      
      logger.debug(`Merged ${exchangesToMerge.length} exchanges into summary`);
    } catch (error) {
      logger.error(`Error merging exchanges to summary: ${conversation.id}`, { error: error.message });
      // במקרה של שגיאה, לא נעדכן את הסיכום
    }
  }
}

module.exports = ConversationManager;