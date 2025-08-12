import axios from "axios";
import connection from "../config/connectDB.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Updated credentials from Spribe
const SECRET_TOKEN = "P8cs7H7swSnr1WwDRNQOBCPQjCLvkOlQ";
const OPERATOR_KEY = "reddybook75new";
const API_URL = "https://dev-test.spribe.io/games/launch";
const RETURN_URL = "https://75club.games/";
const CURRENCY = "INR";

// File logging setup
const LOG_DIR = "./logs";
const SPRIBE_LOG_FILE = path.join(LOG_DIR, "spribe.log");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Enhanced logging function for Spribe
function logSpribe(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data,
  };

  // Console output
  console.log(`[SPRIBE][${level}]`, message, data ? data : "");

  // File output
  const logLine = `${timestamp} [SPRIBE][${level}] ${message} ${data ? JSON.stringify(data) : ""}\n`;
  fs.appendFileSync(SPRIBE_LOG_FILE, logLine);
}

const generateToken = (playerId, timestamp) => {
  const payload = `${playerId}:${timestamp}`;
  return crypto
    .createHmac("sha256", SECRET_TOKEN)
    .update(payload)
    .digest("hex");
};

const generateHashSignature = (token, timestamp) => {
  const payload = `${token}:${timestamp}`;
  return crypto
    .createHmac("sha256", SECRET_TOKEN)
    .update(payload)
    .digest("base64");
};

// Utility to get raw body (see note below)
function getRawBody(req) {
  if (req.rawBody) return req.rawBody;
  // Fallback: reconstruct from req.body if needed (not as secure)
  return JSON.stringify(req.body);
}

export function validateSpribeSignature(req, secret = SECRET_TOKEN) {
  const clientId = req.headers["x-spribe-client-id"];
  const timestamp = req.headers["x-spribe-client-ts"];
  const signature = req.headers["x-spribe-client-signature"];

  logSpribe("SIGNATURE_DEBUG", "Signature validation attempt", {
    clientId,
    timestamp,
    signature,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });

  if (!clientId || !timestamp || !signature) {
    logSpribe("SIGNATURE_ERROR", "Missing required headers");
    return false;
  }

  // Build the string to sign
  const pathWithQuery = req.originalUrl.split("?")[0]; // e.g., /api/callback/spribe/auth
  const rawBody = getRawBody(req);

  const stringToSign = `${timestamp}${pathWithQuery}${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(stringToSign)
    .digest("hex");

  logSpribe("SIGNATURE_DEBUG", "Signature calculation", {
    pathWithQuery,
    rawBody,
    stringToSign,
    expectedSignature,
    receivedSignature: signature,
    isValid: signature === expectedSignature,
  });

  return signature === expectedSignature;
}

// export const spribeLaunchGame = async (req, res) => {
//   const userToken = req.userToken || req.cookies?.auth;
//   const { gameName } = req.body;

//   console.log("[SPRIBE][LAUNCH]", { userToken, gameName });

//   if (!userToken) {
//     return res.status(401).json({
//       errorCode: 1,
//       message: "Authentication required",
//     });
//   }

//   try {
//     const [userRows] = await connection.query(
//       "SELECT * FROM users WHERE token = ?",
//       [userToken],
//     );

//     console.log("[SPRIBE][LAUNCH]", { userRows: userRows.length });
//     // Check if user exists
//     if (!userRows.length) {
//       return res.status(404).json({
//         errorCode: 4,
//         message: "Token expired or invalid",
//       });
//     }
//     const user = userRows[0];
//     const playerId = user.phone; // or user.id_user, depending on your logic
//     const userId = user.id_user;

//     // Generate token
//     const timestamp = Date.now();
//     //const token = generateToken(playerId, timestamp);

//     // Modify the token generation block
//     let token;
//     try {
//       if (!playerId) throw new Error("playerId is undefined");
//       token = generateToken(playerId, timestamp);
//       logSpribe("TOKEN_GENERATED", "Game token created", {
//         playerId,
//         token: token ? "***REDACTED***" : null,
//       });
//     } catch (err) {
//       logSpribe("TOKEN_ERROR", "Token generation failed", {
//         error: err.message,
//         playerId,
//         userId,
//       });
//       return res.status(500).json({ error: "Token generation failed" });
//     }

//     // Save token for later validation
//     // await connection.query(
//     //   "UPDATE users SET spribeLaunchToken = ? WHERE phone = ?",
//     //   [token, playerId],
//     // );

//     try {
//       const [updateResult] = await connection.query(
//         "UPDATE users SET spribeLaunchToken = ? WHERE phone = ?",
//         [token, playerId],
//       );

//       console.log("[SPRIBE][DB_UPDATE]", {
//         affectedRows: updateResult.affectedRows,
//         changedRows: updateResult.changedRows,
//       });

//       if (updateResult.affectedRows === 0) {
//         throw new Error("Failed to update user token");
//       }
//     } catch (dbError) {
//       console.error("[SPRIBE][DB_UPDATE_ERROR]", dbError);
//       return res.status(500).json({
//         error: "Database update failed",
//         details: dbError.message,
//       });
//     }

//     // Build launch URL
//     const launchUrl = `${API_URL}/${gameName}?user=${userId}&token=${token}&currency=${CURRENCY}&lang=EN&return_url=${encodeURIComponent(RETURN_URL)}&operator=${OPERATOR_KEY}`;

//     // Respond
//     return res.json({ Data: launchUrl });
//   } catch (error) {
//     console.error("[SPRIBE][LAUNCH][EXCEPTION]", error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// };

export const spribeLaunchGame = async (req, res) => {
  // Start transaction timer
  console.time("[SPRIBE][LAUNCH_GAME_TOTAL_TIME]");

  try {
    // 1. Initial connection check
    console.log("[SPRIBE][CONNECTION_POOL]", {
      free: connection.pool?._freeConnections?.length,
      all: connection.pool?._allConnections?.length,
      state: connection.state,
    });

    // 2. Request validation
    const userToken = req.userToken || req.cookies?.auth;
    const { gameName } = req.body;

    console.log("[SPRIBE][REQUEST_DETAILS]", {
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: { ...req.body, userToken: userToken ? "***REDACTED***" : null },
    });

    if (!userToken) {
      console.log("[SPRIBE][AUTH_ERROR]", "No user token provided");
      return res.status(401).json({
        errorCode: 1,
        message: "Authentication required",
      });
    }

    // 3. User lookup
    console.time("[SPRIBE][USER_LOOKUP_TIME]");
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE token = ?",
      [userToken],
    );
    console.timeEnd("[SPRIBE][USER_LOOKUP_TIME]");

    console.log("[SPRIBE][USER_LOOKUP_RESULT]", {
      userCount: userRows.length,
      userId: userRows[0]?.id_user || null,
    });

    if (!userRows.length) {
      console.log("[SPRIBE][USER_NOT_FOUND]", { userToken });
      return res.status(404).json({
        errorCode: 4,
        message: "Token expired or invalid",
      });
    }

    // 4. Prepare user data
    const user = userRows[0];
    const playerId = user.phone;
    const userId = user.id_user;

    console.log("[SPRIBE][USER_DETAILS]", {
      userId,
      playerId,
      hasPhone: !!playerId,
    });

    if (!playerId) {
      console.log("[SPRIBE][INVALID_USER_DATA]", "Missing phone number");
      return res.status(400).json({
        errorCode: 2,
        message: "User profile incomplete",
      });
    }

    // 5. Token generation
    console.time("[SPRIBE][TOKEN_GENERATION_TIME]");
    const timestamp = Date.now();
    let token;

    try {
      token = generateToken(playerId, timestamp);
      console.timeEnd("[SPRIBE][TOKEN_GENERATION_TIME]");
      console.log("[SPRIBE][TOKEN_GENERATED]", {
        playerId,
        tokenLength: token?.length,
        timestamp,
      });
    } catch (err) {
      console.error("[SPRIBE][TOKEN_ERROR]", {
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({
        errorCode: 5,
        message: "Token generation failed",
        details: err.message,
      });
    }

    // 6. Database update
    console.time("[SPRIBE][DB_UPDATE_TIME]");
    try {
      const [updateResult] = await connection.query(
        "UPDATE users SET spribeLaunchToken = ? WHERE phone = ?",
        [token, playerId],
      );

      console.timeEnd("[SPRIBE][DB_UPDATE_TIME]");
      console.log("[SPRIBE][DB_UPDATE_RESULT]", {
        affectedRows: updateResult.affectedRows,
        changedRows: updateResult.changedRows,
      });

      if (updateResult.affectedRows === 0) {
        throw new Error("No rows were updated");
      }
    } catch (dbError) {
      console.error("[SPRIBE][DB_UPDATE_FAILED]", {
        error: dbError.message,
        sqlMessage: dbError.sqlMessage,
        code: dbError.code,
      });
      return res.status(500).json({
        errorCode: 6,
        message: "Database update failed",
        details: dbError.message,
      });
    }

    // 7. URL construction
    console.time("[SPRIBE][URL_CONSTRUCTION_TIME]");
    const launchUrl = new URL(`${API_URL}/${gameName}`);
    const params = new URLSearchParams({
      user: userId,
      token: token,
      currency: CURRENCY,
      lang: "EN",
      return_url: RETURN_URL,
      operator: OPERATOR_KEY,
    });
    launchUrl.search = params.toString();

    console.timeEnd("[SPRIBE][URL_CONSTRUCTION_TIME]");
    console.log("[SPRIBE][URL_DETAILS]", {
      baseUrl: API_URL,
      gameName,
      paramCount: params.toString().split("&").length,
      finalUrl: `${launchUrl.protocol}//${launchUrl.host}${launchUrl.pathname}?***REDACTED***`,
    });

    // 8. Response preparation
    const responseData = { Data: launchUrl.toString() };
    console.log("[SPRIBE][RESPONSE_PREPARED]", {
      dataLength: JSON.stringify(responseData).length,
      containsUrl: !!responseData.Data,
    });

    // 9. Send response
    console.time("[SPRIBE][RESPONSE_SEND_TIME]");
    res.json(responseData);
    console.timeEnd("[SPRIBE][RESPONSE_SEND_TIME]");
    console.log("[SPRIBE][RESPONSE_SENT]", {
      statusCode: res.statusCode,
      headersSent: res.headersSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[SPRIBE][UNHANDLED_ERROR]", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({
      errorCode: 0,
      message: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    console.timeEnd("[SPRIBE][LAUNCH_GAME_TOTAL_TIME]");
  }
};

export const spribeInfo = async (req, res) => {
  if (!validateSpribeSignature(req)) {
    return res.status(403).json({ code: 403, message: "Invalid signature" });
  }
  try {
    const { user_id, currency } = req.body;
    if (!user_id) {
      return res.status(400).json({ code: 400, message: "Missing user_id" });
    }

    // Lookup user
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );
    if (!userRows.length) {
      return res
        .status(200)
        .json({ code: 401, message: "User token is invalid" });
    }
    const user = userRows[0];

    // Respond with balance in Spribe's expected format (multiplied by 1000)
    return res.json({
      code: 200,
      message: "ok",
      data: {
        user_id: user.id_user,
        username: user.name_user,
        balance: Number(user.money) * 1000,
        currency: currency || "INR",
      },
    });
  } catch (error) {
    console.error("[SPRIBE][INFO][EXCEPTION]", error, req.body);
    return res.status(200).json({ code: 500, message: "Internal error" });
  }
};

export const spribeAuth = async (req, res) => {
  logSpribe("AUTH_REQUEST", "Auth request received", {
    headers: req.headers,
    body: req.body,
    url: req.originalUrl,
  });

  // TEMPORARY: Log all headers to see what Spribe is actually sending
  logSpribe(
    "AUTH_HEADERS",
    "All headers received",
    Object.keys(req.headers).map((key) => `${key}: ${req.headers[key]}`),
  );

  // TEMPORARY: Bypass signature validation for testing
  logSpribe("AUTH_WARNING", "Bypassing signature validation for testing");
  // if (!validateSpribeSignature(req)) {
  //     logSpribe('AUTH_ERROR', 'Invalid signature');
  //     return res.status(403).json({ code: 403, message: "Invalid signature" });
  // }

  try {
    const { user_token, currency } = req.body;
    logSpribe("AUTH_PARAMS", "Auth parameters", { user_token, currency });

    if (!user_token) {
      logSpribe("AUTH_ERROR", "Missing user_token");
      return res.status(400).json({ code: 400, message: "Missing user_token" });
    }

    // Lookup user by session token
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE spribeLaunchToken = ?",
      [user_token],
    );
    logSpribe("AUTH_DB_QUERY", "Database query result", {
      user_token,
      found_users: userRows.length,
      user: userRows[0]
        ? {
            id: userRows[0].id_user,
            name: userRows[0].name_user,
            money: userRows[0].money,
          }
        : null,
    });

    // Also check if any users have spribeLaunchToken at all
    try {
      const [allUsers] = await connection.query(
        "SELECT COUNT(*) as total FROM users WHERE spribeLaunchToken IS NOT NULL",
      );
      logSpribe("AUTH_DB_DEBUG", "Database debug info", {
        total_users_with_spribe_token: allUsers[0].total,
        searching_for_token: user_token,
      });
    } catch (dbError) {
      logSpribe("AUTH_DB_ERROR", "Database error", { error: dbError.message });
    }

    if (!userRows.length) {
      logSpribe("AUTH_ERROR", "Token expired or invalid");
      return res
        .status(200)
        .json({ code: 401, message: "Token expired or invalid" });
    }
    const user = userRows[0];

    const response = {
      code: 200,
      message: "Success",
      data: {
        user_id: user.id_user,
        username: user.name_user,
        balance: Number(user.money) * 1000,
        currency: currency || "INR",
      },
    };

    logSpribe("AUTH_SUCCESS", "Auth successful", response);

    // Log session summary
    logSpribe("SESSION_SUMMARY", "Session summary", {
      user_id: user.id_user,
      username: user.name_user,
      session_token: req.body.session_token,
      balance: Number(user.money) * 1000,
      currency: currency || "INR",
      timestamp: new Date().toISOString(),
    });

    return res.json(response);
  } catch (error) {
    console.error("[SPRIBE][AUTH][EXCEPTION]", error, req.body);
    return res.status(200).json({ code: 500, message: "Internal error" });
  }
};

export const spribeDeposit = async (req, res) => {
  logSpribe("DEPOSIT_REQUEST", "Deposit request received", {
    headers: req.headers,
    body: req.body,
    url: req.originalUrl,
  });

  // TEMPORARY: Bypass signature validation for testing
  logSpribe("DEPOSIT_WARNING", "Bypassing signature validation for testing");
  // if (!validateSpribeSignature(req)) {
  //     return res.status(403).json({ code: 403, message: "Invalid signature" });
  // }
  try {
    const { user_id, amount, provider_tx_id, currency } = req.body;
    const amt = Number(amount);
    logSpribe("DEPOSIT_PARAMS", "Deposit parameters", {
      user_id,
      amount: amt,
      provider_tx_id,
      currency,
    });

    if (!user_id || isNaN(amt) || !provider_tx_id) {
      logSpribe("DEPOSIT_ERROR", "Missing required fields");
      return res
        .status(400)
        .json({ code: 400, message: "Missing required fields" });
    }

    // Check for duplicate transaction
    const [existingTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [provider_tx_id],
    );
    logSpribe("DEPOSIT_DUPLICATE_CHECK", "Duplicate transaction check", {
      provider_tx_id,
      existing_transactions: existingTransaction.length,
    });

    if (existingTransaction.length) {
      logSpribe(
        "DEPOSIT_DUPLICATE_FOUND",
        "Duplicate transaction found",
        existingTransaction[0],
      );
      return res.status(200).json({
        code: 409,
        message: "Duplicate transaction",
        data: {
          user_id,
          operator_tx_id: existingTransaction[0].operator_tx_id,
          provider_tx_id,
          old_balance: existingTransaction[0].old_balance,
          new_balance: existingTransaction[0].new_balance,
          currency,
        },
      });
    }

    // Lookup user
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );
    logSpribe("DEPOSIT_USER_LOOKUP", "User lookup result", {
      user_id,
      found_users: userRows.length,
      user: userRows[0]
        ? {
            id: userRows[0].id_user,
            name: userRows[0].name_user,
            money: userRows[0].money,
          }
        : null,
    });

    if (!userRows.length) {
      logSpribe("DEPOSIT_ERROR", "User not found");
      return res
        .status(401)
        .json({ code: 401, message: "User token is invalid" });
    }
    const user = userRows[0];
    const old_balance = Number(user.money) * 1000;
    const new_balance = old_balance + amt; // Deposit (win) should increase balance

    logSpribe("DEPOSIT_BALANCE_UPDATE", "Balance update calculation", {
      old_balance,
      amount: amt,
      new_balance,
    });

    // Update balance
    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance / 1000,
      user_id,
    ]);
    logSpribe("DEPOSIT_DB_UPDATE", "Balance updated successfully");

    const operator_tx_id = `OP_TX_${Date.now()}`;
    await connection.query(
      "INSERT INTO spribetransaction (id_user, type, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, deposit_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user_id,
        0,
        provider_tx_id,
        operator_tx_id,
        old_balance,
        new_balance,
        currency,
        amt,
      ],
    );
    logSpribe("DEPOSIT_DB_INSERT", "Transaction recorded successfully");

    const response = {
      code: 200,
      message: "Success",
      data: {
        user_id,
        operator_tx_id,
        provider_tx_id,
        old_balance,
        new_balance,
        currency,
      },
    };

    logSpribe("DEPOSIT_SUCCESS", "Deposit successful", response);
    return res.status(200).json(response);
  } catch (error) {
    logSpribe("DEPOSIT_EXCEPTION", "Deposit exception", {
      error: error.message,
      body: req.body,
    });
    return res.status(500).json({ code: 500, message: "Internal error" });
  }
};

export const spribeWithdraw = async (req, res) => {
  logSpribe("WITHDRAW_REQUEST", "Withdraw request received", {
    headers: req.headers,
    body: req.body,
    url: req.originalUrl,
  });

  // TEMPORARY: Bypass signature validation for testing
  logSpribe("WITHDRAW_WARNING", "Bypassing signature validation for testing");
  // if (!validateSpribeSignature(req)) {
  //     return res.status(403).json({ code: 403, message: "Invalid signature" });
  // }
  try {
    const { user_id, amount, provider_tx_id, currency } = req.body;
    const amt = Number(amount);
    logSpribe("WITHDRAW_PARAMS", "Withdraw parameters", {
      user_id,
      amount: amt,
      provider_tx_id,
      currency,
    });

    if (!user_id || isNaN(amt) || !provider_tx_id) {
      logSpribe("WITHDRAW_ERROR", "Missing required fields");
      return res
        .status(400)
        .json({ code: 400, message: "Missing required fields" });
    }

    // Check for duplicate transaction
    const [existingTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [provider_tx_id],
    );
    logSpribe("WITHDRAW_DUPLICATE_CHECK", "Duplicate transaction check", {
      provider_tx_id,
      existing_transactions: existingTransaction.length,
    });
    if (existingTransaction.length) {
      logSpribe(
        "WITHDRAW_DUPLICATE_FOUND",
        "Duplicate transaction found",
        existingTransaction[0],
      );
      return res.status(200).json({
        code: 409,
        message: "Duplicate transaction",
        data: {
          user_id,
          operator_tx_id: existingTransaction[0].operator_tx_id,
          provider_tx_id,
          old_balance: existingTransaction[0].old_balance,
          new_balance: existingTransaction[0].new_balance,
          currency,
        },
      });
    }

    // Lookup user
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );
    logSpribe("WITHDRAW_USER_LOOKUP", "User lookup result", {
      user_id,
      found_users: userRows.length,
      user: userRows[0]
        ? {
            id: userRows[0].id_user,
            name: userRows[0].name_user,
            money: userRows[0].money,
          }
        : null,
    });

    if (!userRows.length) {
      logSpribe("WITHDRAW_ERROR", "User not found");
      return res
        .status(401)
        .json({ code: 401, message: "User token is invalid" });
    }
    const user = userRows[0];
    const old_balance = Number(user.money) * 1000;
    const sufficient_funds = amt <= old_balance;
    logSpribe("WITHDRAW_BALANCE_CHECK", "Balance check", {
      old_balance,
      amount: amt,
      sufficient_funds,
    });
    if (!sufficient_funds) {
      logSpribe("WITHDRAW_ERROR", "Insufficient funds");
      return res.status(402).json({
        code: 402,
        message: "Insufficient funds",
        data: { user_id, old_balance, required_amount: amt, currency },
      });
    }
    const new_balance = old_balance - amt; // Withdraw (bet) should decrease balance

    logSpribe("WITHDRAW_BALANCE_UPDATE", "Balance update calculation", {
      old_balance,
      amount: amt,
      new_balance,
    });

    // Update balance
    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance / 1000,
      user_id,
    ]);
    logSpribe("WITHDRAW_DB_UPDATE", "Balance updated successfully");

    const operator_tx_id = `OP_TX_${Date.now()}`;
    await connection.query(
      "INSERT INTO spribetransaction (id_user, type, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user_id,
        1,
        provider_tx_id,
        operator_tx_id,
        old_balance,
        new_balance,
        currency,
        amt,
      ],
    );
    logSpribe("WITHDRAW_DB_INSERT", "Transaction recorded successfully");

    const response = {
      code: 200,
      message: "ok",
      data: {
        user_id,
        operator_tx_id,
        provider_tx_id,
        old_balance,
        new_balance,
        currency,
      },
    };

    logSpribe("WITHDRAW_SUCCESS", "Withdraw successful", response);
    return res.status(200).json(response);
  } catch (error) {
    logSpribe("WITHDRAW_EXCEPTION", "Withdraw exception", {
      error: error.message,
      body: req.body,
    });
    return res.status(500).json({ code: 500, message: "Internal error" });
  }
};

export const spribeRollback = async (req, res) => {
  console.log("[SPRIBE][ROLLBACK][REQUEST]", {
    headers: req.headers,
    body: req.body,
    url: req.originalUrl,
  });

  // TEMPORARY: Bypass signature validation for testing
  console.log(
    "[SPRIBE][ROLLBACK][WARNING] Bypassing signature validation for testing",
  );
  // if (!validateSpribeSignature(req)) {
  //     return res.status(403).json({ code: 403, message: "Invalid signature" });
  // }
  try {
    const {
      user_id,
      amount,
      provider,
      rollback_provider_tx_id,
      provider_tx_id,
      game,
      session_token,
      action,
      action_id,
      currency,
    } = req.body;

    // 1. Validate input
    if (!rollback_provider_tx_id || !amount) {
      return res.status(400).json({
        code: 400,
        message: "Missing rollback_provider_tx_id or amount",
      });
    }

    // 2. Check if the original transaction exists
    const [existingTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [rollback_provider_tx_id],
    );
    if (!existingTransaction.length) {
      return res
        .status(200)
        .json({ code: 408, message: "Transaction not found" });
    }
    const transaction = existingTransaction[0];
    const rollbackUserId = transaction.id_user;

    // 3. Check for duplicate rollback using provider_tx_id
    const [duplicateTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [provider_tx_id],
    );
    if (duplicateTransaction.length) {
      return res.status(200).json({
        code: 409,
        message: "Duplicate transaction",
        data: {
          user_id: rollbackUserId,
          operator_tx_id: duplicateTransaction[0].operator_tx_id,
          provider,
          provider_tx_id,
          old_balance: duplicateTransaction[0].old_balance,
          new_balance: duplicateTransaction[0].new_balance,
          currency: transaction.currency,
        },
      });
    }

    // 4. Update the user's balance
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [rollbackUserId],
    );
    if (!userRows.length) {
      return res
        .status(200)
        .json({ code: 401, message: "User token is invalid" });
    }
    const user = userRows[0];
    const old_balance = Number(user.money) * 1000;
    const new_balance = old_balance + Number(amount);

    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance / 1000,
      rollbackUserId,
    ]);

    // 5. Record the rollback transaction
    const operator_tx_id = `OP_TX_${Date.now()}`;
    await connection.query(
      "INSERT INTO spribetransaction (id_user, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        rollbackUserId,
        user.phone,
        user.name_user,
        provider,
        provider_tx_id,
        operator_tx_id,
        old_balance,
        new_balance,
        currency || transaction.currency,
        amount,
        game,
        action,
        action_id,
        session_token,
        2, // type 2 for rollback
      ],
    );

    // 6. Respond with the result
    return res.status(200).json({
      code: 200,
      message: "Success",
      data: {
        user_id: rollbackUserId,
        operator_tx_id,
        provider,
        provider_tx_id,
        old_balance,
        new_balance,
        currency: currency || transaction.currency,
      },
    });
  } catch (error) {
    console.error("[SPRIBE][ROLLBACK][EXCEPTION]", error, req.body);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
      detail: error.message,
    });
  }
};

const spribeGameController = {
  spribeInfo,
  spribeLaunchGame,
  spribeAuth,
  spribeDeposit,
  spribeWithdraw,
  spribeRollback,
};

export default spribeGameController;
