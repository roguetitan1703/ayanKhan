const express = require("express");
const EzugiContoller = require("../ezugi/controller/ezugiController");

// Import all middlewares from the main index file
const {
  validateRequest,
  validateHashSignature, // This is already available in your middleware exports
  ipWhiteList,
} = require("../ezugi/middlewares/index");

const { schemas } = require("../utils/validation");

const router = express.Router();

console.log("✅ Ezugi routes - All imports successful");
console.log("✅ Available middleware functions:", {
  validateRequest: typeof validateRequest,
  validateHashSignature: typeof validateHashSignature,
  ipWhiteList: typeof ipWhiteList,
});

// ===== DEBUG MIDDLEWARE =====
router.use((req, res, next) => {
  console.log("=== EZUGI ROUTE DEBUG ===");
  console.log("1. Method:", req.method);
  console.log("2. URL:", req.url);
  console.log("3. Content-Type:", req.get("Content-Type"));
  console.log("4. Content-Length:", req.get("Content-Length"));
  console.log("5. Body exists:", !!req.body);
  console.log("6. Body keys:", req.body ? Object.keys(req.body) : "No body");
  console.log("7. Raw body exists:", !!req.rawBody);
  console.log("8. Headers:", {
    hash: req.headers.hash,
    "content-type": req.headers["content-type"],
    "user-agent": req.headers["user-agent"],
  });
  next();
});

// ===== IP WHITELIST =====
router.use(ipWhiteList);

// ===== BODY VALIDATION =====
const validateBodyExists = (req, res, next) => {
  console.log("=== BODY VALIDATION ===");
  console.log("Body exists:", !!req.body);
  console.log("Body keys:", req.body ? Object.keys(req.body) : []);

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      errorCode: 1,
      errorDescription: "Request body is required",
      timestamp: Date.now(),
    });
  }

  console.log("✅ Body validation passed");
  next();
};

// ===== ROUTES =====
router.post(
  "/authentication",
  validateBodyExists,
  validateRequest(schemas.authenticationRequest),
  validateHashSignature, // Using the one from middleware/index.js
  EzugiContoller.authentication
);

router.post(
  "/debit",
  validateBodyExists,
  validateRequest(schemas.debitRequest),
  validateHashSignature,
  EzugiContoller.debit
);

router.post(
  "/credit",
  validateBodyExists,
  validateRequest(schemas.creditRequest),
  validateHashSignature,
  EzugiContoller.credit
);

router.post(
  "/rollback",
  validateBodyExists,
  validateRequest(schemas.rollbackRequest),
  validateHashSignature,
  EzugiContoller.rollback
);

router.post(
  "/get-new-token",
  validateBodyExists,
  validateRequest(schemas.getNewTokenRequest),
  validateHashSignature,
  EzugiContoller.getNewToken
);

console.log("✅ Ezugi routes - All routes defined successfully");

module.exports = router;
