// File: src/services/ClaudeClient.js
// Location: /claude-context-extender/src/services/ClaudeClient.js
// שירות להתקשרות עם API של Claude

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const configManager = require('../utils/ConfigManager');
const logger = require('../utils/Logger');

class ClaudeClient {
  constructor() {
    this.config = configManager;
    
    // יצירת מופע של הלקוח של Anthropic
    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
    
    // קבלת מודל ברירת המחדל מההגדרות
    this.defaultModel = this.config.get('claude.model') || 'claude-3-5-haiku-20241022';
    
    logger.debug('ClaudeClient initialized');
  }

  /**
   * שליחת פרומפט לקלוד וקבלת תשובה
   * @param {string} prompt - הפרומפט לשליחה
   * @param {Object} [options] - אפשרויות נוספות
   * @returns {Promise<string>} - תשובת קלוד
   */
  async sendPrompt(prompt, options = {}) {
    try {
      const defaultMaxTokens = this.config.get('claude.responseMaxTokens') || 4000;
      
      const response = await this.anthropic.messages.create({
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || defaultMaxTokens,
        temperature: options.temperature || 0.7,
        system: options.system || this.config.get('claude.defaultSystemPrompt'),
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      
      logger.debug('Received response from Claude', { promptLength: prompt.length });
      
      // חילוץ התוכן מהתשובה
      return response.content[0].text;
    } catch (error) {
      logger.error('Error sending prompt to Claude', { error: error.message });
      throw new Error(`Failed to get response from Claude: ${error.message}`);
    }
  }

  /**
   * יצירת תקציר ומילות מפתח לקטע
   * @param {string} content - תוכן הקטע
   * @returns {Promise<Object>} - תקציר ומילות מפתח
   */
  async createSummaryAndKeywords(content) {
    try {
      const topSummaryLength = content.length <= 100 ? 20 : (content.length <= 1000 ? 200 : Math.floor(content.length / 10 ));
      const promptTemplate = this.config.get('prompts.summarizeTemplate') || `return a json file (nothing more) with the following entries: 
summary: should enable one to know whether the content is relevant given some general or specific question. it should be distinctive as to the part  this content may have in a wider context content.
keywords: also, must be distinctive but cover most topics included

This is the content: {{CONTENT}}. return json only, with no additional text.`;
      
      // מילוי תבנית הפרומפט
      const prompt = promptTemplate.replace('{{CONTENT}}', content);
      
      // שליחה לקלוד
      const response = await this.sendPrompt(prompt, {
        temperature: 0.3, // טמפרטורה נמוכה לתוצאות יותר דטרמיניסטיות
      });
      console.log(response);

      const responseJSON = JSON.parse(response.substring(response.indexOf('{'), response.lastIndexOf('}') + 1));

      return { summary: responseJSON.summary, keywords: responseJSON.keywords };
    } catch (error) {
      logger.error('Error creating summary and keywords', { error: error.message });
      throw new Error(`Failed to create summary and keywords: ${error.message}`);
    }
  }

  /**
   * יצירת תקציר לתוכן
   * @param {string} content - התוכן לתקצור
   * @returns {Promise<string>} - התקציר
   */
  async createSummary(content) {
    try {
      const { summary } = await this.createSummaryAndKeywords(content);
      return summary;
    } catch (error) {
      logger.error('Error creating summary', { error: error.message });
      throw new Error(`Failed to create summary: ${error.message}`);
    }
  }

  /**
   * יצירת סיכום לשיחה
   * @param {string} prompt - פרומפט לסיכום שיחה
   * @returns {Promise<string>} - סיכום השיחה
   */
  async createConversationSummary(prompt) {
    try {
      // שליחה לקלוד עם הגדרות מותאמות לסיכום
      const response = await this.sendPrompt(prompt, {
        temperature: 0.3,
        system: "You are an expert assistant that creates concise, accurate summaries of conversations. Focus on capturing the key points, questions, and information from the conversation."
      });
      
      return response.trim();
    } catch (error) {
      logger.error('Error creating conversation summary', { error: error.message });
      throw new Error(`Failed to create conversation summary: ${error.message}`);
    }
  }
}

module.exports = ClaudeClient;
