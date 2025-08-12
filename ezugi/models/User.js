const { db, redis } = require("../config/database");
const CryptoUtils = require("../../utils/crypto");
const logger = require("../../utils/logger");

//Handles user authentication and session management
class User {
  constructor(userData = {}) {
    this.uid = userData.uid;
    this.operatorId = userData.operatorId;
    this.nickName = userData.nickName;
    this.balance = userData.balance || 0;
    this.currency = userData.currency || "INR";
    this.language = userData.language || "en";
    this.vipLevel = userData.vipLevel || 0;
    this.status = userData.status || "active";
    this.createdAt = userData.createdAt;
    this.updatedAt = userData.updatedAt;
  }

  //Find user by uid and operatorId
  static async findByUid(uid, operatorId) {
    try {
      console.log("=== findByUid Debug Start ===");
      console.log("Input params:", { uid, operatorId });
      console.log("Param types:", {
        uid: typeof uid,
        operatorId: typeof operatorId,
      });

      // FIXED: Use correct database column names (snake_case)
      const query = `SELECT * FROM users WHERE uid = ? AND operator_id = ? AND status = 'active'`;
      console.log("Query:", query);
      console.log("Query params:", [uid, operatorId]);

      const users = await db.query(query, [uid, operatorId]);

      console.log("Raw database result:", users);
      console.log("Result type:", typeof users);
      console.log("Is array:", Array.isArray(users));

      // MAIN FIX: Your db.query is returning a SINGLE OBJECT, not an array
      // Database result aapka single object hai, array nahi
      let user = null;

      if (Array.isArray(users) && users.length > 0) {
        // If it's an array (some DB drivers)
        console.log("Users array length:", users.length);
        user = users[0];
        console.log("Found user from array:", user);
      } else if (users && typeof users === "object" && users.uid) {
        // If it's a single object (your case)
        console.log("Result is single user object");
        user = users;
        console.log("Found user as single object:", user);
      } else {
        console.log("No user found in database");
        console.log("=== findByUid Debug End ===");
        return null;
      }

      if (!user) {
        console.log("No user data available");
        console.log("=== findByUid Debug End ===");
        return null;
      }

      console.log("=== Creating User instance ===");
      console.log("User raw data:", user);
      console.log("User keys:", Object.keys(user));

      // FIXED: Map database columns to JavaScript properties
      const userData = {
        uid: user.uid,
        operatorId: user.operator_id, // database: operator_id
        nickName: user.nick_name, // database: nick_name
        balance: parseFloat(user.balance || 0),
        currency: user.currency,
        language: user.language,
        vipLevel: user.vip_level, // database: vip_level
        status: user.status,
        createdAt: user.created_at, // database: created_at
        updatedAt: user.updated_at, // database: updated_at
      };

      console.log("Mapped user data:", userData);

      const userInstance = new User(userData);
      console.log("Created user instance:", userInstance.toJSON());
      console.log("=== findByUid Debug End ===");

      return userInstance;
    } catch (error) {
      console.error("=== findByUid Error ===");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Input params were:", { uid, operatorId });

      logger.errorLog(error, { context: "User.findByUid", uid, operatorId });
      throw new Error("Failed to find user");
    }
  }

  //Create new User
  static async create(userData) {
    try {
      // FIXED: Use correct database column names (snake_case)
      const query = `INSERT INTO users (
      uid, operator_id, nick_name, balance, currency,
      language, vip_level, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW() )`;

      await db.query(query, [
        userData.uid,
        userData.operatorId,
        userData.nickName || `Player_${userData.uid}`,
        userData.balance || 0,
        userData.currency || "INR",
        userData.language || "en",
        userData.vipLevel || 0,
      ]);

      logger.info("New User created", {
        uid: userData.uid,
        operatorId: userData.operatorId,
      });

      return await this.findByUid(userData.uid, userData.operatorId);
    } catch (error) {
      logger.errorLog(error, { context: "User.create", userData });
      throw new Error("Failed to create user");
    }
  }

  // FIXED: Simplified updateBalance method
  async updateBalance(newBalance, transactionId = null) {
    try {
      console.log(`=== updateBalance Debug ===`);
      console.log(
        `Current balance: ${this.balance}, New balance: ${newBalance}`
      );
      console.log(`User: ${this.uid}, Operator: ${this.operatorId}`);
      console.log(`Transaction ID: ${transactionId}`);

      // FIXED: Use simple db.query instead of complex transaction
      const updateQuery = `UPDATE users 
        SET balance = ?, updated_at = NOW() 
        WHERE uid = ? AND operator_id = ?`;

      console.log(`Update Query: ${updateQuery}`);
      console.log(`Update Params:`, [newBalance, this.uid, this.operatorId]);

      // Execute balance update
      const updateResult = await db.query(updateQuery, [
        newBalance,
        this.uid,
        this.operatorId,
      ]);

      console.log(`Update result:`, updateResult);

      // Update instance balance
      const oldBalance = this.balance;
      this.balance = parseFloat(newBalance);

      console.log(`Balance updated from ${oldBalance} to ${this.balance}`);

      // Optional: Log balance history if table exists
      if (transactionId) {
        try {
          const changeAmount = newBalance - oldBalance;
          const balanceLogQuery = `INSERT INTO balance_history (
            uid, operator_id, old_balance, new_balance, change_amount, transaction_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())`;

          await db.query(balanceLogQuery, [
            this.uid,
            this.operatorId,
            oldBalance,
            newBalance,
            changeAmount,
            transactionId,
          ]);
          console.log(`Balance history logged`);
        } catch (historyError) {
          console.log(
            `Balance history logging failed (table might not exist):`,
            historyError.message
          );
          // Continue execution - history logging is optional
        }
      }

      // Update cache
      await this.updateCache();

      logger.transactionLog(
        "balance_update",
        transactionId,
        newBalance - oldBalance,
        this.uid,
        "success",
        {
          oldBalance: oldBalance,
          newBalance: newBalance,
        }
      );

      console.log(`=== updateBalance Success ===`);
      return true;
    } catch (error) {
      console.error(`=== updateBalance Error ===`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack:`, error.stack);

      logger.errorLog(error, {
        context: "User.updateBalance",
        uid: this.uid,
        oldBalance: this.balance,
        newBalance,
        transactionId,
      });

      return false; // Return false instead of throwing error
    }
  }

  //Check if user has sufficient balance
  hasSufficientBalance(amount) {
    return parseFloat(this.balance) >= parseFloat(amount);
  }

  // IMPROVED debit method with better error handling
  async debit(amount, transactionId) {
    try {
      console.log(`=== debit Debug ===`);
      console.log(`Debit amount: ${amount}, Current balance: ${this.balance}`);
      console.log(`Transaction ID: ${transactionId}`);

      // Check sufficient balance
      if (!this.hasSufficientBalance(amount)) {
        console.log(`Insufficient balance: ${this.balance} < ${amount}`);
        logger.securityLog("Insufficient funds attempt", null, this.uid, {
          requestedAmount: amount,
          currentBalance: this.balance,
          transactionId,
        });
        return false;
      }

      // Calculate new balance
      const newBalance = parseFloat(this.balance) - parseFloat(amount);
      console.log(`New balance will be: ${newBalance}`);

      // Update balance in database
      const result = await this.updateBalance(newBalance, transactionId);

      if (result) {
        console.log(`Debit successful. New balance: ${this.balance}`);
        logger.transactionLog(
          "debit",
          transactionId,
          amount,
          this.uid,
          "success",
          {
            oldBalance: parseFloat(this.balance) + parseFloat(amount),
            newBalance: this.balance,
          }
        );
      } else {
        console.log(`Debit failed - database update failed`);
      }

      console.log(`=== debit Complete ===`);
      return result;
    } catch (error) {
      console.error(`=== debit Error ===`);
      console.error(`Error message: ${error.message}`);
      logger.errorLog(error, {
        context: "User.debit",
        uid: this.uid,
        amount,
        transactionId,
      });
      return false;
    }
  }

  //Credit Amount to user balance
  async credit(amount, transactionId) {
    try {
      console.log(`=== credit Debug ===`);
      console.log(`Credit amount: ${amount}, Current balance: ${this.balance}`);
      console.log(`Transaction ID: ${transactionId}`);

      const newBalance = parseFloat(this.balance) + parseFloat(amount);
      console.log(`New balance will be: ${newBalance}`);

      const result = await this.updateBalance(newBalance, transactionId);

      if (result) {
        console.log(`Credit successful. New balance: ${this.balance}`);
        logger.transactionLog(
          "credit",
          transactionId,
          amount,
          this.uid,
          "success",
          {
            oldBalance: parseFloat(this.balance) - parseFloat(amount),
            newBalance: this.balance,
          }
        );
      } else {
        console.log(`Credit failed - database update failed`);
      }

      console.log(`=== credit Complete ===`);
      return result;
    } catch (error) {
      console.error(`=== credit Error ===`);
      console.error(`Error message: ${error.message}`);
      logger.errorLog(error, {
        context: "User.credit",
        uid: this.uid,
        amount,
        transactionId,
      });
      return false;
    }
  }

  //Generate session token
  async generateSessionToken() {
    try {
      const token = CryptoUtils.generateToken(32);
      const expiryTime = Date.now() + 40 * 60 * 1000; // 40 minutes

      //Store token in redis with expiration
      const tokenData = {
        uid: this.uid,
        operatorId: this.operatorId,
        balance: this.balance,
        currency: this.currency,
        expiryTime,
      };
      await redis.set(`session:${token}`, tokenData, 2400); // 40 minutes
      logger.info("Session token generated", {
        uid: this.uid,
        tokenLength: token.length,
      });
      return token;
    } catch (error) {
      logger.errorLog(error, {
        context: "User.generateSessionToken",
        uid: this.uid,
      });
      throw new Error("Failed to generate session token");
    }
  }

  //Validate session token
  static async validateSessionToken(token) {
    try {
      // FIXED: Remove extra space in redis key
      const tokenData = await redis.get(`session:${token}`);
      if (!tokenData) {
        return null;
      }
      if (tokenData.expiryTime && Date.now() > tokenData.expiryTime) {
        await redis.del(`session:${token}`);
        return null;
      }
      return tokenData;
    } catch (error) {
      logger.errorLog(error, {
        context: "User.validateSessionToken",
      });
      return null;
    }
  }

  //Generate launch token
  async generateLaunchToken() {
    try {
      const token = CryptoUtils.generateToken(32);
      const expiryTime = Date.now() + 60 * 1000;

      const tokenData = {
        uid: this.uid,
        operatorId: this.operatorId,
        type: "launch",
        expiryTime,
      };

      await redis.set(`launch:${token}`, tokenData, 60);
      logger.info("Launch token generated", {
        uid: this.uid,
      });
      return token;
    } catch (error) {
      logger.errorLog(error, {
        context: "User.generateLaunchToken",
        uid: this.uid,
      });
      throw new Error("Failed to generate launch token");
    }
  }

  //Validate Launch token
  static async validateLaunchToken(token) {
    try {
      // FIXED: Remove extra space in redis key
      const tokenData = await redis.get(`launch:${token}`);

      if (!tokenData) {
        return null;
      }

      if (tokenData.expiryTime && Date.now() > tokenData.expiryTime) {
        await redis.del(`launch:${token}`);
        return null;
      }
      return tokenData;
    } catch (error) {
      logger.errorLog(error, {
        context: "User.validateLaunchToken",
      });
      return null;
    }
  }

  //Invalidate token
  static async invalidateToken(token, type = "session") {
    // FIXED: Added missing parameter
    try {
      await redis.del(`${type}:${token}`);
      logger.info("Token invalidated", {
        tokenType: type,
      });
    } catch (error) {
      logger.errorLog(error, {
        context: "User.invalidateToken",
        type,
      });
    }
  }

  //Update user in cache
  async updateCache() {
    try {
      const cacheKey = `user:${this.operatorId}:${this.uid}`;
      const userData = {
        uid: this.uid,
        operatorId: this.operatorId,
        nickName: this.nickName,
        balance: this.balance,
        currency: this.currency,
        language: this.language,
        vipLevel: this.vipLevel,
        status: this.status,
        lastUpdated: Date.now(),
      };
      await redis.set(cacheKey, userData, 300);
    } catch (error) {
      logger.errorLog(error, {
        context: "User.updateCache",
        uid: this.uid,
      });
    }
  }

  //Get user from cache
  static async getFromCache(uid, operatorId) {
    try {
      const cacheKey = `user:${operatorId}:${uid}`;
      const userData = await redis.get(cacheKey);

      if (userData) {
        return new User(userData);
      }
      return null;
    } catch (error) {
      logger.errorLog(error, {
        context: "User.getFromCache",
        uid,
        operatorId,
      });
      return null;
    }
  }

  //Block user
  async block(reason = "Manual Block") {
    try {
      // FIXED: Use correct database column names (snake_case)
      const query = `UPDATE users
      SET status = 'blocked', updated_at = NOW()
      WHERE uid = ? AND operator_id = ?`;

      await db.query(query, [this.uid, this.operatorId]);
      this.status = "blocked";

      logger.securityLog("User blocked", null, this.uid, {
        reason,
      });
      return true;
    } catch (error) {
      logger.errorLog(error, {
        context: "User.block",
        uid: this.uid,
        reason,
      });
      throw new Error("Failed to block user");
    }
  }

  //Check if user is blocked
  isBlocked() {
    return this.status === "blocked";
  }

  //Get user's transaction history
  async getTransactionHistory(limit = 50, offset = 0) {
    try {
      // FIXED: Use correct database column names (snake_case)
      const query = `SELECT * FROM transactions
      WHERE user_id = ? AND operator_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`;

      const transactions = await db.query(query, [
        this.uid,
        this.operatorId,
        limit,
        offset,
      ]);

      // Handle both array and single object returns
      const txArray = Array.isArray(transactions)
        ? transactions
        : [transactions].filter((tx) => tx);

      // FIXED: Map database columns to JavaScript properties
      return txArray.map((tx) => ({
        transactionId: tx.transaction_id,
        type: tx.transaction_type,
        amount: parseFloat(tx.amount),
        gameId: tx.game_id,
        roundId: tx.round_id,
        status: tx.status,
        createdAt: tx.created_at,
      }));
    } catch (error) {
      logger.errorLog(error, {
        context: "User.getTransactionHistory", // FIXED: typo in 'context'
        uid: this.uid,
      });
      throw new Error("Failed to get user's transaction history");
    }
  }

  //Convert to JSON for API response
  toJSON() {
    return {
      uid: this.uid,
      operatorId: this.operatorId,
      nickName: this.nickName,
      balance: parseFloat(this.balance),
      currency: this.currency,
      language: this.language,
      vipLevel: this.vipLevel,
      status: this.status,
    };
  }
}

module.exports = User;
