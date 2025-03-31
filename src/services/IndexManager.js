// File: src/services/IndexManager.js
// Location: /claude-context-extender/src/services/IndexManager.js
// שירות לניהול אינדקסים - יצירה, שמירה, טעינה וחיפוש

'use strict';

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const configManager = require('../utils/ConfigManager');
const logger = require('../utils/Logger');
const ClaudeClient = require('./ClaudeClient'); // Import ClaudeClient for LLM-based retrieval

class IndexManager {
  constructor() {
    this.config = configManager;
    this.indexesDir = path.join(process.cwd(), 'data', 'indexes');
    this.claudeClient = new ClaudeClient(); // Initialize Claude client for semantic search
    
    // יצירת תיקיית האינדקסים אם לא קיימת
    fs.ensureDirSync(this.indexesDir);
    
    logger.debug('IndexManager initialized');
  }

  /**
   * יצירת אינדקס חדש מקטעים מועשרים
   * @param {Array} enrichedChunks - קטעים עם תקצירים ומילות מפתח
   * @param {Object} options - אפשרויות יצירת האינדקס
   * @returns {Promise<string>} - מזהה האינדקס החדש
   */
  async createIndex(enrichedChunks, options = {}) {
    try {
      // יצירת מזהה אינדקס חדש
      const indexId = options.name ? this._normalizeIndexName(options.name) : uuidv4();
      logger.info(`Creating new index: ${indexId}`);
      
      // יצירת המבנה הבסיסי של האינדקס
      const index = {
        id: indexId,
        name: options.name || indexId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        chunkCount: enrichedChunks.length,
        options: {
          ...options,
        },
        // אינדקס מילות מפתח - ממפה מילת מפתח למערך של מזהי קטעים
        keywordsIndex: {},
        // אחסון הקטעים והתקצירים שלהם
        chunks: {}
      };
      
      // בניית אינדקס המילים והקטעים
      for (const chunk of enrichedChunks) {
        // שמירת הקטע באינדקס
        index.chunks[chunk.id] = {
          id: chunk.id,
          filePath: chunk.filePath,
          summary: chunk.summary,
          keywords: chunk.keywords,
          startPosition: chunk.startPosition,
          endPosition: chunk.endPosition,
          // שמירת תוכן הקטע רק אם הוגדר כך בהגדרות
          content: options.storeContent ? chunk.content : null
        };
        
        // הוספת מילות המפתח לאינדקס
        for (const keyword of chunk.keywords) {
          if (!index.keywordsIndex[keyword]) {
            index.keywordsIndex[keyword] = [];
          }
          if (!index.keywordsIndex[keyword].includes(chunk.id)) {
            index.keywordsIndex[keyword].push(chunk.id);
          }
        }
      }
      
      // יצירת תקציר כללי למסמך
      index.overallSummary = await this._createOverallSummary(enrichedChunks);
      
      // שמירת האינדקס
      await this._saveIndex(indexId, index);
      
      logger.info(`Index created successfully: ${indexId}`);
      return indexId;
    } catch (error) {
      logger.error('Error creating index', { error: error.message });
      throw new Error(`Failed to create index: ${error.message}`);
    }
  }

  /**
   * טעינת אינדקס לפי מזהה
   * @param {string} indexId - מזהה אינדקס
   * @returns {Promise<Object>} - אובייקט האינדקס
   */
  async loadIndex(indexId) {
    try {
      const indexPath = path.join(this.indexesDir, `${indexId}.json`);
      if (!await fs.pathExists(indexPath)) {
        logger.warn(`Index not found: ${indexId}`);
        return null;
      }
      
      const indexData = await fs.readJson(indexPath);
      logger.debug(`Loaded index: ${indexId}`);
      return indexData;
    } catch (error) {
      logger.error(`Error loading index: ${indexId}`, { error: error.message });
      throw new Error(`Failed to load index: ${error.message}`);
    }
  }

  /**
   * רשימת כל האינדקסים
   * @returns {Promise<Array>} - רשימת מזהי ופרטי אינדקסים
   */
  async listIndexes() {
    try {
      const files = await fs.readdir(this.indexesDir);
      const indexes = [];
      
      for (const file of files) {
        if (path.extname(file) === '.json') {
          try {
            const indexId = path.basename(file, '.json');
            const indexData = await this.loadIndex(indexId);
            
            if (indexData) {
              indexes.push({
                id: indexId,
                name: indexData.name,
                chunkCount: indexData.chunkCount,
                createdAt: indexData.createdAt,
                updatedAt: indexData.updatedAt
              });
            }
          } catch (error) {
            logger.warn(`Error loading index from file: ${file}`, { error: error.message });
            // נמשיך לקובץ הבא
          }
        }
      }
      
      return indexes;
    } catch (error) {
      logger.error('Error listing indexes', { error: error.message });
      throw new Error(`Failed to list indexes: ${error.message}`);
    }
  }

  /**
   * קבלת מידע על אינדקס ספציפי
   * @param {string} indexId - מזהה אינדקס
   * @returns {Promise<Object>} - מידע על האינדקס
   */
  async getIndexInfo(indexId) {
    try {
      const index = await this.loadIndex(indexId);
      if (!index) {
        return null;
      }
      
      // החזרת מידע בסיסי על האינדקס, בלי כל הקטעים
      return {
        id: index.id,
        name: index.name,
        chunkCount: index.chunkCount,
        createdAt: index.createdAt,
        updatedAt: index.updatedAt,
        options: index.options,
        overallSummary: index.overallSummary,
        keywords: Object.keys(index.keywordsIndex),
        chunks: Object.keys(index.chunks).map(chunkId => ({
          id: chunkId,
          filePath: index.chunks[chunkId].filePath,
          summary: index.chunks[chunkId].summary
        }))
      };
    } catch (error) {
      logger.error(`Error getting index info: ${indexId}`, { error: error.message });
      throw new Error(`Failed to get index info: ${error.message}`);
    }
  }

  /**
   * מחיקת אינדקס
   * @param {string} indexId - מזהה אינדקס
   * @returns {Promise<boolean>} - האם המחיקה הצליחה
   */
  async deleteIndex(indexId) {
    try {
      const indexPath = path.join(this.indexesDir, `${indexId}.json`);
      
      if (!await fs.pathExists(indexPath)) {
        logger.warn(`Index not found for deletion: ${indexId}`);
        return false;
      }
      
      await fs.remove(indexPath);
      logger.info(`Deleted index: ${indexId}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting index: ${indexId}`, { error: error.message });
      throw new Error(`Failed to delete index: ${error.message}`);
    }
  }

  /**
   * מציאת קטעים רלוונטיים לשאלה באמצעות מודל השפה
   * @param {Object} index - אובייקט אינדקס
   * @param {string} question - שאלת המשתמש
   * @returns {Promise<Array>} - מערך קטעים רלוונטיים
   */
  async findRelevantChunks(index, question) {
    try {
      logger.info(`Finding relevant chunks for question using LLM approach`);
      console.log(`Finding relevant chunks for question: "${question}"`);
      
      // מגבלת מספר הקטעים המוחזרים
      const maxChunksToReturn = this.config.get('query.maxChunksPerQuery') || 5;
      
      // האם להשתמש באסטרטגיית פיצול אם יש הרבה קטעים
      const useChunking = this.config.get('query.useSplitStrategyForLargeIndices') || false;
      const chunkSize = this.config.get('query.llmChunkSize') || 50;
      
      // קבלת מזהי הקטעים הרלוונטיים
      let relevantChunkIds;
      
      if (Object.keys(index.chunks).length > chunkSize && useChunking) {
        // במקרה של אינדקס גדול, נשתמש באסטרטגיית ביניים
        relevantChunkIds = await this._findRelevantChunksWithSplitStrategy(index, question, chunkSize);
      } else {
        // במקרה של אינדקס קטן, נשלח הכל במכה אחת
        relevantChunkIds = await this._findRelevantChunksSimple(index, question);
      }
      
      console.log(`LLM identified ${relevantChunkIds.length} relevant chunks: ${relevantChunkIds.join(', ')}`);
      
      // יצירת מערך התוצאות
      const relevantChunks = [];
      
      // הגבלת מספר הקטעים וטעינת התוכן שלהם
      const limitedChunkIds = relevantChunkIds.slice(0, maxChunksToReturn);
      
      for (const chunkId of limitedChunkIds) {
        if (index.chunks[chunkId]) {
          // אם התוכן לא נשמר, צריך לקרוא אותו מהקובץ
          let chunk = index.chunks[chunkId];
          
          if (!chunk.content) {
            try {
              // קריאת התוכן מהקובץ המקורי
              chunk.content = await this._readChunkFromFile(chunk.filePath, chunk.startPosition, chunk.endPosition);
            } catch (error) {
              logger.error(`Error reading chunk content: ${chunkId}`, { error: error.message });
              chunk.content = `[Error reading content: ${error.message}]`;
            }
          }
          
          // הוספת הקטע לתוצאות
          relevantChunks.push({
            ...chunk,
            relevanceScore: relevantChunkIds.indexOf(chunkId) // דירוג לפי מיקום ברשימת החשיבות
          });
        } else {
          logger.warn(`Chunk ID returned by LLM not found in index: ${chunkId}`);
        }
      }
      
      // מיון לפי דירוג הרלוונטיות
      relevantChunks.sort((a, b) => a.relevanceScore - b.relevanceScore);
      
      logger.info(`Returning ${relevantChunks.length} relevant chunks for question`);
      console.log(`Final set of relevant chunks: ${relevantChunks.map(c => c.id).join(', ')}`);
      
      return relevantChunks;
    } catch (error) {
      logger.error('Error finding relevant chunks with LLM', { error: error.message });
      console.error(`Error in semantic search: ${error.message}`);
      
      // במקרה של שגיאה, נחזור לחיפוש קלאסי מבוסס מילות מפתח
      console.log(`Falling back to keyword-based search`);
      return this._findRelevantChunksWithKeywords(index, question);
    }
  }

  /**
   * מציאת קטעים רלוונטיים באופן פשוט (שליחת כל הקטעים בבת אחת למודל השפה)
   * @param {Object} index - אובייקט אינדקס
   * @param {string} question - שאלת המשתמש
   * @returns {Promise<Array<string>>} - מערך של מזהי קטעים רלוונטיים
   * @private
   */
  async _findRelevantChunksSimple(index, question) {
    try {
      console.log(`Using simple LLM relevance detection (all chunks at once)`);
      
      // הכנת הפרומפט עם סיכומי הקטעים
      const chunkSummaries = [];
      for (const [chunkId, chunk] of Object.entries(index.chunks)) {
        chunkSummaries.push({
          id: chunkId,
          summary: chunk.summary || "No summary available"
        });
      }
      
      // בניית הפרומפט למודל השפה
      const prompt = this._buildChunkSelectionPrompt(index.overallSummary, chunkSummaries, question);
      
      // שליחה לקלוד לקבלת מזהי הקטעים הרלוונטיים
      const response = await this.claudeClient.sendPrompt(prompt, {
        temperature: 0.2, // טמפרטורה נמוכה יותר לתוצאות יותר עקביות
        system: "You are an expert retrieval system that identifies the most relevant document sections for a query."
      });
      
      // פענוח התשובה למערך של מזהי קטעים
      console.log(`Raw LLM response: ${response}`);
      const chunkIds = this._parseRelevantChunkIds(response);
      
      return chunkIds;
    } catch (error) {
      logger.error(`Error in simple LLM chunk finding`, { error: error.message });
      throw error;
    }
  }

  /**
   * מציאת קטעים רלוונטיים עם אסטרטגיית פיצול (לאינדקסים גדולים)
   * @param {Object} index - אובייקט אינדקס
   * @param {string} question - שאלת המשתמש
   * @param {number} chunkSize - גודל הקבוצה לשליחה בכל פעם
   * @returns {Promise<Array<string>>} - מערך של מזהי קטעים רלוונטיים
   * @private
   */
  async _findRelevantChunksWithSplitStrategy(index, question, chunkSize) {
    try {
      console.log(`Using split strategy for large index (${Object.keys(index.chunks).length} chunks)`);
      
      // יצירת מערך של כל הקטעים
      const allChunks = Object.entries(index.chunks).map(([id, chunk]) => ({
        id,
        summary: chunk.summary || "No summary available"
      }));
      
      // חלוקה לקבוצות
      const groups = [];
      for (let i = 0; i < allChunks.length; i += chunkSize) {
        groups.push(allChunks.slice(i, i + chunkSize));
      }
      
      console.log(`Split chunks into ${groups.length} groups of ~${chunkSize} chunks each`);
      
      // תוצאות מכל קבוצה
      const groupResults = [];
      
      // עיבוד כל קבוצה בנפרד
      for (let i = 0; i < groups.length; i++) {
        console.log(`Processing group ${i+1}/${groups.length}`);
        
        // בניית פרומפט לקבוצה זו
        const prompt = this._buildChunkSelectionPrompt(index.overallSummary, groups[i], question);
        
        // שליחה לקלוד
        const response = await this.claudeClient.sendPrompt(prompt, {
          temperature: 0.2,
          system: "You are an expert retrieval system that identifies the most relevant document sections for a query."
        });
        
        // פענוח התשובה למערך של מזהי קטעים
        const chunkIds = this._parseRelevantChunkIds(response);
        
        // שמירת החלק היחסי של הקבוצה
        const relevanceWeighted = chunkIds.map((id, index) => ({
          id,
          score: groups.length - i + (chunkIds.length - index) / chunkIds.length // חישוב משקל רלוונטיות
        }));
        
        groupResults.push(...relevanceWeighted);
      }
      
      // מיון התוצאות לפי ציון הרלוונטיות
      groupResults.sort((a, b) => b.score - a.score);
      
      // לקחת רק את המזהים, לפי סדר החשיבות
      const finalIds = groupResults.map(item => item.id);
      
      // הסרת כפילויות
      const uniqueIds = [...new Set(finalIds)];
      
      console.log(`After multi-group processing, identified ${uniqueIds.length} unique relevant chunks`);
      
      return uniqueIds;
    } catch (error) {
      logger.error(`Error in split strategy chunk finding`, { error: error.message });
      throw error;
    }
  }

  /**
   * מציאת קטעים רלוונטיים על בסיס מילות מפתח (גיבוי אם LLM נכשל)
   * @param {Object} index - אובייקט אינדקס
   * @param {string} question - שאלת המשתמש
   * @returns {Promise<Array>} - מערך קטעים רלוונטיים
   * @private
   */
  async _findRelevantChunksWithKeywords(index, question) {
    try {
      const relevantChunks = [];
      const chunkScores = {};
      
      // מיצוי מילות מפתח מהשאלה
      const questionKeywords = await this._extractKeywordsFromQuestion(question);
      
      // חישוב ציון רלוונטיות לכל קטע
      for (const keyword of questionKeywords) {
        const matchingChunkIds = index.keywordsIndex[keyword] || [];
        
        for (const chunkId of matchingChunkIds) {
          if (!chunkScores[chunkId]) {
            chunkScores[chunkId] = 0;
          }
          chunkScores[chunkId] += 1;
        }
      }
      
      // מיון הקטעים לפי ציון רלוונטיות
      const sortedChunkIds = Object.keys(chunkScores).sort((a, b) => 
        chunkScores[b] - chunkScores[a]
      );
      
      // מגבלת מספר הקטעים המוחזרים
      const maxChunksToReturn = this.config.get('query.maxChunksPerQuery');
      
      // החזרת הקטעים הרלוונטיים ביותר
      for (let i = 0; i < Math.min(sortedChunkIds.length, maxChunksToReturn); i++) {
        const chunkId = sortedChunkIds[i];
        
        // אם התוכן לא נשמר, צריך לקרוא אותו מהקובץ
        let chunk = index.chunks[chunkId];
        
        if (!chunk.content) {
          // קריאת התוכן מהקובץ המקורי
          chunk.content = await this._readChunkFromFile(chunk.filePath, chunk.startPosition, chunk.endPosition);
        }
        
        relevantChunks.push({
          ...chunk,
          relevanceScore: chunkScores[chunkId]
        });
      }
      
      return relevantChunks;
    } catch (error) {
      logger.error('Error in keyword fallback search', { error: error.message });
      throw error;
    }
  }

  /**
   * בניית פרומפט לבחירת קטעים רלוונטיים
   * @param {string} overallSummary - סיכום כללי של המסמך
   * @param {Array} chunkSummaries - מערך של סיכומי קטעים
   * @param {string} question - שאלת המשתמש
   * @returns {string} - פרומפט מוכן למודל השפה
   * @private
   */
  _buildChunkSelectionPrompt(overallSummary, chunkSummaries, question) {
    let prompt = `I need your help identifying the most relevant document sections to answer a user's question.

Document Overview:
${overallSummary || "No overall summary available."}

Available Sections:
`;

    // הוספת רשימת הקטעים וסיכומיהם
    for (let i = 0; i < chunkSummaries.length; i++) {
      prompt += `${i+1}. ID: ${chunkSummaries[i].id}
   Summary: ${chunkSummaries[i].summary}

`;
    }

    prompt += `User Question: ${question}

Based on the section summaries above, return a JSON array containing ONLY the IDs of the most relevant sections that would help answer this question, ordered by relevance (most relevant first).

Example response format:
["section_id_1", "section_id_2", "section_id_3"]

If no sections are relevant, return an empty array: []

Your response (JSON array of IDs only):`;

    return prompt;
  }

  /**
   * פענוח תשובת מודל השפה למערך של מזהי קטעים
   * @param {string} response - תשובת מודל השפה
   * @returns {Array<string>} - מערך של מזהי קטעים
   * @private
   */
  _parseRelevantChunkIds(response) {
    try {
      // ניסיון למצוא מערך JSON בתשובה
      const jsonMatch = response.match(/\[.*\]/s);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        const chunkIds = JSON.parse(jsonString);
        return chunkIds;
      }
      
      // אם לא נמצא מערך JSON, ננסה לחלץ מזהים בצורה ידנית
      const idPattern = /"([^"]+)"/g; // מחפש כל מחרוזת בתוך מרכאות
      const matches = [...response.matchAll(idPattern)];
      
      if (matches.length > 0) {
        return matches.map(match => match[1]);
      }
      
      // אם לא מצאנו כלום, מחזירים מערך ריק
      logger.warn('Failed to parse chunk IDs from LLM response', { response });
      return [];
    } catch (error) {
      logger.error('Error parsing chunk IDs from LLM response', { error: error.message, response });
      return [];
    }
  }

  // ------------------------ פונקציות עזר פנימיות ------------------------

  /**
   * שמירת אינדקס לקובץ
   * @param {string} indexId - מזהה האינדקס
   * @param {Object} indexData - נתוני האינדקס
   * @returns {Promise<void>}
   * @private
   */
  async _saveIndex(indexId, indexData) {
    try {
      const indexPath = path.join(this.indexesDir, `${indexId}.json`);
      await fs.writeJson(indexPath, indexData, { spaces: 2 });
      logger.debug(`Saved index to ${indexPath}`);
    } catch (error) {
      logger.error(`Error saving index: ${indexId}`, { error: error.message });
      throw new Error(`Failed to save index: ${error.message}`);
    }
  }

  /**
   * יצירת תקציר כללי למסמך
   * @param {Array} chunks - קטעי המסמך
   * @returns {Promise<string>} - תקציר כללי
   * @private
   */
  async _createOverallSummary(chunks) {
    // בשלב זה נשתמש בתקציר פשוט
    // בגרסה מתקדמת יותר נוכל לשלוח את כל התקצירים לקלוד ולבקש תקציר מאוחד
    const summaries = chunks.map(chunk => chunk.summary).join('\n\n');
    
    // לקצר אם התקציר ארוך מדי
    const maxSummaryLength = this.config.get('indexing.maxOverallSummaryLength') || 2000;
    
    if (summaries.length <= maxSummaryLength) {
      return summaries;
    } else {
      // בשלב זה פשוט נקצץ, אבל בעתיד נשתמש ב-Claude לקבלת תקציר טוב יותר
      return summaries.substring(0, maxSummaryLength) + '...';
    }
  }

  /**
   * חילוץ מילות מפתח משאלה
   * @param {string} question - שאלת המשתמש
   * @returns {Promise<Array<string>>} - מערך מילות מפתח
   * @private 
   */
  async _extractKeywordsFromQuestion(question) {
    // גרסה פשוטה - חילוץ מילים משמעותיות מהשאלה
    
    // הסרת מילות קישור נפוצות
    const stopWords = this.config.get('query.stopWords') || ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'of', 'to', 'in', 'on', 'by', 'with', 'about', 'for', 'from'];
    
    // הסרת סימני פיסוק
    const cleanQuestion = question.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
    
    // חלוקה למילים והסרת מילות קישור
    const words = cleanQuestion.split(/\s+/).filter(word => 
      word.length > 2 && !stopWords.includes(word.toLowerCase())
    );
    
    // הסרת כפילויות
    const uniqueWords = [...new Set(words)];
    
    return uniqueWords;
  }

  /**
   * קריאת תוכן קטע מקובץ המקור
   * @param {string} filePath - נתיב לקובץ המקור
   * @param {number} startPosition - מיקום התחלה
   * @param {number} endPosition - מיקום סיום
   * @returns {Promise<string>} - תוכן הקטע
   * @private
   */
  async _readChunkFromFile(filePath, startPosition, endPosition) {
    try {
      if (!await fs.pathExists(filePath)) {
        logger.warn(`Source file not found: ${filePath}`);
        return `[Content not available - source file not found: ${filePath}]`;
      }
      
      // קריאת כל הקובץ - לא אופטימלי לקבצים גדולים מאוד
      // בגרסה עתידית נוכל להשתמש בקריאה חלקית
      const content = await fs.readFile(filePath, 'utf8');
      
      // חילוץ החלק הרלוונטי
      return content.substring(startPosition, endPosition + 1);
    } catch (error) {
      logger.error(`Error reading chunk from file: ${filePath}`, { error: error.message });
      return `[Error reading content: ${error.message}]`;
    }
  }

  /**
   * נרמול שם אינדקס למזהה תקין
   * @param {string} name - שם האינדקס
   * @returns {string} - מזהה מנורמל
   * @private
   */
  _normalizeIndexName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

module.exports = IndexManager;