const mariadb = require("mariadb");
const redis = require("redis");
const logger = require("../utils/logger");
require("dotenv").config();

// MySQL Configuration with improved error handling and reconnection
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  multipleStatements: true, // Enable for batch operations
  charset: "utf8mb4",
  allowPublicKeyRetrieval: true,
  ssl: false,
  resetAfterUse: true, // Reset connection state after use
  trace: process.env.NODE_ENV === "development",
  // Add connection retry logic
  connectionRetries: 3,
  connectionRetryDelay: 5000,
};

// Enhanced pool creation with retry mechanism
const createPool = async (retries = 3) => {
  try {
    const pool = mariadb.createPool(dbConfig);
    return pool;
  } catch (err) {
    if (retries > 0) {
      logger.warn(
        `Failed to create pool, retrying... (${retries} attempts left)`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return createPool(retries - 1);
    }
    throw err;
  }
};

// Create MySQL connection pool with enhanced error handling
let pool;
createPool()
  .then((createdPool) => {
    pool = createdPool;
    return pool.getConnection();
  })
  .then((connection) => {
    logger.info("MySQL Database connected successfully", {
      database: dbConfig.database,
      host: dbConfig.host,
      user: dbConfig.user,
    });
    connection.release();
  })
  .catch((err) => {
    logger.error("MySQL Database connection failed:", {
      error: err.message,
      code: err.code,
      state: err.sqlState,
    });
    if (err.code === "ER_ACCESS_DENIED_ERROR") {
      logger.error("Access denied - Please check database credentials");
    }
    process.exit(1);
  });

// Enhanced Redis Configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: function (times) {
    const delay = Math.min(times * 500, 3000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  showFriendlyErrorStack: process.env.NODE_ENV === "development",
};

// Create Redis client with enhanced error handling
const redisClient = redis.createClient(redisConfig);

// Enhanced Redis event handlers
redisClient.on("connect", () => {
  logger.info("Redis client connecting...", {
    host: redisConfig.host,
    port: redisConfig.port,
  });
});

redisClient.on("ready", () => {
  logger.info("Redis client connected and ready");
});

redisClient.on("error", (err) => {
  logger.error("Redis client error:", {
    error: err.message,
    code: err.code,
  });
});

redisClient.on("end", () => {
  logger.info("Redis client disconnected");
});

redisClient.on("reconnecting", () => {
  logger.info("Redis client reconnecting...");
});

// Connect to Redis with automatic reconnection
const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.error("Redis connection failed:", err);
    setTimeout(connectRedis, 5000);
  }
};

connectRedis();

// Enhanced graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Initiating graceful shutdown...");

  try {
    // Set a timeout for graceful shutdown
    const shutdownTimeout = setTimeout(() => {
      logger.error("Forced shutdown due to timeout");
      process.exit(1);
    }, 10000);

    // Close database connections
    if (pool) {
      logger.info("Closing database pool...");
      await pool.end();
      logger.info("Database pool closed");
    }

    if (redisClient) {
      logger.info("Closing Redis connection...");
      await redisClient.quit();
      logger.info("Redis connection closed");
    }

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (err) {
    logger.error("Error during shutdown:", err);
    process.exit(1);
  }
});

// Enhanced Database helper functions
const dbHelpers = {
  async query(sql, params = []) {
    let connection;
    try {
      connection = await pool.getConnection();
      const start = Date.now();

      // Use query method instead of execute
      const rows = await connection.query(sql, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn("Slow query detected:", {
          duration,
          sql,
          params,
        });
      }

      return rows;
    } catch (error) {
      logger.error("Database query error:", {
        sql,
        params,
        error: error.message,
        code: error.code,
      });
      throw error;
    } finally {
      if (connection) connection.release();
    }
  },

  async beginTransaction() {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    return connection;
  },

  async commit(connection) {
    try {
      await connection.commit();
    } finally {
      connection.release();
    }
  },

  async rollback(connection) {
    try {
      await connection.rollback();
    } finally {
      connection.release();
    }
  },

  // New helper methods
  async queryWithRetry(sql, params = [], maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.query(sql, params);
      } catch (error) {
        lastError = error;
        if (!this.isRetryableError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw lastError;
  },

  isRetryableError(error) {
    const retryableCodes = ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"];
    return retryableCodes.includes(error.code);
  },
};

// Enhanced Redis helper functions
const redisHelpers = {
  async set(key, value, expireInSeconds = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      await redisClient.setEx(key, expireInSeconds, serializedValue);

      if (process.env.NODE_ENV === "development") {
        logger.debug("Redis set:", { key, expireInSeconds });
      }
    } catch (error) {
      logger.error("Redis set error:", {
        key,
        error: error.message,
        command: "SET",
      });
      throw error;
    }
  },

  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error("Redis get error:", {
        key,
        error: error.message,
        command: "GET",
      });
      throw error;
    }
  },

  async del(key) {
    try {
      await redisClient.del(key);

      if (process.env.NODE_ENV === "development") {
        logger.debug("Redis delete:", { key });
      }
    } catch (error) {
      logger.error("Redis delete error:", {
        key,
        error: error.message,
        command: "DEL",
      });
      throw error;
    }
  },

  async exists(key) {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      logger.error("Redis exists error:", {
        key,
        error: error.message,
        command: "EXISTS",
      });
      throw error;
    }
  },

  // New helper methods
  async setWithRetry(key, value, expireInSeconds = 3600, maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.set(key, value, expireInSeconds);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw lastError;
  },

  async getWithDefault(key, defaultValue, expireInSeconds = 3600) {
    const value = await this.get(key);
    if (value === null && defaultValue !== undefined) {
      await this.set(key, defaultValue, expireInSeconds);
      return defaultValue;
    }
    return value;
  },
};

module.exports = {
  pool,
  redisClient,
  db: dbHelpers,
  redis: redisHelpers,
  // Export for testing
  _testOnly: {
    createPool,
    connectRedis,
  },
};
