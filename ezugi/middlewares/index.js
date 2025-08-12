const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const { ValidationUtils } = require("../../utils/validation");
const CryptoUtils = require("../../utils/crypto");
const ezugiConfig = require("../config/ezugi");
const logger = require("../../utils/logger");
const crypto = require("crypto");

// ==================== IP Whitelist Middleware ====================
const ipWhiteList = (req, res, next) => {
  const clientIP =
    req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"];

  if (process.env.NODE_ENV === "development") {
    return next();
  }

  if (!ValidationUtils.isWhiteListedIP(clientIP)) {
    logger.securityLog("Unauthorized IP access attempt", clientIP);
    return res.status(403).json({
      errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
      errorDescription: "Access denied",
      timestamp: Date.now(),
    });
  }
  next();
};

// ==================== Hash Signature Validation ====================

const stripUtf8Bom = (buf) => {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(String(buf || ""), "utf8");
  if (
    buf.length >= 3 &&
    buf[0] === 0xef &&
    buf[1] === 0xbb &&
    buf[2] === 0xbf
  ) {
    return buf.slice(3);
  }
  return buf;
};

const validateHashSignature = (req, res, next) => {
  try {
    console.log("=== HASH SIGNATURE VALIDATION ===");

    let receivedHash =
      req.headers.hash || req.headers["Hash"] || req.headers["HASH"];
    if (typeof receivedHash === "string") receivedHash = receivedHash.trim();
    console.log("Header trimmed:", receivedHash);

    if (!receivedHash) {
      console.log("ERROR: Hash header missing");
      return res.status(400).json({
        errorCode: 1,
        errorDescription: "Hash header required",
        timestamp: Date.now(),
      });
    }

    // Ensure raw bytes exist
    let raw = req.rawBody !== undefined ? req.rawBody : null;
    if (!raw) {
      // fallback: if req.body exists, try to rebuild raw from it (last resort)
      if (req.body) raw = Buffer.from(JSON.stringify(req.body), "utf8");
    }
    if (!raw) {
      console.log(
        "ERROR: rawBody missing; ensure global express.json verify stores it"
      );
      return res.status(400).json({
        errorCode: 1,
        errorDescription: "Raw body required for hash validation",
        timestamp: Date.now(),
      });
    }

    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, "utf8");
    const cleanedBuf = stripUtf8Bom(buf);

    const secretKey = (process.env.EZUGI_SECRET_KEY || "").trim();
    if (!secretKey) {
      console.log("ERROR: EZUGI_SECRET_KEY not set");
      return res.status(500).json({
        errorCode: 1,
        errorDescription: "Server configuration error",
        timestamp: Date.now(),
      });
    }

    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(cleanedBuf)
      .digest("base64");
    console.log("Computed expectedHash:", expectedHash);

    // compare safely
    let expectedBuf, receivedBuf;
    try {
      expectedBuf = Buffer.from(expectedHash, "base64");
      receivedBuf = Buffer.from(receivedHash, "base64");
    } catch (err) {
      console.log("ERROR: Received or expected hash not valid base64");
      return res.status(400).json({
        errorCode: 1,
        errorDescription: "Invalid hash format",
        timestamp: Date.now(),
      });
    }

    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      console.log("❌ Hash validation failed - hashes do not match");
      console.log("Expected (base64):", expectedHash);
      console.log("Received (base64):", receivedHash);
      return res.status(401).json({
        errorCode: 2,
        errorDescription: "Invalid hash signature",
        timestamp: Date.now(),
      });
    }

    console.log("✅ Hash validation passed");

    // --------- SAFE FALLBACK: Rebuild req.body if missing ----------
    if (!req.body) {
      try {
        const rawStr = cleanedBuf.toString("utf8");
        req.body = JSON.parse(rawStr);
        // If you use validatedData or similar, set it too:
        req.validatedData = req.body;
        console.log("✅ Rebuilt req.body from req.rawBody (fallback)");
      } catch (err) {
        console.error("Failed to rebuild req.body from rawBody:", err);
        return res.status(400).json({
          errorCode: 1,
          errorDescription: "Request body is empty or invalid",
          timestamp: Date.now(),
        });
      }
    }

    next();
  } catch (err) {
    console.error("Hash validation error:", err);
    return res.status(500).json({
      errorCode: 1,
      errorDescription: "Hash validation error",
      timestamp: Date.now(),
    });
  }
};

// ==================== Request Validation ====================
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { isValid, errors, sanitizeData } = ValidationUtils.validateRequests(
      req.body,
      schema
    );
    if (!isValid) {
      logger.securityLog("Invalid request data", req.ip, null, {
        errors,
        path: req.path,
      });
      return res.status(400).json({
        errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
        errorDescription: `Validation failed: ${
          errors[0]?.message || "Invalid data"
        }`,
        timestamp: Date.now(),
        validationErrors:
          process.env.NODE_ENV === "development" ? errors : undefined,
      });
    }
    req.body = sanitizeData;
    req.validatedData = sanitizeData;
    next();
  };
};

// ==================== Error Handler ====================
const errorHandler = (err, req, res, next) => {
  logger.errorLog(err, {
    context: "errorHandler",
    path: req.path,
    method: req.method,
    ip: req.ip,
    body: logger.sanitizeLogData(req.body),
  });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
      errorDescription: "Invalid request data",
      timestamp: Date.now(),
    });
  }
  if (err.code === "ECONNREFUSED") {
    return res.status(500).json({
      errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
      errorDescription: "Service temporarily unavailable",
      timestamp: Date.now(),
    });
  }
  res.status(500).json({
    errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
    errorDescription: "Internal server error",
    timestamp: Date.now(),
  });
};

// ==================== Rate Limiter ====================
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
  message: {
    errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
    errorDescription: "Too many requests, please try again later",
    timestamp: Date.now(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.securityLog("Rate limit exceeded", req.ip);
    return res.status(429).json({
      errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
      errorDescription: "Too many requests, please try again later",
      timestamp: Date.now(),
    });
  },
});

// ==================== Request Logger ====================
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = CryptoUtils.generateUUID();
  req.requestId = requestId;

  logger.apiLog(req.method, req.path, null, null, requestId);

  const originalJson = res.json;
  res.json = function (data) {
    const responseTime = Date.now() - startTime;
    logger.apiLog(
      req.method,
      req.path,
      res.statusCode,
      responseTime,
      requestId
    );

    if (req.path.includes("/callback/ezugi/")) {
      const action = req.path.split("/").pop();
      logger.ezugiLog(
        action,
        logger.sanitizeLogData(req.body),
        logger.sanitizeLogData(data),
        res.statusCode === 200 ? "success" : "error"
      );
    }
    return originalJson.call(this, data);
  };
  next();
};

// ==================== CORS ====================
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    const allowedOrigins = [
      "https://75club.games",
      "https://playint.tableslive.com",
      "https://boint.tableslive.com",
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "hash", "X-Requested-With"],
  exposedHeaders: ["hash"],
};

// ==================== Helmet Security ====================
const secuirtyHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "'data'", "'https'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// ==================== Timeout ====================
const timeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.errorLog(new Error("Request timed out"), {
          context: "timeout",
          path: req.path,
          method: req.method,
        });
        res.status(408).json({
          errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
          errorDescription: "Request timed out",
          timestamp: Date.now(),
        });
      }
    }, timeoutMs);
    res.on("finish", () => {
      clearTimeout(timer);
    });
    next();
  };
};

// ==================== Health Check ====================
const healthCheck = (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: Date.now(),
    uptime: process.uptime(),
    enviroment: process.env.NODE_ENV,
    version: "1.0.0",
  });
};

// ==================== Maintenance Mode ====================
const maintenanceMode = (req, res, next) => {
  if (process.env.MAINTENANCE_MODE === "true") {
    return res.status(503).json({
      errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
      errorDescription: "Service is currently under maintenance",
      timestamp: Date.now(),
    });
  }
  next();
};

module.exports = {
  ipWhiteList,
  validateHashSignature,
  validateRequest,
  errorHandler,
  rateLimiter,
  requestLogger,
  corsOptions,
  secuirtyHeaders,
  timeout,
  healthCheck,
  maintenanceMode,
  cors: cors(corsOptions),
};
