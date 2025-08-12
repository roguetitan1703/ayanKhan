const User = require("../models/User");
const CryptoUtils = require("../../utils/crypto");
const logger = require("../../utils/logger");
const Transaction = require("../models/Transaction");
const ezugiConfig = require("../config/ezugi");
const { error } = require("winston");
const { request } = require("express");

// Hash Signature Validation Middleware - FIXED
const validateHashSignature = (req, res, next) => {
  try {
    // Check for hash in headers first, then body
    const hash = req.headers.hash || req.body.hash;

    if (!hash) {
      logger.securityLog("Missing hash signature", req.ip, null, req.body);
      return res.status(200).json({
        operatorId: req.body.operatorId,
        errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
        errorDescription: "Hash signature required",
        timestamp: Date.now(),
      });
    }

    console.log("=== HASH SIGNATURE VALIDATION ===");
    console.log("Header trimmed:", hash.trim());

    // ACTUAL hash validation - ENABLE THIS
    const expectedHash = CryptoUtils.calculateHash(
      req.body,
      ezugiConfig.secretKey
    );
    console.log("Computed expectedHash:", expectedHash);

    if (hash.trim() !== expectedHash) {
      logger.securityLog("Invalid hash signature", req.ip, req.body.uid, {
        received: hash.substring(0, 10) + "...",
        expected: expectedHash.substring(0, 10) + "...",
      });
      return res.status(200).json({
        operatorId: req.body.operatorId,
        errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
        errorDescription: "Authentication failed",
        timestamp: Date.now(),
      });
    }

    console.log("✅ Hash validation passed");
    next();
  } catch (error) {
    logger.errorLog(error, { context: "validateHashSignature" });
    return res.status(200).json({
      operatorId: req.body.operatorId,
      errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
      errorDescription: "Authentication failed",
      timestamp: Date.now(),
    });
  }
};

//Ezugi API contoller
class EzugiController {
  static async authentication(req, res) {
    try {
      console.log("=== AUTHENTICATION DEBUG ===");
      console.log("req.body:", req.body);
      console.log("req.body type:", typeof req.body);
      console.log("req.body keys:", Object.keys(req.body || {}));

      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
          errorDescription: "Request body is empty or invalid",
          timestamp: Date.now(),
        });
      }

      const { platformId, operatorId, token, timestamp } = req.body;
      logger.ezugiLog("authentication_request", req.body, null, "processing");

      const tokenData = await User.validateLaunchToken(token);
      if (!tokenData) {
        logger.securityLog("Invalid launch token", req.ip, null, {
          token: token.substring(0, 8) + "...",
        });
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.TOKEN_NOT_FOUND,
          errorDescription: "Token not found or expired",
          timestamp: Date.now(),
        });
      }

      //Find User
      const user = await User.findByUid(tokenData.uid, operatorId);
      if (!user) {
        logger.securityLog(
          "User not found during authentication",
          req.ip,
          tokenData.uid
        );
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.USER_NOT_FOUND,
          errorDescription: "User not found",
          timestamp: Date.now(),
        });
      }

      //Check if user is blocked
      if (user.isBlocked()) {
        logger.securityLog(
          "User blocked during authentication",
          req.ip,
          user.uid
        );
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.USER_BLOCKED,
          errorDescription: "User is blocked",
          timestamp: Date.now(),
        });
      }

      //Generate session token
      const sessionToken = await user.generateSessionToken();
      await User.invalidateToken(token, "launch");

      const response = {
        operatorId,
        uid: user.uid,
        nickName: user.nickName || `Player_${user.uid}`,
        token: sessionToken,
        playerTokenAtLaunch: token,
        balance: user.balance,
        currency: user.currency,
        language: user.language,
        VIP: user.vipLevel,
        errorCode: ezugiConfig.errorCodes.SUCCESS,
        errorDescription: "ok",
        timestamp: Date.now(),
      };
      logger.ezugiLog("authentication_success", req.body, response, "success");
      res.status(200).json(response);
    } catch (error) {
      logger.errorLog(error, {
        context: "EzugiController.authentication",
        requestData: req.body,
      });
      res.status(200).json({
        operatorId: req.body.operatorId,
        errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
        errorDescription: "Authentication failed",
        timestamp: Date.now(),
      });
    }
  }

  // DEBIT API - COMPLETELY FIXED
  static async debit(req, res) {
    try {
      const {
        gameId,
        debitAmount,
        platformId,
        serverId,
        transactionId,
        token,
        uid,
        betTypeId,
        tableId,
        seatId,
        currency,
        operatorId,
        roundId,
        timestamp,
      } = req.body;

      console.log("=== DEBIT REQUEST DEBUG ===");
      console.log("Transaction ID:", transactionId);
      console.log("UID:", uid);
      console.log("Debit Amount:", debitAmount);

      logger.ezugiLog("debit_request", req.body, null, "processing");

      // Validate session token
      const tokenData = await User.validateSessionToken(token);
      if (!tokenData) {
        logger.securityLog("Invalid session token in debit", req.ip, uid);
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.TOKEN_NOT_FOUND,
          errorDescription: "Token not found or expired",
          timestamp: Date.now(),
        });
      }

      // Find user FIRST (before any transaction logic)
      const user = await User.findByUid(uid, operatorId);
      if (!user) {
        logger.securityLog("User not found in debit", req.ip, uid);
        return res.status(200).json({
          uid,
          operatorId,
          nickName: `Player_${uid}`,
          token,
          balance: 0,
          transactionId,
          timestamp: Date.now(),
          currency: currency || "INR",
          errorCode: ezugiConfig.errorCodes.USER_NOT_FOUND,
          roundId,
          bonusAmount: 0,
          errorDescription: "User not found",
        });
      }

      console.log("✅ User found:", user.uid, "Balance:", user.balance);

      // Validate transactionId
      if (!transactionId) {
        logger.securityLog("Missing transactionId in debit", req.ip, uid);
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
          errorDescription: "transactionId is required",
          timestamp: Date.now(),
        });
      }

      // FIXED: Duplicate transaction check with PROPER response
      const existingTransaction = await Transaction.findById(transactionId);
      if (existingTransaction) {
        logger.securityLog("Duplicate Transaction attempt", req.ip, uid, {
          transactionId,
        });

        // FIXED: Return SUCCESS for already completed transactions
        if (existingTransaction.status === "completed") {
          // Refresh user data to get latest balance
          const updatedUser = await User.findByUid(uid, operatorId);
          return res.status(200).json({
            uid,
            operatorId,
            nickName: updatedUser?.nickName || `Player_${uid}`,
            token,
            balance: updatedUser?.balance || 0,
            transactionId,
            timestamp: Date.now(),
            currency: currency || updatedUser?.currency || "INR",
            errorCode: ezugiConfig.errorCodes.SUCCESS, // ✅ FIXED: SUCCESS code
            roundId,
            bonusAmount: 0,
            errorDescription: "ok", // ✅ FIXED: Success message
          });
        }

        // FIXED: Return proper error for pending transactions
        return res.status(200).json({
          uid,
          operatorId,
          nickName: user.nickName || `Player_${uid}`,
          token,
          balance: user.balance, // ✅ FIXED: Show actual balance
          transactionId,
          timestamp: Date.now(),
          currency: currency || user.currency,
          errorCode: 1, // ✅ FIXED: Use proper error code for "in progress"
          roundId,
          bonusAmount: 0,
          errorDescription: "Transaction in progress",
        });
      }

      // Parse and validate amount
      const amount = parseFloat(debitAmount);
      if (isNaN(amount) || amount <= 0) {
        logger.securityLog("Invalid debit amount", req.ip, uid, {
          debitAmount,
        });
        return res.status(200).json({
          uid,
          operatorId,
          nickName: user.nickName,
          token,
          balance: user.balance,
          transactionId,
          timestamp: Date.now(),
          currency,
          errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
          roundId,
          bonusAmount: 0,
          errorDescription: "Invalid amount",
        });
      }

      console.log("✅ Amount validated:", amount);

      // Check if user has sufficient balance
      if (user.balance < amount) {
        logger.securityLog("Insufficient funds", req.ip, uid, {
          balance: user.balance,
          requested: amount,
        });
        return res.status(200).json({
          uid,
          operatorId,
          nickName: user.nickName,
          token,
          balance: user.balance,
          transactionId,
          timestamp: Date.now(),
          currency,
          errorCode: ezugiConfig.errorCodes.INSUFFICIENT_FUNDS,
          roundId,
          bonusAmount: 0,
          errorDescription: "Insufficient funds",
        });
      }

      // FIXED: Create transaction record FIRST
      const transaction = await Transaction.create({
        transactionId,
        uid,
        operatorId,
        type: "debit",
        amount: amount,
        currency,
        gameId,
        roundId,
        tableId,
        seatId,
        betTypeId,
        serverId,
        platformId,
        status: "pending",
      });

      console.log("✅ Transaction created:", transaction.transactionId);

      // FIXED: Perform the actual debit with proper error handling
      try {
        const debitResult = await user.debit(amount, transactionId);

        if (!debitResult) {
          // Debit failed - mark transaction as failed
          await transaction.updateStatus("failed");
          logger.securityLog("Debit failed", req.ip, uid, {
            amount,
            balance: user.balance,
          });

          return res.status(200).json({
            uid,
            operatorId,
            nickName: user.nickName,
            token,
            balance: user.balance,
            transactionId,
            timestamp: Date.now(),
            currency,
            errorCode: ezugiConfig.errorCodes.INSUFFICIENT_FUNDS,
            roundId,
            bonusAmount: 0,
            errorDescription: "Insufficient funds",
          });
        }

        // SUCCESS: Mark transaction as completed
        await transaction.updateStatus("completed");

        // FIXED: Get updated user balance after debit
        const updatedUser = await User.findByUid(uid, operatorId);

        console.log("✅ Debit successful. New balance:", updatedUser.balance);

        const response = {
          uid,
          operatorId,
          nickName: updatedUser.nickName,
          token,
          balance: updatedUser.balance, // ✅ FIXED: Show updated balance
          transactionId,
          timestamp: Date.now(),
          currency,
          errorCode: ezugiConfig.errorCodes.SUCCESS,
          roundId,
          bonusAmount: 0,
          errorDescription: "ok",
        };

        logger.ezugiLog("debit_success", req.body, response, "success");
        res.status(200).json(response);
      } catch (debitError) {
        // Debit operation failed - mark transaction as failed
        await transaction.updateStatus("failed");

        logger.errorLog(debitError, {
          context: "User.debit failed",
          uid,
          amount,
          transactionId,
        });

        return res.status(200).json({
          uid,
          operatorId,
          nickName: user.nickName,
          token,
          balance: user.balance,
          transactionId,
          timestamp: Date.now(),
          currency,
          errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
          roundId,
          bonusAmount: 0,
          errorDescription: "Debit operation failed",
        });
      }
    } catch (error) {
      logger.errorLog(error, {
        context: "EzugiController.debit",
        requestData: req.body,
      });

      res.status(200).json({
        uid: req.body.uid,
        operatorId: req.body.operatorId,
        nickName: `Player_${req.body.uid}`,
        token: req.body.token,
        balance: 0,
        transactionId: req.body.transactionId,
        timestamp: Date.now(),
        currency: req.body.currency || "INR",
        errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
        roundId: req.body.roundId,
        bonusAmount: 0,
        errorDescription: "Debit failed",
      });
    }
  }

  // Keep all other methods unchanged (credit, rollback, etc.)
  static async credit(req, res) {
    try {
      const {
        gameId,
        debitTransactionId,
        isEndRound,
        creditIndex,
        gameDataString,
        platformId,
        serverId,
        transactionId,
        token,
        uid,
        returnReason,
        betTypeId,
        tableId,
        seatId,
        currency,
        creditAmount,
        operatorId,
        roundId,
        timestamp,
      } = req.body;

      logger.ezugiLog("credit_request", req.body, null, "processing");

      //validate session token
      const tokenData = await User.validateSessionToken(token);
      if (!tokenData) {
        logger.securityLog("Invalid session token in credit", req.ip, uid);
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.TOKEN_NOT_FOUND,
          errorDescription: "Token not found or expired",
          timestamp: Date.now(),
        });
      }

      //Check if crdit transaction already exists
      const existingTransaction = await Transaction.findById(transactionId);
      if (existingTransaction) {
        logger.securityLog("Duplicate credit transaction", req.ip, uid, {
          transactionId,
        });
        if (existingTransaction.status === "completed") {
          const user = await User.findByUid(uid, operatorId);
          return res.status(200).json({
            operatorId,
            uid,
            nickName: user?.nickName || `Player_${uid}`,
            token,
            balance: user?.balance || 0,
            transactionId,
            currency,
            timestamp: Date.now(),
            errorCode: ezugiConfig.errorCodes.SUCCESS,
            roundId,
            errorDescription: "Transaction already processed",
          });
        }
      }

      //Validate debit transaction correlation as per documentation
      const debitExists = await Transaction.isDebitProcessed(
        debitTransactionId
      );
      const creditAlreadyProcessed = await Transaction.isCreditProcessed(
        debitTransactionId
      );
      if (!debitExists && !debitTransactionId) {
        logger.securityLog("Credit without corresponding debit", req.ip, uid, {
          creditTransactionId: transactionId,
          debitTransactionId,
        });
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.TRANSACTION_NOT_FOUND,
          errorDescription: "Corresponding debit transaction not found",
          timestamp: Date.now(),
        });
      }
      if (creditAlreadyProcessed) {
        logger.securityLog("Debit already processed", req.ip, uid, {
          debitTransactionId,
        });
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
          errorDescription: "Debit transaction already processed",
          timestamp: Date.now(),
        });
      }

      //Find user
      const user = await User.findByUid(uid, operatorId);
      if (!user) {
        logger.securityLog("User not found in credit", req.ip, uid);
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.USER_NOT_FOUND,
          errorDescription: "User not found",
          timestamp: Date.now(),
        });
      }
      //Create  Credit transaction record
      const transaction = await Transaction.create({
        transactionId,
        uid,
        operatorId,
        type: "credit",
        amount: creditAmount,
        currency,
        gameId,
        roundId,
        tableId,
        seatId,
        betTypeId: betTypeId,
        serverId,
        platformId,
        debitTransactionId,
        returnReason,
        isEndRound,
        creditIndex,
        gameDataString,
        status: "pending",
      });

      if (creditAmount > 0) {
        await user.credit(creditAmount, transactionId);
      }

      await transaction.updateStatus("completed");

      const response = {
        operatorId,
        uid,
        nickName: user.nickName,
        token,
        balance: user.balance,
        transactionId,
        currency,
        timestamp: Date.now(),
        errorCode: ezugiConfig.errorCodes.SUCCESS,
        roundId,
        bonusAmount: 0,
        errorDescription: "ok",
      };
      logger.ezugiLog("credit_success", req.body, response, "success");
      res.status(200).json(response);
    } catch (error) {
      logger.ezugiLog(error, {
        context: "EzugiContoller.credit",
        requestData: req.body,
      });
      res.status(200).json({
        operatorId: req.body.operatorId,
        errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
        errorDescription: "Credit failed",
        timestamp: Date.now(),
      });
    }
  }

  //Rollback API - Cancel debit transaction
  static async rollback(req, res) {
    try {
      const {
        operatorId,
        uid,
        transactionId,
        gameId,
        token,
        rollbackAmount,
        betTypeID,
        serverId,
        roundId,
        currency,
        seatId,
        platformId,
        tableId,
        timestamp,
      } = req.body;
      logger.ezugiLog("rollback_request", req.body, null, "processing");

      const tokenData = await User.validateSessionToken(token);
      if (!tokenData) {
        logger.securityLog("Invalid session token in rollback", req.ip, uid);
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.TOKEN_NOT_FOUND,
          errorDescription: "Token not found or expired",
          timestamp: Date.now(),
        });
      }

      //Find the original debt transaction
      const originalTransaction = await Transaction.findById(transactionId);

      if (!originalTransaction) {
        logger.securityLog(
          "Rollback for non-existent transaction",
          req.ip,
          uid,
          { transactionId }
        );
        return res.status(200).json({
          errorCode: ezugiConfig.errorCodes.TRANSACTION_NOT_FOUND,
          errorDescription: "Transaction not found",
          timestamp: Date.now(),
          operatorId,
          roundId,
          uid,
          token,
          balance: tokenData.balance || 0,
          transactionId,
          currency,
        });
      }

      //Check if transaction was rolled back
      if (await Transaction.isRolledback(transactionId)) {
        logger.securityLog("Duplicate rollback attempt", req.ip, uid, {
          transactionId,
        });
        const user = await User.findByUid(uid, operatorId);
        return res.status(200).json({
          errorCode: ezugiConfig.errorCodes.SUCCESS,
          errorDescription: "Transaction already rolled back",
          timestamp: Date.now(),
          operatorId,
          roundId,
          uid,
          token,
          balance: user.balance || 0,
          transactionId,
          currency,
        });
      }

      //Find user
      const user = await User.findByUid(uid, operatorId);
      if (!user) {
        logger.securityLog("User not found in rollback", req.ip, uid);
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.USER_NOT_FOUND,
          errorDescription: "User not found",
          timestamp: Date.now(),
        });
      }

      //Validate rollback amount matches original debit
      if (
        originalTransaction.status === "completed" &&
        originalTransaction.amount !== rollbackAmount
      ) {
        logger.securityLog("Rollback amount mismatch", req.ip, uid, {
          transactionId,
          originalAmount: originalTransaction.amount,
          rollbackAmount,
        });
        return res.status(200).json({
          errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
          errorDescription: "Rollback amount mismatch",
          timestamp: Date.now(),
          operatorId,
          roundId,
          uid,
          token,
          balance: user.balance,
          transactionId,
          currency,
        });
      }

      //Process rollback based on original transaction status
      if (originalTransaction.status === "completed") {
        await user.credit(rollbackAmount, transactionId);
        await originalTransaction.markRollback();

        logger.transactionLog(
          "rollback_processed",
          transactionId,
          rollbackAmount,
          uid,
          "success"
        );
      } else {
        await originalTransaction.markRollback();
        logger.transactionLog(
          "rollback_ignored",
          transactionId,
          rollbackAmount,
          uid,
          "success",
          {
            reason: "Original transaction  was not completed",
          }
        );
      }

      const response = {
        errorCode: ezugiConfig.errorCodes.SUCCESS,
        errorDescription: "Rollback processed successfully",
        timestamp: Date.now(),
        operatorId,
        roundId,
        uid,
        token,
        balance: user.balance,
        transactionId,
        currency,
      };
      logger.ezugiLog("rollback_success", req.body, response, "success");
      res.status(200).json(response);
    } catch (error) {
      logger.errorLog(error, {
        cotext: "EzugiController.rollback",
        requestData: req.body,
      });
      res.status(200).json({
        operatorId: req.body.operatorId,
        errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
        errorDescription: "Rollback failed",
        timestamp: Date.now(),
      });
    }
  }

  //Get new token API - Generate new token for game launch
  static async getNewToken(req, res) {
    try {
      const { currentToken, gameId, uid, tableId, operatorId, timestamp } =
        req.body;

      logger.ezugiLog("get_new_token_request", req.body, null, "processing");

      const tokenData = await User.validateSessionToken(currentToken);
      if (!tokenData) {
        logger.securityLog(
          "Invalid current token in get new token",
          req.ip,
          uid
        );
        return res.status(401).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.TOKEN_NOT_FOUND,
          errorDescription: "Token not found or expired",
          timestamp: Date.now(),
        });
      }

      //Find User
      const user = await User.findByUid(uid, operatorId);
      if (!user) {
        logger.securityLog("User not found in get new token", req.ip, uid);
        return res.status(200).json({
          operatorId,
          errorCode: ezugiConfig.errorCodes.USER_NOT_FOUND,
          errorDescription: "User not found",
          timestamp: Date.now(),
        });
      }

      //Generate new session token
      const newToken = await user.generateSessionToken();
      await User.invalidateToken(currentToken, "session");

      const response = {
        errorCode: ezugiConfig.errorCodes.SUCCESS,
        errorDescription: "ok",
        operatorId,
        token: newToken,
        balance: user.balance,
        uid,
        timestamp: Date.now(),
      };
      logger.ezugiLog("get_new_token_success", req.body, response, "success");
      res.status(200).json(response);
    } catch (error) {
      logger.errorLog(error, {
        context: "EzugiController.getNewToken",
        requestData: req.body,
      });
      res.status(200).json({
        operatorId: req.body.operatorId,
        errorCode: ezugiConfig.errorCodes.GENERAL_ERROR,
        errorDescription: "Failed to generate new token",
        timestamp: Date.now(),
      });
    }
  }

  //Generate launch URL for Ezugi games
  static async generateLaunchUrl(req, res) {
    try {
      console.log("=== Generate Launch URL Debug ===");
      console.log("Request body:", req.body);

      const { uid, operatorId, gameId, tableId, language = "en" } = req.body;

      // Validate required parameters
      if (!uid || !operatorId) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameters: uid, operatorId",
        });
      }

      console.log("Step 1: Looking up user...");
      // Find User
      const user = await User.findByUid(uid, parseInt(operatorId));
      if (!user) {
        console.log("User not found");
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      console.log("Step 2: User found:", user.toJSON());

      if (user.isBlocked()) {
        console.log("User is blocked");
        return res.status(403).json({
          success: false,
          message: "User is blocked",
        });
      }

      console.log("Step 3: Generating launch token...");
      // Generate launch token
      const launchToken = await user.generateLaunchToken();
      console.log("Launch token generated successfully");

      console.log("Step 4: Building launch URL...");
      // Generate launch URL
      let launchUrl = `${ezugiConfig.integrationUrl}?operatorId=${operatorId}&token=${launchToken}&language=${language}&clientType=html5`;

      if (tableId) {
        launchUrl += `&openTable=${tableId}`;
      } else if (gameId) {
        const gameNames = {
          // Game mappings
          1: "blackjack",
          10: "american blackjack",
          11: "american hybrid blackjack",
          12: "unlimited blackjack",
          46: "blackjack salon prive",
          2: "baccarat",
          20: "baccarat knockout",
          21: "baccarat super six",
          25: "no commission baccarat",
          26: "baccarat dragon bonus",
          27: "baccarat queenco",
          70: "ez baccarat",
          3: "roulette",
          7: "automatic roulette",
          29: "roulette portomaso",
          30: "bet on roulette",
          31: "american roulette",
          32: "triple roulette",
          48: "ez dealer roulette",
          54: "ultimate roulette",
          38: "andar bahar",
          39: "ott andar bahar",
          55: "ultimate andar bahar",
          16: "bet on teen patti",
          17: "three card poker and teen patti",
          43: "one day teen patti",
          50: "one day teen patti back and lay",
          24: "dragon tiger",
          19: "32 cards",
          60: "xoc dia",
          15: "casino holdem",
          53: "royal poker",
          14: "sic bo",
          52: "ultimate sic bo",
          13: "lucky 7",
          45: "cricket war",
          47: "dream catcher",
        };
        if (gameNames[gameId]) {
          launchUrl += `&selectgame=${encodeURIComponent(gameNames[gameId])}`;
        }
      }

      console.log("Step 5: Launch URL generated successfully");
      console.log(
        "Launch URL (sanitized):",
        launchUrl.replace(/token=([^&]+)/g, "token=***")
      );

      logger.info("Launch URL generated", { uid, operatorId, gameId, tableId });

      res.status(200).json({
        success: true,
        launchUrl: launchUrl,
        token: launchToken,
        user: {
          uid: user.uid,
          balance: user.balance,
          currency: user.currency,
        },
      });
    } catch (error) {
      console.error("=== Generate Launch URL Error ===");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      logger.errorLog(error, {
        context: "EzugiController.generateLaunchUrl",
        requestBody: req.body,
      });

      res.status(500).json({
        success: false,
        message: "Failed to generate launch URL",
        error: error.message,
      });
    }
  }
}

module.exports = EzugiController;
