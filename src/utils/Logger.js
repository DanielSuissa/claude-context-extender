// File: src/utils/Logger.js
// Location: /claude-context-extender/src/utils/Logger.js
// מערכת לוגים לאפליקציה

'use strict';

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// ודא שתיקיית הלוגים קיימת
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

class Logger {
  constructor() {
    const logFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
      return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    });

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        logFormat
      ),
      defaultMeta: { service: 'claude-context-extender' },
      transports: [
        // לוגים לקונסול
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            logFormat
          )
        }),
        // לוגים לקובץ - כל הרמות
        new winston.transports.File({ 
          filename: path.join(logDir, 'combined.log') 
        }),
        // לוגים לקובץ - רק שגיאות
        new winston.transports.File({ 
          filename: path.join(logDir, 'error.log'), 
          level: 'error' 
        })
      ]
    });

    // לוגים נוספים אם בסביבת פיתוח
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug('Logger initialized in development mode');
    }
  }

  // מתודות נוחות לרמות לוג שונות
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // תיעוד ביצועים
  logPerformance(operation, timeInMs, meta = {}) {
    this.info(`Performance: ${operation} took ${timeInMs}ms`, { 
      ...meta, 
      performance: true, 
      operation, 
      timeInMs 
    });
  }
}

// סינגלטון אחד לכל האפליקציה
const logger = new Logger();
module.exports = logger;
