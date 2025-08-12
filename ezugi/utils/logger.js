const winston = require("winston");
const path = require("path");
const fs = require("fs");
const { error } = require("console");

const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);
//combined log files
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: "ezugi-api" },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 10484760, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),

    //API specific logs
    new winston.transports.File({
      filename: path.join(logsDir, "api.log"),
      level: "info",
      maxsize: 10484760, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),

    //Transaction log
    new winston.transports.File({
      filename: path.join(logsDir, "transaction.log"),
      level: "info",
      maxsize: 10484760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],

  //Handle exception
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
    }),
  ],

  //Handle rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "rejections.log"),
    }),
  ],
});

//console transport for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} ${level}: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
          }`;
        })
      ),
    })
  );
}

// Custom logging methods for specific use cases
const customLogger = {
  apiLog(method, url, statusCode, responseTime, requestId) {
    logger.info("API Request", {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      requestId,
      type: "api",
    });
  },

  //Transaction logging
  transactionLog(type, transactionId, amount, userId, status, details = {}) {
    logger.info("Transaction", {
      type,
      transactionId,
      amount,
      userId,
      status,
      details,
      timestamp: new Date().toISOString(),
      logType: "transaction",
    });
  },

  //Security logging
  securityLog(event, ip, userId = null, details = {}) {
    logger.warn("Security Event", {
      event,
      ip,
      userId,
      details,
      timestamp: new Date().toISOString(),
      logType: "security",
    });
  },

  // Error logging with context
  errorLog(error, context = {}) {
    logger.error("Application Error", {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      logType: "error",
    });
  },

  //Ezugi specific logging
  ezugiLog(action, requestData, responseData, status = "success") {
    logger.info("Ezugi Integration", {
      action,
      requestData: this.sanitizeLogData(requestData),
      responseData: this.sanitizeLogData(responseData),
      status,
      timestamp: new Date().toISOString(),
      logType: "ezugi",
    });
  },

  // Sanitize sensitive data from logs
  sanitizeLogData(data) {
    if (!data || typeof data !== "object") return data;

    const sensitiveField = ["token", "password", "secretKey", "hash"];
    const sanitized = { ...data };

    sensitiveField.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = "***REDACTED***";
      }
    });
    return sanitized;
  },
};
//Extend logger with custom methods
Object.assign(logger, customLogger);

module.exports = logger;
