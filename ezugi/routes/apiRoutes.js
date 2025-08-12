const express = require("express");
const EzugiContoller = require("../ezugi/controller/ezugiController");
const {
  validateRequest,
  validateHashSignature,
  ipWhiteList,
} = require("../ezugi/middlewares/index");
const { schemas } = require("../utils/validation");
const { config } = require("dotenv");
const { version } = require("joi");

const router = express.Router();

router.post("/launch-url", EzugiContoller.generateLaunchUrl);

//create test user
router.post("/test-users", async (req, res) => {
  try {
    const User = require("../ezugi/models/User");
    const ezugiConfig = require("../config/ezugi");

    console.log("Ezugi config:", ezugiConfig);

    const testUsers = [
      {
        uid: "test_user_001",
        operatorId: ezugiConfig.operatorId,
        nickName: "Test Player 1",
        balance: 10000.0,
        currency: "INR",
        language: "en",
        vipLevel: "1",
      },
      {
        uid: "test_user_002",
        operatorId: ezugiConfig.operatorId,
        nickName: "Test Player 2",
        balance: 5000.0,
        currency: "INR",
        language: "en",
        vipLevel: "1",
      },
    ];
    const createdUsers = [];
    for (const userData of testUsers) {
      console.log("Processing user:", userData);

      let user = await User.findByUid(userData.uid, userData.operatorId);
      console.log("Found existing user:", user ? "Yes" : "No");

      if (!user) {
        user = await User.create(userData);
      }
      createdUsers.push(user.toJSON());
    }
    res.status(200).json({
      success: true,
      message: "Test users created successfully",
      users: createdUsers,
    });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.errorLog(error, { context: "createTestUsers" });

    res.status(500).json({
      success: false,
      message: "Failed to create test users",
      error: error.message,
    });
  }
});

//Get user balance
router.get("/user/:uid/balance", async (req, res) => {
  try {
    const { uid } = req.params;
    const operatorId = req.query.operatorId || process.env.EZUGI_OPERATOR_ID;

    const User = require("../ezugi/models/User");

    const user = await User.findByUid(uid, parseInt(operatorId));

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      uid: user.uid,
      balance: user.balance,
      currency: user.currency,
    });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.errorLog(error, { context: "getUserBalance" });

    res.status(500).json({
      success: false,
      message: "Failed to get user balance",
      error: error.message,
    });
  }
});

//Update user balance
router.put("/user/:uid/balance", async (req, res) => {
  try {
    const { uid } = req.params;
    const { balance, operatorId } = req.body;

    if (typeof balance !== "number" || balance < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid balance amount",
      });
    }

    const User = require("../ezugi/models/User");
    const user = await User.findByUid(
      uid,
      operatorId || parseInt(process.env.EZUGI_OPERATOR_ID)
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    await User.updateBalance(balance, `balance_update_${Date.now()}`);

    res.status(200).json({
      success: true,
      message: "User balance updated successfully",
      uid: user.uid,
      newBalance: user.balance,
      currency: user.currency,
    });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.errorLog(error, { context: "updateUserBalance" });

    res.status(500).json({
      success: false,
      message: "Failed to update user balance",
    });
  }
});

//Get transaction hsitory
router.get("/user/:uid/transactions", async (req, res) => {
  try {
    const { uid } = req.params;
    const { limit = 50, offset = 0, operatorId } = req.query;

    const User = require("../ezugi/models/User");
    const user = await User.findByUid(
      uid,
      parseInt(operatorId) || parseInt(process.env.EZUGI_OPERATOR_ID)
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const transactions = await user.getTransactionHistory(
      parseInt(limit),
      parseInt(offset)
    );
    res.status(200).json({
      success: true,
      uid: user.uid,
      transactions,
      totalCount: transactions.length,
    });
  } catch (error) {
    const logger = require("../utils/logger");
    logger.errorLog(error, { context: "getUserTransactions" });

    res.status(500).json({
      success: false,
      message: "Failed to get user transactions",
      error: error.message,
    });
  }
});

//System status
router.get("/system/status", async (req, res) => {
  const ezugiConfig = require("../config/ezugi");

  res.status(200).json({
    success: true,
    status: "running",
    timestamp: Date.now(),
    config: {
      operatorId: ezugiConfig.operatorId,
      currency: ezugiConfig.currency,
      enviroment: process.env.NODE_ENV,
      callbacks: process.env.CALLBACK_BASE_URL,
    },
    upTime: process.uptime(),
    memory: process.memoryUsage(),
    version: "1.0.0",
  });
});

module.exports = router;
