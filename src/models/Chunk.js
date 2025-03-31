// File: src/models/Chunk.js
// Location: /claude-context-extender/src/models/Chunk.js
// מודל לקטע תוכן

'use strict';

/**
 * מייצג קטע תוכן מקובץ
 */
class Chunk {
  /**
   * יצירת קטע חדש
   * @param {Object} params - פרמטרים לקטע
   * @param {string} params.id - מזהה ייחודי לקטע
   * @param {string} params.content - תוכן הקטע
   * @param {string} params.filePath - נתיב לקובץ המקור
   * @param {number} params.startPosition - מיקום התחלה בקובץ המקור
   * @param {number} params.endPosition - מיקום סיום בקובץ המקור
   * @param {string} [params.summary] - תקציר הקטע (אופציונלי)
   * @param {Array<string>} [params.keywords] - מילות מפתח (אופציונלי)
   */
  constructor({ id, content, filePath, startPosition, endPosition, summary = '', keywords = [] }) {
    this.id = id;
    this.content = content;
    this.filePath = filePath;
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    this.summary = summary;
    this.keywords = keywords;
  }

  /**
   * חישוב אורך הקטע בתווים
   * @returns {number} - מספר התווים בקטע
   */
  get length() {
    return this.content.length;
  }

  /**
   * הערכה גסה של מספר הטוקנים בקטע
   * @returns {number} - הערכת מספר הטוקנים
   */
  get estimatedTokens() {
    // הערכה גסה: 1 טוקן ≈ 4 תווים
    return Math.ceil(this.content.length / 4);
  }

  /**
   * המרה למחרוזת JSON
   * @returns {string} - ייצוג JSON של הקטע
   */
  toJSON() {
    return {
      id: this.id,
      filePath: this.filePath,
      startPosition: this.startPosition,
      endPosition: this.endPosition,
      length: this.length,
      estimatedTokens: this.estimatedTokens,
      summary: this.summary,
      keywords: this.keywords
    };
  }
}

module.exports = Chunk;
