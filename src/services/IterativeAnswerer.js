// File: src/services/IterativeAnswerer.js
// Location: /claude-context-extender/src/services/IterativeAnswerer.js
// שירות לייצור תשובות באופן איטרטיבי על ידי עיבוד קטע אחר קטע, כולל הגבלת קצב

'use strict';

const ClaudeClient = require('./ClaudeClient');
const configManager = require('../utils/ConfigManager');
const logger = require('../utils/Logger');

class IterativeAnswerer {
  constructor() {
    this.claudeClient = new ClaudeClient();
    this.config = configManager;
    // טוקנים בדקה שקלוד יכול לעבד (ברירת מחדל: 50,000)
    this.tokenRatePerMinute = this.config.get('claude.tokenRatePerMinute') || 50000;
    logger.debug('IterativeAnswerer initialized with token rate: ' + this.tokenRatePerMinute + ' tokens/minute');
  }

  /**
   * חישוב זמן המתנה בהתבסס על גודל הקלט
   * @param {string} inputString - תוכן הקלט
   * @returns {number} - זמן המתנה במילישניות
   * @private
   */
  _calculateWaitTime(inputString) {
    // הערכת מספר הטוקנים: כ-4 תווים לטוקן
    const estimatedTokens = inputString.length / 4;
    // חישוב זמן המתנה במילישניות
    const waitTimeMs = Math.ceil((estimatedTokens / this.tokenRatePerMinute) * 60 * 1000);
    
    // לפחות 500 מילישניות בין בקשות
    return Math.max(500, waitTimeMs);
  }

  /**
   * ייצור תשובה איטרטיבי - עיבוד קטע אחרי קטע ושיפור התשובה בהדרגה
   * @param {string} question - שאלת המשתמש
   * @param {Array} relevantChunks - מערך של קטעים רלוונטיים
   * @param {string} conversationHistory - היסטוריית השיחה (אופציונלי)
   * @returns {Promise<string>} - התשובה הסופית
   */
  async generateAnswer(question, relevantChunks, conversationHistory = '') {
    try {
      logger.info(`Starting iterative answer generation with ${relevantChunks.length} chunks`);
      console.log(`Starting iterative answer generation with ${relevantChunks.length} chunks...`);
      
      // מיון הקטעים לפי רלוונטיות (אם קיים שדה זה)
      const sortedChunks = [...relevantChunks].sort((a, b) => {
        // אם יש ציון רלוונטיות, מיין לפיו
        if (a.relevanceScore !== undefined && b.relevanceScore !== undefined) {
          return a.relevanceScore - b.relevanceScore;
        }
        return 0; // ללא שינוי בסדר אם אין ציון רלוונטיות
      });
      
      // תשובה התחלתית ריקה
      let currentAnswer = '';
      
      // עיבוד כל קטע בנפרד
      for (let i = 0; i < sortedChunks.length; i++) {
        const chunk = sortedChunks[i];
        console.log(`Processing chunk ${i+1}/${sortedChunks.length}: ${chunk.id}`);
        
        // בניית פרומפט לקטע הנוכחי
        const prompt = this._buildChunkPrompt(
          question,
          chunk,
          currentAnswer,
          conversationHistory,
          i,
          sortedChunks.length
        );
        
        // חישוב זמן המתנה בהתבסס על גודל התוכן
        const waitTime = this._calculateWaitTime(chunk.content);
        console.log(`Waiting ${waitTime}ms before processing chunk to avoid rate limiting...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // שליחה לקלוד
        console.log(`Sending chunk to Claude (content length: ${chunk.content.length} chars, est. tokens: ${Math.round(chunk.content.length/4)})`);
        const chunkResponse = await this.claudeClient.sendPrompt(prompt, {
          temperature: 0.3, // טמפרטורה נמוכה יותר לעקביות
          system: "You are a helpful assistant processing documents piece by piece to build a comprehensive answer."
        });
        
        // עדכון התשובה הנוכחית
        currentAnswer = chunkResponse;
        console.log(`Updated answer after chunk ${i+1} (length: ${currentAnswer.length} chars)`);
      }
      
      // במידה ויש צורך, ניתן לבצע גם שלב סיכום סופי
      if (sortedChunks.length > 1) {
        // המתנה לפני הסיכום הסופי
        const finalWaitTime = this._calculateWaitTime(currentAnswer);
        console.log(`Waiting ${finalWaitTime}ms before generating final summary...`);
        await new Promise(resolve => setTimeout(resolve, finalWaitTime));
        
        // יצירת סיכום סופי
        currentAnswer = await this._generateFinalSummary(question, currentAnswer);
      }
      
      logger.info(`Completed iterative answer generation`);
      console.log(`Answer generation complete. Final answer length: ${currentAnswer.length} chars`);
      
      return currentAnswer;
    } catch (error) {
      logger.error('Error generating iterative answer', { error: error.message });
      throw new Error(`Failed to generate iterative answer: ${error.message}`);
    }
  }

  /**
   * בניית פרומפט לעיבוד קטע בודד
   * @param {string} question - שאלת המשתמש
   * @param {Object} chunk - הקטע לעיבוד
   * @param {string} currentAnswer - התשובה הנוכחית
   * @param {string} conversationHistory - היסטוריית השיחה
   * @param {number} chunkIndex - אינדקס הקטע הנוכחי
   * @param {number} totalChunks - מספר הקטעים הכולל
   * @returns {string} - פרומפט מוכן
   * @private
   */
  _buildChunkPrompt(question, chunk, currentAnswer, conversationHistory, chunkIndex, totalChunks) {
    let prompt = '';
    
    // הוספת היסטוריית שיחה אם יש
    if (conversationHistory && conversationHistory.trim() !== '') {
      prompt += `Previous conversation:\n${conversationHistory}\n\n`;
    }
    
    // הוספת שאלת המשתמש
    prompt += `USER QUESTION: ${question}\n\n`;
    
    // הוספת מידע על הקטע הנוכחי
    prompt += `Below is ${chunkIndex === 0 ? 'the first' : 'another'} section of information (${chunkIndex+1}/${totalChunks}):\n\n`;
    prompt += `SECTION CONTENT:\n${chunk.content}\n\n`;
    
    // הוראות שונות לפי מצב הקטע והתשובה
    if (chunkIndex === 0) {
      // קטע ראשון
      prompt += `Based on this section, start formulating an answer to the user's question. If this section doesn't contain relevant information, simply state what information you would need to answer the question.`;
    } else {
      // קטעים הבאים
      prompt += `Here is the current answer based on previous sections:\n\n${currentAnswer}\n\n`;
      prompt += `Please improve, correct, or expand this answer by incorporating any relevant information from the new section. If this section doesn't add any relevant information, you can return the current answer unchanged or make minor improvements for clarity.`;
    }
    
    // הנחיות נוספות
    prompt += `\n\nRemember to base your answer strictly on the provided information. If the information needed to answer the question is not available, say so clearly.`;
    
    return prompt;
  }

  /**
   * ייצור סיכום סופי של התשובה לאחר עיבוד כל הקטעים
   * @param {string} question - שאלת המשתמש
   * @param {string} compiledAnswer - התשובה המורכבת עד כה
   * @returns {Promise<string>} - תשובה סופית מלוטשת
   * @private
   */
  async _generateFinalSummary(question, compiledAnswer) {
    logger.debug('Generating final summary');
    console.log('Generating final summary and refinement...');
    
    const finalPrompt = `
    USER QUESTION: ${question}

    Below is a compiled answer based on processing multiple sections of information:
    
    ${compiledAnswer}
    
    Please review this answer and create a final, refined version that:
    1. Ensures it directly answers the original question
    2. Eliminates any redundancy or repetition
    3. Presents information in a clear, logical flow
    4. Maintains accuracy while improving readability
    5. Is concise but comprehensive
    
    Your final, refined answer:
    `;
    
    const finalAnswer = await this.claudeClient.sendPrompt(finalPrompt, {
      temperature: 0.3,
      system: "You are a helpful assistant providing a final, polished answer based on information gathered from multiple document sections."
    });
    
    return finalAnswer;
  }
}

module.exports = IterativeAnswerer;