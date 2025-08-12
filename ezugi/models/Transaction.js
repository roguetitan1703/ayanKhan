const { db, redis } = require("../config/database");
const logger = require("../../utils/logger");
const ezugiConfig = require("../config/ezugi");

//Transaction model - FIXED VERSION
class Transaction {
  constructor(transactionData = {}) {
    this.transactionId = transactionData.transactionId;
    this.uid = transactionData.uid;
    this.operatorId = transactionData.operatorId;
    this.type = transactionData.type;
    this.amount = transactionData.amount;
    this.currency = transactionData.currency;
    this.gameId = transactionData.gameId;
    this.roundId = transactionData.roundId;
    this.tableId = transactionData.tableId;
    this.seatId = transactionData.seatId;
    this.betTypeId = transactionData.betTypeId;
    this.status = transactionData.status;
    this.debitTransactionId = transactionData.debitTransactionId;
    this.returnReason = transactionData.returnReason;
    this.isEndRound = transactionData.isEndRound;
    this.creditIndex = transactionData.creditIndex;
    this.gameDataString = transactionData.gameDataString;
    this.serverId = transactionData.serverId;
    this.platformId = transactionData.platformId;
    this.bonusAmount = transactionData.bonusAmount;
    this.createdAt = transactionData.createdAt;
    this.updatedAt = transactionData.updatedAt;
  }

  // FIXED: Create transaction with proper error handling
  static async create(transactionData) {
    try {
      console.log("=== Transaction.create Debug ===");
      console.log("Creating transaction with data:", transactionData);

      const query = `INSERT INTO transactions (
        transaction_id, user_id, operator_id, transaction_type, amount, currency,
        game_id, round_id, table_id, seat_id, bet_type_id, status,
        server_id, platform_id, timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;

      const params = [
        transactionData.transactionId,
        transactionData.uid,
        transactionData.operatorId,
        transactionData.type,
        transactionData.amount || 0,
        transactionData.currency || "INR",
        transactionData.gameId,
        transactionData.roundId,
        transactionData.tableId,
        transactionData.seatId,
        transactionData.betTypeId,
        transactionData.status || "pending",
        transactionData.serverId,
        transactionData.platformId,
        transactionData.timestamp || Date.now(),
      ];

      console.log("Executing query:", query);
      console.log("With parameters:", params);

      const result = await db.query(query, params);
      console.log("Insert result:", result);

      logger.transactionLog(
        "Transaction created",
        transactionData.transactionId,
        transactionData.amount,
        transactionData.uid,
        "success",
        {
          type: transactionData.type,
          gameId: transactionData.gameId,
          roundId: transactionData.roundId,
        }
      );

      // Return the created transaction
      const createdTransaction = await this.findById(
        transactionData.transactionId
      );
      console.log(
        "✅ Transaction created successfully:",
        createdTransaction?.transactionId
      );
      return createdTransaction;
    } catch (error) {
      console.error("=== Transaction.create Error ===");
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);
      console.error("Transaction data:", transactionData);

      logger.errorLog(error, {
        context: "Transaction.create",
        transactionData,
      });
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  }

  // FIXED: findById with correct column mapping
  static async findById(transactionId) {
    try {
      console.log("=== Transaction.findById Debug ===");
      console.log("Looking for transaction ID:", transactionId);

      const query = `SELECT * FROM transactions WHERE transaction_id = ?`;
      console.log("Query:", query);

      const result = await db.query(query, [transactionId]);
      console.log("Raw database result:", result);
      console.log("Result type:", typeof result);
      console.log("Is array:", Array.isArray(result));

      // Handle both array and single object returns
      let transaction = null;

      if (Array.isArray(result) && result.length > 0) {
        transaction = result[0];
      } else if (
        result &&
        typeof result === "object" &&
        result.transaction_id
      ) {
        transaction = result;
      }

      if (!transaction) {
        console.log("No transaction found");
        return null;
      }

      console.log("Found transaction data:", transaction);
      console.log("Transaction keys:", Object.keys(transaction));

      // FIXED: Map database columns to JavaScript properties
      const txData = {
        transactionId: transaction.transaction_id,
        uid: transaction.user_id, // ✅ FIXED: was tx.uid, should be tx.user_id
        operatorId: transaction.operator_id,
        type: transaction.transaction_type, // ✅ FIXED: map transaction_type
        amount: parseFloat(transaction.amount || 0),
        currency: transaction.currency,
        gameId: transaction.game_id,
        roundId: transaction.round_id,
        tableId: transaction.table_id,
        seatId: transaction.seat_id,
        betTypeId: transaction.bet_type_id,
        status: transaction.status,
        debitTransactionId: transaction.debit_transaction_id,
        returnReason: transaction.return_reason, // ✅ FIXED: was return_Reason (typo)
        isEndRound: transaction.is_end_round,
        creditIndex: transaction.credit_index,
        gameDataString: transaction.game_data_string,
        serverId: transaction.server_id,
        platformId: transaction.platform_id,
        bonusAmount: parseFloat(transaction.bonus_amount || 0),
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
      };

      console.log("Mapped transaction data:", txData);

      const txInstance = new Transaction(txData);
      console.log("✅ Transaction instance created");
      return txInstance;
    } catch (error) {
      console.error("=== Transaction.findById Error ===");
      console.error("Error message:", error.message);
      console.error("Transaction ID:", transactionId);

      logger.errorLog(error, {
        context: "Transaction.findById",
        transactionId,
      });
      throw new Error(`Failed to find transaction: ${error.message}`);
    }
  }

  // FIXED: updateStatus with correct SQL syntax
  async updateStatus(newStatus) {
    try {
      console.log("=== Transaction.updateStatus Debug ===");
      console.log(
        `Updating transaction ${this.transactionId} status to: ${newStatus}`
      );

      // ✅ FIXED: Added missing comma in SQL
      const query = `UPDATE transactions 
        SET status = ?, updated_at = NOW() 
        WHERE transaction_id = ?`;

      console.log("Update query:", query);
      console.log("Parameters:", [newStatus, this.transactionId]);

      const result = await db.query(query, [newStatus, this.transactionId]);
      console.log("Update result:", result);

      // Update instance status
      const oldStatus = this.status;
      this.status = newStatus;

      logger.transactionLog(
        "Transaction status updated",
        this.transactionId,
        this.amount,
        this.uid,
        "success",
        {
          oldStatus: oldStatus,
          newStatus: newStatus,
        }
      );

      console.log(`✅ Status updated from ${oldStatus} to ${newStatus}`);
      return true;
    } catch (error) {
      console.error("=== Transaction.updateStatus Error ===");
      console.error("Error message:", error.message);
      console.error("Transaction ID:", this.transactionId);
      console.error("New status:", newStatus);

      logger.errorLog(error, {
        context: "Transaction.updateStatus",
        transactionId: this.transactionId,
        newStatus,
      });
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }
  }

  //Find transaction by roundId and user
  static async findByRoundAndUser(roundId, uid, operatorId) {
    try {
      const query = `SELECT * FROM transactions
        WHERE round_id = ? AND user_id = ? AND operator_id = ?
        ORDER BY created_at ASC`;

      const result = await db.query(query, [roundId, uid, operatorId]);

      // Handle both array and single object returns
      const transactions = Array.isArray(result)
        ? result
        : result
        ? [result]
        : [];

      return transactions.map(
        (tx) =>
          new Transaction({
            transactionId: tx.transaction_id,
            uid: tx.user_id, // ✅ FIXED
            operatorId: tx.operator_id,
            type: tx.transaction_type, // ✅ FIXED
            amount: parseFloat(tx.amount || 0),
            currency: tx.currency,
            gameId: tx.game_id,
            roundId: tx.round_id,
            tableId: tx.table_id,
            seatId: tx.seat_id,
            betTypeId: tx.bet_type_id,
            status: tx.status,
            debitTransactionId: tx.debit_transaction_id,
            returnReason: tx.return_reason, // ✅ FIXED
            isEndRound: tx.is_end_round,
            creditIndex: tx.credit_index,
            gameDataString: tx.game_data_string,
            serverId: tx.server_id,
            platformId: tx.platform_id,
            bonusAmount: parseFloat(tx.bonus_amount || 0),
            createdAt: tx.created_at,
            updatedAt: tx.updated_at,
          })
      );
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.findByRoundAndUser",
        roundId,
        uid,
      });
      throw new Error("Failed to find transaction");
    }
  }

  //Check if transaction exist and was processed
  static async exists(transactionId) {
    try {
      const query = `SELECT COUNT(*) as count FROM transactions
        WHERE transaction_id = ?`;

      const result = await db.query(query, [transactionId]);

      // Handle both array and single object returns
      const count = Array.isArray(result) ? result[0].count : result.count;
      return count > 0;
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.exists",
        transactionId,
      });
      return false;
    }
  }

  //Check if debit transaction was processed for a credit
  static async isDebitProcessed(debitTransactionId) {
    try {
      const transaction = await this.findById(debitTransactionId);
      return transaction && transaction.status === "completed";
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.isDebitProcessed",
        debitTransactionId,
      });
      return false;
    }
  }

  //Check if credit was already processed for a debit
  static async isCreditProcessed(debitTransactionId) {
    try {
      const query = `SELECT COUNT(*) as count FROM transactions
        WHERE debit_transaction_id = ? AND transaction_type = 'credit' AND status = 'completed'`;

      const result = await db.query(query, [debitTransactionId]);
      const count = Array.isArray(result) ? result[0].count : result.count;
      return count > 0;
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.isCreditProcessed",
        debitTransactionId,
      });
      return false;
    }
  }

  //Get round statistics for validation
  static async getRoundStatistics(roundId, uid, operatorId) {
    try {
      const query = `SELECT transaction_type, COUNT(*) as count,
        SUM(amount) as total_amount,
        seat_id FROM transactions
        WHERE round_id = ? AND user_id = ? AND operator_id = ? AND status = 'completed'
        GROUP BY transaction_type, seat_id`;

      const result = await db.query(query, [roundId, uid, operatorId]);
      const stats = Array.isArray(result) ? result : result ? [result] : [];

      return {
        debits: stats.filter((s) => s.transaction_type === "debit"),
        credits: stats.filter((s) => s.transaction_type === "credit"),
        rollbacks: stats.filter((s) => s.transaction_type === "rollback"),
      };
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.getRoundStatistics",
        roundId,
        uid,
      });
      throw new Error("Failed to get round statistics");
    }
  }

  //Mark transaction as rolled back
  async markRollback() {
    try {
      await this.updateStatus("rolled_back"); // ✅ FIXED: consistent status name

      const cacheKey = `rolled_back:${this.transactionId}`;
      await redis.set(cacheKey, true, 3600);

      logger.transactionLog(
        "transaction_rolled_back",
        this.transactionId,
        this.amount,
        this.uid,
        "success"
      );
      return true;
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.markRollback",
        transactionId: this.transactionId,
      });
      throw new Error("Failed to mark transaction as rolled back");
    }
  }

  //Check if transaction was rolled back
  static async isRolledback(transactionId) {
    try {
      const cacheKey = `rolled_back:${transactionId}`;
      const isRolledback = await redis.exists(cacheKey);

      if (isRolledback) {
        return true;
      }

      //check database
      const transaction = await this.findById(transactionId);
      return (
        transaction &&
        (transaction.status === "rolled_back" ||
          transaction.status === "roll_back")
      );
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.isRolledback",
        transactionId,
      });
      return false;
    }
  }

  //Store transaction in cache for quick access
  async storeInCache(expirySeconds = 3600) {
    try {
      const cacheKey = `transaction:${this.transactionId}`;
      const transactionData = {
        transactionId: this.transactionId,
        uid: this.uid,
        operatorId: this.operatorId,
        type: this.type,
        amount: this.amount,
        currency: this.currency,
        gameId: this.gameId,
        roundId: this.roundId,
        status: this.status,
        createdAt: this.createdAt,
      };
      await redis.set(cacheKey, JSON.stringify(transactionData), expirySeconds);
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.storeInCache",
        transactionId: this.transactionId,
      });
    }
  }

  //Get transaction from cache
  static async getFromCache(transactionId) {
    try {
      const cacheKey = `transaction:${transactionId}`;
      const transactionDataStr = await redis.get(cacheKey);

      if (transactionDataStr) {
        const transactionData = JSON.parse(transactionDataStr);
        return new Transaction(transactionData);
      }
      return null;
    } catch (error) {
      logger.errorLog(error, {
        context: "Transaction.getFromCache",
        transactionId,
      });
      return null;
    }
  }

  //Convert to JSON for API response
  toJSON() {
    return {
      transactionId: this.transactionId,
      uid: this.uid,
      operatorId: this.operatorId,
      type: this.type,
      amount: parseFloat(this.amount || 0),
      currency: this.currency,
      gameId: this.gameId,
      roundId: this.roundId,
      tableId: this.tableId,
      seatId: this.seatId,
      betTypeId: this.betTypeId,
      status: this.status,
      debitTransactionId: this.debitTransactionId,
      returnReason: this.returnReason,
      isEndRound: this.isEndRound,
      creditIndex: this.creditIndex,
      bonusAmount: parseFloat(this.bonusAmount || 0),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  //get transaction summary for logging
  getSummary() {
    return {
      id: this.transactionId,
      type: this.type,
      amount: this.amount,
      game: this.gameId,
      round: this.roundId,
      status: this.status,
      user: this.uid,
    };
  }
}

module.exports = Transaction;
