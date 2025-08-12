const express = require("express");
const morgan = require("morgan");
require("dotenv").config();

console.log("✅ Basic requires loaded");

// Wrap middleware imports in try-catch to catch any issues
let middlewares;
try {
  console.log("About to import middlewares...");
  middlewares = require("./middlewares/index");
  console.log(
    "✅ Middlewares imported successfully:",
    Object.keys(middlewares)
  );
} catch (middlewareError) {
  console.error("❌ ERROR importing middlewares:", middlewareError.message);
  console.error("Stack:", middlewareError.stack);
  process.exit(1);
}

const {
  cors,
  secuirtyHeaders, // Note: there's a typo in your original - should be "securityHeaders"
  requestLogger,
  errorHandler,
  timeout,
  healthCheck,
  maintenanceMode,
} = middlewares;

console.log("✅ Middlewares destructured");

// Import routes with error handling
let ezugiRoutes, apiRoutes;
try {
  console.log("About to import routes...");
  ezugiRoutes = require("./routes/ezugiRoutes");
  apiRoutes = require("./routes/apiRoutes");
  console.log("✅ Routes imported successfully");
} catch (routeError) {
  console.error("❌ ERROR importing routes:", routeError.message);
  console.error("Stack:", routeError.stack);
  process.exit(1);
}

// Import utilities with error handling
let logger;
try {
  console.log("About to import logger...");
  logger = require("./utils/logger");
  console.log("✅ Logger imported successfully");
} catch (loggerError) {
  console.error("❌ ERROR importing logger:", loggerError.message);
  console.error("Stack:", loggerError.stack);
  process.exit(1);
}

// Import config with error handling
let operatorId, currency, callbacks;
try {
  console.log("About to import ezugi config...");
  const ezugiConfig = require("./config/ezugi");
  ({ operatorId, currency, callbacks } = ezugiConfig);
  console.log("✅ Ezugi config imported successfully");
} catch (configError) {
  console.error("❌ ERROR importing ezugi config:", configError.message);
  console.error("Stack:", configError.stack);
  process.exit(1);
}

// Import controllers with error handling
let authentication, debit, rollback, getNewToken;
try {
  console.log("About to import controllers...");
  const controllers = require("./controller/ezugiController");
  ({ authentication, debit, rollback, getNewToken } = controllers);
  console.log("✅ Controllers imported successfully");
} catch (controllerError) {
  console.error("❌ ERROR importing controllers:", controllerError.message);
  console.error("Stack:", controllerError.stack);
  process.exit(1);
}

console.log("✅ All imports completed successfully");

const app = express();
const PORT = process.env.PORT || 3000;

console.log("✅ Express app created, PORT:", PORT);
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // store raw buffer
    },
  })
);
// Validate required environment variables
const requiredEnvVars = [
  "EZUGI_OPERATOR_ID",
  "EZUGI_CURRENCY",
  "CALLBACK_BASE_URL",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
  } else {
    console.log(`✅ ${envVar}:`, process.env[envVar]);
  }
}

// Body parsing setup
try {
  console.log("Setting up body parsing...");

  app.use(
    express.json({
      limit: "50mb",
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: "50mb",
      verify: (req, res, buf) => {
        if (!req.rawBody) {
          req.rawBody = buf;
        }
      },
    })
  );

  console.log("✅ Body parsing middlewares applied");
} catch (bodyParsingError) {
  console.error("❌ Error setting up body parsing:", bodyParsingError);
  process.exit(1);
}

try {
  // Trust proxy for accurate IP detection
  app.set("trust proxy", 1);
  console.log("✅ Trust proxy set successfully");

  console.log("About to apply middlewares...");

  // Check if middlewares exist before applying
  if (typeof secuirtyHeaders !== "function") {
    console.error(
      "❌ secuirtyHeaders is not a function:",
      typeof secuirtyHeaders
    );
    process.exit(1);
  }
  app.use(secuirtyHeaders);
  console.log("✅ Security headers applied");

  if (typeof cors !== "function") {
    console.error("❌ cors is not a function:", typeof cors);
    process.exit(1);
  }
  app.use(cors);
  console.log("✅ CORS applied");

  if (typeof timeout !== "function") {
    console.error("❌ timeout is not a function:", typeof timeout);
    process.exit(1);
  }
  app.use(timeout(30000));
  console.log("✅ Timeout applied");

  if (typeof maintenanceMode !== "function") {
    console.error(
      "❌ maintenanceMode is not a function:",
      typeof maintenanceMode
    );
    process.exit(1);
  }
  app.use(maintenanceMode);
  console.log("✅ Maintenance mode applied");

  // Logging middleware (skip in test environment)
  if (process.env.NODE_ENV !== "test") {
    app.use(
      morgan("combined", {
        stream: {
          write: (message) => {
            if (logger && typeof logger.info === "function") {
              logger.info(message.trim());
            } else {
              console.log("MORGAN:", message.trim());
            }
          },
        },
      })
    );
    console.log("✅ Morgan logging applied");
  }

  // Request logging middleware
  if (typeof requestLogger !== "function") {
    console.error("❌ requestLogger is not a function:", typeof requestLogger);
    process.exit(1);
  }
  app.use(requestLogger);
  console.log("✅ Request logger applied");

  // Routes
  console.log("About to set up routes...");

  if (typeof healthCheck !== "function") {
    console.error("❌ healthCheck is not a function:", typeof healthCheck);
    process.exit(1);
  }
  app.get("/health", healthCheck);
  console.log("✅ Health route set");

  // Apply general API routes first
  if (typeof apiRoutes !== "function" && typeof apiRoutes !== "object") {
    console.error("❌ apiRoutes is not valid:", typeof apiRoutes);
    process.exit(1);
  }
  app.use("/api", apiRoutes);
  console.log("✅ API routes set");

  // Apply Ezugi specific routes
  if (typeof ezugiRoutes !== "function" && typeof ezugiRoutes !== "object") {
    console.error("❌ ezugiRoutes is not valid:", typeof ezugiRoutes);
    process.exit(1);
  }
  app.use("/api/callback/ezugi", ezugiRoutes);
  console.log("✅ Ezugi routes set");

  // Root endpoint
  app.get("/", (req, res) => {
    res.json({
      name: "Ezugi Casino API Integration",
      version: "1.0.0",
      status: "running",
      timestamp: Date.now(),
      environment: process.env.NODE_ENV,
      endpoints: {
        health: "/health",
        api: "/api",
        ezugiCallbacks: "/api/callback/ezugi",
      },
    });
  });
  console.log("✅ Root endpoint set");

  // 404 Handler
  console.log("About to set up 404 handler...");
  app.use((req, res) => {
    try {
      console.log("404 handler called for:", req.originalUrl);

      // Check if logger exists and has securityLog method
      if (logger && typeof logger.securityLog === "function") {
        logger.securityLog("404 endpoint access", req.ip, null, {
          method: req.method,
          url: req.originalUrl,
          userAgent: req.get("User-Agent"),
        });
      } else {
        console.log("Logger.securityLog not available");
      }

      res.status(404).json({
        success: false,
        message: "Endpoint not found",
        timestamp: Date.now(),
      });
    } catch (error404) {
      console.error("❌ Error in 404 handler:", error404);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  console.log("✅ 404 handler set");

  // Error handling middleware
  console.log("About to set up error handling middleware...");
  if (!errorHandler || typeof errorHandler !== "function") {
    console.error("❌ errorHandler is not a function:", errorHandler);
    // Provide a basic error handler as fallback
    app.use((err, req, res, next) => {
      console.error("❌ Error caught by fallback handler:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        timestamp: Date.now(),
      });
    });
  } else {
    app.use(errorHandler);
    console.log("✅ Error handler set");
  }
} catch (error) {
  console.error("❌ ERROR during server setup:", error);
  console.error("Stack trace:", error.stack);
  process.exit(1);
}

// Start server
console.log("About to start server...");
console.log("PORT value:", PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);

// Check if PORT is valid
if (!PORT || isNaN(PORT)) {
  console.error("❌ Invalid PORT value:", PORT);
  process.exit(1);
}

console.log("About to call app.listen...");

try {
  const server = app.listen(PORT, (err) => {
    if (err) {
      console.error("❌ Error in listen callback:", err);
      return;
    }

    console.log("✅ Server listen callback called successfully");
    console.log(`✅ Server running on http://localhost:${PORT}`);

    // Test if logger is working
    try {
      console.log("About to call logger.info...");

      // Check if logger exists and has info method
      if (!logger || typeof logger.info !== "function") {
        console.error("❌ Logger is not properly initialized:", logger);
        return;
      }

      logger.info(`Server listening on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        operatorId: process.env.EZUGI_OPERATOR_ID,
        currency: process.env.EZUGI_CURRENCY,
        callbacks: {
          authentication: `${process.env.CALLBACK_BASE_URL}/authentication`,
          debit: `${process.env.CALLBACK_BASE_URL}/debit`,
          credit: `${process.env.CALLBACK_BASE_URL}/credit`,
          rollback: `${process.env.CALLBACK_BASE_URL}/rollback`,
          getNewToken: `${process.env.CALLBACK_BASE_URL}/get-new-token`,
        },
      });
      console.log("✅ Logger.info called successfully");
    } catch (loggerError) {
      console.error("❌ Error with logger:", loggerError);
      console.error("Logger error stack:", loggerError.stack);
    }
  });

  console.log("✅ app.listen() called successfully, server object:", !!server);

  // Check if server object was created properly
  if (!server) {
    console.error("❌ Server object is null/undefined");
    process.exit(1);
  }

  // Add error event listener for the server
  server.on("error", (serverError) => {
    console.error("❌ Server error event:", serverError);
    if (serverError.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use`);
    } else if (serverError.code === "EACCES") {
      console.error(`❌ Permission denied for port ${PORT}`);
    }
  });

  console.log("✅ Server error handler attached");

  // Graceful shutdown handlers
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  function gracefulShutdown(signal) {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    if (logger && logger.info) {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
    }

    server.close(() => {
      console.log("HTTP Server closed");
      if (logger && logger.info) {
        logger.info("HTTP Server closed");
      }

      // Close database connections
      try {
        const { pool, redisClient } = require("./config/database");

        Promise.all([
          pool.end().catch((err) => {
            console.error("Error closing MySQL pool:", err);
            if (logger && logger.error)
              logger.error("Error closing MySQL pool:", err);
          }),
          redisClient.quit().catch((err) => {
            console.error("Error closing Redis client:", err);
            if (logger && logger.error)
              logger.error("Error closing Redis client:", err);
          }),
        ])
          .then(() => {
            console.log("All connections closed. Exiting process.");
            if (logger && logger.info)
              logger.info("All connections closed. Exiting process.");
            process.exit(0);
          })
          .catch((err) => {
            console.error("Error during shutdown:", err);
            if (logger && logger.error)
              logger.error("Error during shutdown:", err);
            process.exit(1);
          });
      } catch (err) {
        console.error("Error accessing database during shutdown:", err);
        if (logger && logger.error)
          logger.error("Error accessing database during shutdown:", err);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      const message =
        "Could not close connections in time. Forcefully shutting down.";
      console.error(message);
      if (logger && logger.error) logger.error(message);
      process.exit(1);
    }, 10000);
  }

  // Global error handlers
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", { promise, reason });
    if (logger && logger.error) {
      logger.error("Unhandled Rejection at:", { promise, reason });
    }

    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", {
      error: error.message,
      stack: error.stack,
    });
    if (logger && logger.error) {
      logger.error("Uncaught Exception:", {
        error: error.message,
        stack: error.stack,
      });
    }
    process.exit(1);
  });
} catch (serverError) {
  console.error("❌ Error calling app.listen:", serverError);
  console.error("Server error stack:", serverError.stack);
  process.exit(1);
}

module.exports = app;
