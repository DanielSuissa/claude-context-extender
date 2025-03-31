// File: src/services/FileProcessor.js
// Location: /claude-context-extender/src/services/FileProcessor.js
// שירות לעיבוד קבצים, קריאת תוכן וחלוקה לקטעים

'use strict';

const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const Chunk = require('../models/Chunk');
const configManager = require('../utils/ConfigManager');
const logger = require('../utils/Logger');

class FileProcessor {
  constructor() {
    this.config = configManager;
    logger.debug('FileProcessor initialized');
  }

  /**
   * מעבד קובץ או תיקייה
   * @param {string} filePath - נתיב לקובץ או תיקייה
   * @returns {Promise<Array<Chunk>>} - מערך של קטעים
   */
  async processPath(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        return this.processDirectory(filePath);
      } else if (stats.isFile()) {
        return this.processFile(filePath);
      } else {
        logger.warn(`Path is neither file nor directory: ${filePath}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error processing path: ${filePath}`, { error: error.message });
      throw new Error(`Failed to process path: ${error.message}`);
    }
  }

  /**
   * מעבד תיקייה שלמה
   * @param {string} dirPath - נתיב לתיקייה 
   * @returns {Promise<Array<Chunk>>} - מערך של קטעים מכל הקבצים
   */
  async processDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      logger.info(`Processing directory with ${files.length} files/subdirectories`, { dirPath });
      
      let allChunks = [];
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          // עיבוד רקורסיבי של תת-תיקיות
          const subDirChunks = await this.processDirectory(fullPath);
          allChunks = [...allChunks, ...subDirChunks];
        } else if (stats.isFile()) {
          // בדיקה אם סוג הקובץ נתמך
          if (this.isSupportedFileType(fullPath)) {
            const fileChunks = await this.processFile(fullPath);
            allChunks = [...allChunks, ...fileChunks];
          } else {
            logger.debug(`Skipping unsupported file: ${fullPath}`);
          }
        }
      }
      
      return allChunks;
    } catch (error) {
      logger.error(`Error processing directory: ${dirPath}`, { error: error.message });
      throw new Error(`Failed to process directory: ${error.message}`);
    }
  }

  /**
   * מעבד קובץ יחיד
   * @param {string} filePath - נתיב לקובץ
   * @returns {Promise<Array<Chunk>>} - מערך של קטעים
   */
  async processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const supportedPdfExts = this.config.get('fileProcessing.supportedPdfExtensions');
    
    logger.info(`Processing file: ${filePath}`);
    const startTime = Date.now();
    
    try {
      let content;
      
      // חילוץ תוכן בהתבסס על סוג הקובץ
      if (supportedPdfExts.includes(ext)) {
        content = await this.extractPdfContent(filePath);
      } else {
        content = await this.extractTextContent(filePath);
      }
      
      // חלוקה לקטעים
      const chunks = this.splitIntoChunks(content, filePath);
      
      const endTime = Date.now();
      logger.logPerformance(`Process file ${path.basename(filePath)}`, endTime - startTime, { 
        fileSize: (await fs.stat(filePath)).size,
        chunksCreated: chunks.length
      });
      
      return chunks;
    } catch (error) {
      logger.error(`Error processing file: ${filePath}`, { error: error.message });
      throw new Error(`Failed to process file ${filePath}: ${error.message}`);
    }
  }

  /**
   * בדיקה אם סוג הקובץ נתמך
   * @param {string} filePath - נתיב לקובץ
   * @returns {boolean} - האם סוג הקובץ נתמך
   */
  isSupportedFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const supportedTextExts = this.config.get('fileProcessing.supportedTextExtensions');
    const supportedPdfExts = this.config.get('fileProcessing.supportedPdfExtensions');
    
    return supportedTextExts.includes(ext) || supportedPdfExts.includes(ext);
  }

  /**
   * חילוץ תוכן טקסט מקובץ טקסט
   * @param {string} filePath - נתיב לקובץ טקסט
   * @returns {Promise<string>} - תוכן הקובץ
   */
  async extractTextContent(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const maxSizeInBytes = this.config.get('fileProcessing.maxFileSizeInMemoryMb') * 1024 * 1024;
      
      // לקבצים גדולים, שימוש בסטרימינג למניעת בעיות זיכרון
      if (stats.size > maxSizeInBytes) {
        return this.extractLargeTextContent(filePath);
      }
      
      // לקבצים קטנים יותר, קריאה בבת אחת
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      logger.error(`Error extracting text from: ${filePath}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * חילוץ תוכן מקבצי טקסט גדולים באמצעות סטרימים
   * @param {string} filePath - נתיב לקובץ טקסט
   * @returns {Promise<string>} - תוכן הקובץ
   */
  async extractLargeTextContent(filePath) {
    return new Promise((resolve, reject) => {
      let content = '';
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      
      stream.on('data', (chunk) => {
        content += chunk;
      });
      
      stream.on('end', () => {
        resolve(content);
      });
      
      stream.on('error', (error) => {
        logger.error(`Stream error for ${filePath}`, { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * חילוץ תוכן טקסט מקובץ PDF
   * @param {string} filePath - נתיב לקובץ PDF
   * @returns {Promise<string>} - טקסט מחולץ
   */
  async extractPdfContent(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text;
    } catch (error) {
      logger.error(`Error extracting PDF content from: ${filePath}`, { error: error.message });
      throw error;
    }
  }

  /**
   * פונקציה מאוחדת לחילוץ תוכן קובץ בלי קשר לסוג
   * @param {string} filePath - נתיב לקובץ
   * @returns {Promise<string>} - תוכן הקובץ
   */
  async extractFileContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const supportedPdfExts = this.config.get('fileProcessing.supportedPdfExtensions');
    
    if (supportedPdfExts.includes(ext)) {
      return this.extractPdfContent(filePath);
    } else {
      return this.extractTextContent(filePath);
    }
  }

  /**
   * חלוקת תוכן לקטעים מתאימים
   * @param {string} content - תוכן מלא לחלוקה
   * @param {string} filePath - נתיב לקובץ המקור
   * @returns {Array<Chunk>} - מערך של קטעי תוכן
   */
  splitIntoChunks(content, filePath) {
    // קבלת הגדרות חלוקה
    const chunkSizePercentage = this.config.get('chunking.chunkSizePercentage');
    const overlapPercentage = this.config.get('chunking.overlapPercentage');
    const preserveParagraphs = this.config.get('chunking.preserveParagraphs');

    // חישוב גודל קטע מתאים
    // ברירת מחדל: 40% מחלון ההקשר של קלוד
    const claudeMaxTokens = this.config.get('claude.maxTokens');
    // קירוב גס: 1 טוקן ≈ 4 תווים
    const tokensToCharsRatio = 4;  
    const maxChunkSize = Math.floor((claudeMaxTokens * chunkSizePercentage / 100) * tokensToCharsRatio);
    logger.debug('Splitting content into chunks', { 
      filePath, 
      contentLength: content.length,
      maxChunkSize
    });

    const chunks = [];
    
    // אם התוכן נכנס בקטע אחד, להחזיר אותו כמו שהוא
    if (content.length <= maxChunkSize) {
      chunks.push(new Chunk({
        id: `${path.basename(filePath)}_chunk_1`,
        content: content,
        filePath: filePath,
        startPosition: 0,
        endPosition: content.length - 1
      }));
      return chunks;
    }
    
    // חלוקה למספר קטעים
    let currentStartingPosition = 0;
    let chunkIndex = 1;
    const chunkPadding = Math.floor(maxChunkSize * overlapPercentage / 200);
    
    while (currentStartingPosition < content.length) {
      let currentEndingPosition = Math.min(currentStartingPosition + maxChunkSize, content.length); 
      let paddedStartingPos = Math.max(0,currentStartingPosition - chunkPadding), paddedEndingPos = Math.min(currentEndingPosition + chunkPadding,content.length);
      const chunkContent = content.substring(paddedStartingPos, paddedEndingPos);
      chunks.push(new Chunk({
        id: `${path.basename(filePath)}_chunk_${chunkIndex}`,
        content: chunkContent,
        filePath: filePath,
        startPosition: paddedStartingPos,
        endPosition: paddedEndingPos - 1
      }));
      
      // התקדמות למיקום הבא, בהתחשב בחפיפה
      currentStartingPosition += maxChunkSize;
      chunkIndex++;
    }
    
    logger.info(`Created ${chunks.length} chunks from ${filePath}`);
    return chunks;
  }

  /**
   * קבלת מידע סטטיסטי על קובץ או תיקייה
   * @param {string} filePath - נתיב לקובץ או תיקייה
   * @returns {Promise<Object>} - סטטיסטיקה של הקובץ/תיקייה
   */
  async getFileStats(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        // עבור תיקייה, נחשב את הגודל הכולל של כל הקבצים
        let totalSize = 0;
        const fileCount = await this._calculateDirectoryStats(filePath, totalSize);
        
        return {
          isDirectory: true,
          totalSize,
          fileCount
        };
      } else {
        // עבור קובץ בודד
        return {
          isDirectory: false,
          totalSize: stats.size,
          fileCount: 1
        };
      }
    } catch (error) {
      logger.error(`Error getting file stats for: ${filePath}`, { error: error.message });
      throw new Error(`Failed to get file stats: ${error.message}`);
    }
  }

  /**
   * חישוב סטטיסטיקה של תיקייה
   * @param {string} dirPath - נתיב לתיקייה
   * @param {number} totalSize - גודל כולל (לעדכון)
   * @returns {Promise<number>} - מספר הקבצים
   * @private
   */
  async _calculateDirectoryStats(dirPath, totalSize) {
    let fileCount = 0;
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        // רקורסיה לתת-תיקיות
        fileCount += await this._calculateDirectoryStats(fullPath, totalSize);
      } else if (stats.isFile() && this.isSupportedFileType(fullPath)) {
        // רק קבצים נתמכים
        totalSize += stats.size;
        fileCount++;
      }
    }
    
    return fileCount;
  }
}

module.exports = FileProcessor;