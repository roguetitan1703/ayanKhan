import connection from "../config/connectDB.js";
import crypto from "crypto";

// Spribe Staging Configuration
const SECRET_TOKEN = "P8cs7H7swSnr1WwDRNQOBCPQjCLvkOlQ";
const OPERATOR_KEY = "reddybook75new";
const API_URL = "https://dev-test.spribe.io/games/launch";
const GAME_API_URL = "https://secure-ga.staging.spribe.io/v3";
const CALLBACK_URL = "https://75club.games/api/v1/callback/spribe";
const DEMO_URL = "https://demo.spribe.io/launch";
const CURRENCY = "INR"; // Default currency
const LANG = "EN"; // Default language

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

// Validate Spribe signature for incoming requests per Spribe documentation
export const validateSpribeSignature = (req) => {
  const clientId = req.headers["x-spribe-client-id"];
  const timestamp = req.headers["x-spribe-client-ts"];
  const signature = req.headers["x-spribe-client-signature"];

  // Log validation attempt
  console.log("[SPRIBE][SIGNATURE_DEBUG] Validation attempt", {
    clientId,
    timestamp,
    signature,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });

  // Check for required headers
  if (!clientId || !timestamp || !signature) {
    console.log("[SPRIBE][SIGNATURE_ERROR] Missing required headers");
    return {
      valid: false,
      code: 413,
      message:
        "Missing required headers: X-Spribe-Client-ID, X-Spribe-Client-TS, or X-Spribe-Client-Signature",
    };
  }

  // Verify client ID
  if (clientId !== OPERATOR_KEY) {
    console.log("[SPRIBE][SIGNATURE_ERROR] Invalid Client ID", { clientId });
    return {
      valid: false,
      code: 413,
      message: "Invalid X-Spribe-Client-ID",
    };
  }

  // Get the request path with query parameters (without domain)
  const pathWithQuery = req.originalUrl;

  // Get the raw body and minify it to remove newlines and extra whitespace
  let rawBody = req.rawBody
    ? req.rawBody.toString("utf8")
    : JSON.stringify(req.body, null, 0);
  // Minify JSON to match Spribe's expected format (no newlines or indentation)
  rawBody = JSON.stringify(JSON.parse(rawBody), null, 0);

  // Concatenate timestamp, path, and minified body as per Spribe documentation
  const stringToSign = `${timestamp}${pathWithQuery}${rawBody}`;
  console.log("[SPRIBE][SIGNATURE_DEBUG] String to sign", {
    stringToSign,
    rawBody,
  });

  // Generate HMAC SHA256 signature using client secret
  const calculatedSignature = crypto
    .createHmac("sha256", SECRET_TOKEN)
    .update(stringToSign)
    .digest("hex");

  console.log("[SPRIBE][SIGNATURE_DEBUG] Signature comparison", {
    calculatedSignature,
    receivedSignature: signature,
    isValid: calculatedSignature === signature,
  });

  // Compare signatures
  if (calculatedSignature !== signature) {
    console.log("[SPRIBE][SIGNATURE_ERROR] Signature mismatch");
    return {
      valid: false,
      code: 413,
      message: "Invalid Client-Signature",
    };
  }

  return { valid: true };
};

export const spribeLaunchGame = async (req, res) => {
  const userToken = req.userToken;
  const { gameName } = req.body;

  // Validate game name against allowed games
  const allowedGames = [
    "aviator",
    "balloon",
    "dice",
    "fortune-wheel",
    "goal",
    "hi-lo",
    "hotline",
    "keno",
    "mines",
    "mini-roulette",
    "multikeno",
    "plinko",
  ];

  if (!allowedGames.includes(gameName)) {
    return res.status(400).json({
      errorCode: 400,
      message: "Invalid game name",
      validGames: allowedGames,
    });
  }

  try {
    // Get user details
    const [userRows] = await connection.query(
      "SELECT id_user, phone, name_user FROM users WHERE token = ?",
      [userToken],
    );

    if (!userRows.length) {
      return res.status(401).json({
        errorCode: 401,
        message: "Invalid user token",
      });
    }

    const user = userRows[0];
    const timestamp = Date.now();

    // Generate authentication tokens
    const token = generateToken(user.phone, timestamp);
    const hashSignature = generateHashSignature(token, timestamp);

    // Update user with launch token
    await connection.query(
      "UPDATE users SET spribeLaunchToken = ?  WHERE id_user = ?",
      [token, user.id_user],
    );

    // Construct launch URL with required parameters
    const launchParams = new URLSearchParams({
      user: String(user.id_user),
      token: token,
      lang: LANG,
      currency: CURRENCY,
      //return_url: CALLBACK_URL,
      operator: OPERATOR_KEY,
      account_history_url: CALLBACK_URL,
      //irc_duration: "1800", // 30 minutes in seconds
      //irc_elapsed: "600", // 10 minutes in seconds
    });

    const launchUrl = `${API_URL}/${gameName}?${launchParams.toString()}`;
    const demoUrl = `${DEMO_URL}/${gameName}?currency=UAH&lang=${LANG}&return_url=${encodeURIComponent(CALLBACK_URL)}`;

    // Response with both real and demo URLs
    // return res.json({
    //   success: true,
    //   data: {
    //     launchUrl: launchUrl,
    //     demoUrl: demoUrl,
    //     userDetails: {
    //       userId: user.id_user,
    //       username: user.name_user,
    //       currency: CURRENCY,
    //     },
    //     signature: hashSignature,
    //   },
    // });
    return res.json({
      Data: launchUrl,
    });
  } catch (error) {
    console.error("Spribe Game Launch Error:", {
      error: error.message,
      stack: error.stack,
      body: req.body,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      errorCode: 500,
      message: "Game launch failed",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// export const spribeLaunchGame = async (req, res) => {
//   const userToken = req.userToken;
//   const { gameName } = req.body;
//   const game = gameName;

//   try {
//     const [userRows] = await connection.query(
//       "SELECT * FROM users WHERE token = ?",
//       [userToken],
//     );

//     if (!userRows.length) {
//       return res.status(404).json({
//         errorCode: 4,
//         message: "Token expired or invalid",
//       });
//     }

//     const playerId = userRows[0].phone;
//     const userId = userRows[0].id_user;

//     // Generate the token and hash signature
//     const timestamp = Date.now();
//     const token = generateToken(playerId, timestamp);
//     const hashSignature = generateHashSignature(token, timestamp);

//     await connection.query(
//       "UPDATE users SET spribeLaunchToken = ? WHERE phone = ?",
//       [token, playerId],
//     );

//     // Create launch URL with all required parameters
//     // const launchUrl = new URL(`${API_URL}/${game}`);
//     // launchUrl.searchParams.append("user", userId);
//     // launchUrl.searchParams.append("token", token);
//     // launchUrl.searchParams.append("currency", currency);
//     // launchUrl.searchParams.append("lang", "EN");
//     // launchUrl.searchParams.append("return_url", return_url);
//     // launchUrl.searchParams.append("operator", OPERATOR_KEY);
//     // Optional parameters can be added here if needed
//     // launchUrl.searchParams.append('account_history_url', '...');
//     // launchUrl.searchParams.append('irc_duration', '...');
//     // launchUrl.searchParams.append('irc_elapsed', '...');

//     //const launchUrl = `${API_URL}/${game}?user=${userId}&token=${token}&currency=${currency}&lang=EN&return_url=${return_url}&operator=${OPERATOR_KEY}`;

//     return res.json({
//       Data: `${API_URL}/${game}?user=${userId}&token=${token}&currency=${currency}&lang=EN&return_url=${return_url}&operator=${OPERATOR_KEY}`,
//     });
//   } catch (error) {
//     console.error("Error launching Spribe game:", error);
//     return res.status(500).json({
//       errorCode: 500,
//       message: "Internal server error",
//       detail: error.message,
//     });
//   }
// };

export const spribeInfo = async (req, res) => {
  // const validation = validateSpribeSignature(req);
  // if (!validation.valid) return res.status(200).json(validation);
  const { session_token, currency, user_id } = req.body;

  try {
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );

    if (!userRows.length) {
      return res.status(200).json({
        code: 401,
        message: "User token is invalid",
      });
    }

    const user = userRows[0];
    const response = {
      code: 200,
      message: "ok",
      data: {
        user_id: user.id_user,
        username: user.name_user,
        balance: Math.floor(Number(user.money) * 1000), // Convert to units (1 INR = 1000 units)
        currency: currency || "INR", // Fallback to INR if not provided
      },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error in spribeInfo:", error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
      detail: error.message,
    });
  }
};

export const spribeAuth = async (req, res) => {
  // const validation = validateSpribeSignature(req);
  // if (!validation.valid) return res.status(200).json(validation);

  const { user_token, session_token, platform, currency } = req.body;

  try {
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE spribeLaunchToken = ?",
      [user_token],
    );

    if (!userRows.length) {
      return res.status(200).json({
        code: 401,
        message: "User token is invalid",
      });
    }

    const user = userRows[0];

    // Optional: Expiry check
    if (user.token_expiry && new Date(user.token_expiry) < new Date()) {
      return res.status(200).json({
        code: 403,
        message: "User token is expired",
      });
    }

    return res.status(200).json({
      code: 200,
      message: "ok",
      data: {
        user_id: String(user.id_user),
        username: user.name_user,
        balance: Math.floor(Number(user.money) * 1000), // Convert to units
        currency: currency || "INR",
        platform: platform || "desktop",
      },
    });
  } catch (error) {
    console.error("Error in spribeAuth:", error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
    });
  }
};

export const spribeDeposit = async (req, res) => {
  // const validation = validateSpribeSignature(req);
  // if (!validation.valid) return res.status(200).json(validation);

  const {
    user_id,
    currency,
    amount,
    provider,
    provider_tx_id,
    game,
    action,
    action_id,
    session_token,
    platform,
  } = req.body;

  try {
    // ✅ Check duplicate transaction
    const [existingTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [provider_tx_id],
    );

    if (existingTransaction.length) {
      return res.status(200).json({
        code: 409,
        message: "OK",
        data: {
          user_id,
          operator_tx_id: existingTransaction[0].operator_tx_id,
          provider,
          provider_tx_id,
          old_balance: existingTransaction[0].Number(old_balance),
          new_balance: existingTransaction[0].Number(new_balance),
          currency,
        },
      });
    }

    // ✅ Check user exists
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );
    if (!userRows.length) {
      return res.status(200).json({
        code: 401,
        message: "Token is not valid",
      });
    }

    const user = userRows[0];
    const old_balance = Math.floor(Number(user.money) * 1000);
    const betAmount = Number(amount);

    // ✅ Check valid bet amount
    if (betAmount <= 0) {
      return res.status(200).json({
        code: 403,
        message: "Invalid bet amount",
      });
    }

    // ✅ Deduct balance
    const new_balance = old_balance - betAmount;
    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance / 1000,
      user_id,
    ]);

    // ✅ Create transaction
    const operator_tx_id = `OP_TX_${Date.now()}`;
    await connection.query(
      "INSERT INTO spribetransaction (id_user, type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token, platform) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user_id,
        0,
        user.phone,
        user.name_user,
        provider,
        provider_tx_id,
        operator_tx_id,
        old_balance,
        new_balance,
        currency || "INR",
        betAmount,
        game,
        action,
        action_id,
        session_token,
        platform || "desktop",
      ],
    );

    // ✅ Success response
    return res.status(200).json({
      code: 200,
      message: "OK",
      data: {
        operator_tx_id,
        new_balance,
        old_balance,
        user_id,
        currency: currency || "INR",
        provider,
        provider_tx_id,
      },
    });
  } catch (error) {
    console.error("Error in spribeDeposit:", error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
    });
  }
};

export const spribeWithdraw = async (req, res) => {
  // const validation = validateSpribeSignature(req);
  // if (!validation.valid) return res.status(200).json(validation);

  const {
    user_id,
    currency,
    amount,
    provider,
    provider_tx_id,
    game,
    action,
    action_id,
    session_token,
    platform,
  } = req.body;

  try {
    // ✅ Check for duplicate transaction
    const [existingTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [provider_tx_id],
    );

    if (existingTransaction.length) {
      return res.status(200).json({
        code: 409,
        message: "OK",
        data: {
          user_id,
          operator_tx_id: existingTransaction[0].operator_tx_id,
          provider,
          provider_tx_id,
          old_balance: existingTransaction[0].old_balance,
          new_balance: existingTransaction[0].new_balance,
          currency,
        },
      });
    }

    // ✅ Validate user
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id.trim()],
    );
    if (!userRows.length) {
      return res.status(200).json({
        code: 401,
        message: "User token is invalid",
      });
    }

    const user = userRows[0];
    const old_balance = Math.floor(Number(user.money) * 1000);
    const winAmount = Number(amount);

    if (winAmount <= 0) {
      return res.status(200).json({
        code: 403,
        message: "Invalid win amount",
      });
    }

    // ✅ WITHDRAW from Spribe = Win → add balance
    const new_balance = old_balance + winAmount;

    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance / 1000,
      user_id.trim(),
    ]);

    // ✅ Record transaction
    const operator_tx_id = `OP_TX_${Date.now()}`;
    await connection.query(
      "INSERT INTO spribetransaction (id_user, type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, deposit_amount, game, action, action_id, session_token, platform) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user_id.trim(),
        1, // 1 = withdraw type
        user.phone,
        user.name_user,
        provider,
        provider_tx_id,
        operator_tx_id,
        old_balance,
        new_balance,
        currency || "INR",
        winAmount,
        game,
        action,
        action_id,
        session_token,
        platform || "desktop",
      ],
    );

    // ✅ Success response
    return res.status(200).json({
      code: 200,
      message: "OK",
      data: {
        operator_tx_id,
        new_balance,
        old_balance,
        user_id,
        currency: currency || "INR",
        provider,
        provider_tx_id,
      },
    });
  } catch (error) {
    console.error("Error in spribeWithdraw:", error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
    });
  }
};

export const spribeRollback = async (req, res) => {
  //const validation = validateSpribeSignature(req);
  //if (!validation.valid) return res.status(200).json(validation);

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
  } = req.body;

  try {
    // 1️⃣ Find the original transaction
    const [existingTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [rollback_provider_tx_id],
    );

    if (!existingTransaction.length) {
      return res.status(200).json({
        code: 408,
        message: "Transaction not found",
      });
    }

    const originalTx = existingTransaction[0];
    const transactionUserId = originalTx.id_user;

    // 2️⃣ Check for duplicate rollback BEFORE doing anything else
    const [duplicateTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [provider_tx_id],
    );

    if (duplicateTransaction.length) {
      return res.status(200).json({
        code: 409,
        message: "ok",
        data: {
          user_id: transactionUserId,
          operator_tx_id: duplicateTransaction[0].operator_tx_id,
          provider,
          provider_tx_id,
          old_balance: duplicateTransaction[0].old_balance,
          new_balance: duplicateTransaction[0].new_balance,
          currency: originalTx.currency,
        },
      });
    }

    // 3️⃣ Verify user exists
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [transactionUserId],
    );
    if (!userRows.length) {
      return res.status(200).json({
        code: 401,
        message: "User token is invalid",
      });
    }

    const user = userRows[0];
    const currentBalance = Math.floor(Number(user.money) * 1000);
    const rollbackAmount = Number(amount);

    // 4️⃣ Determine rollback direction
    let newBalance;
    if (originalTx.type === 0) {
      // Original was WITHDRAW (bet) → rollback adds balance back
      newBalance = currentBalance + rollbackAmount;
    } else if (originalTx.type === 1) {
      // Original was DEPOSIT (win) → rollback subtracts balance
      newBalance = currentBalance - rollbackAmount;
    } else {
      return res.status(200).json({
        code: 500,
        message: "Cannot rollback a rollback transaction",
      });
    }

    // 5️⃣ Update user balance
    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      newBalance / 1000,
      transactionUserId,
    ]);

    // 6️⃣ Record rollback transaction
    const operator_tx_id = `OP_TX_${Date.now()}`;
    await connection.query(
      "INSERT INTO spribetransaction (id_user, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        transactionUserId,
        user.phone,
        user.name_user,
        provider,
        provider_tx_id,
        operator_tx_id,
        currentBalance,
        newBalance,
        originalTx.currency,
        rollbackAmount,
        game,
        action,
        action_id,
        session_token,
        2, // type 2 = rollback
      ],
    );

    return res.status(200).json({
      code: 200,
      message: "ok",
      data: {
        user_id: transactionUserId,
        operator_tx_id,
        provider,
        provider_tx_id,
        old_balance: currentBalance,
        new_balance: newBalance,
        currency: originalTx.currency,
      },
    });
  } catch (error) {
    console.error("Error in spribeRollback:", error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
      detail: error.message,
    });
  }
};

export const spribeFreebetInfo = async (req, res) => {
  // const validation = validateSpribeSignature(req);
  // if (!validation.valid) return res.status(200).json(validation);
  try {
    const { operator_freebet_id, operator_key, secret_token, provider } =
      req.body;

    // ✅ Basic auth check
    if (operator_key !== OPERATOR_KEY || secret_token !== SECRET_TOKEN) {
      return res.status(200).json({
        code: 401,
        message: "Authorization Error",
      });
    }

    // ✅ Look up freebet in DB
    const [freebetRows] = await connection.query(
      `SELECT * FROM spribe_freebets
       WHERE operator_freebet_id = ? AND provider = ?`,
      [operator_freebet_id, provider],
    );

    if (!freebetRows.length) {
      return res.status(200).json({
        code: 901,
        message: "Free bet not found",
      });
    }

    const freebet = freebetRows[0];

    // ✅ Format dates to match Spribe's "YYYY-MM-DD HH:mm:ss+00:00"
    const formatUTC = (date) => {
      if (!date) return null;
      return new Date(date)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "+00:00");
    };

    // ✅ Convert to Spribe units
    const toUnits = (value) => Math.floor(Number(value) * 1000);

    return res.status(200).json({
      code: 200,
      message: "OK",
      operator_freebet_id: freebet.operator_freebet_id,
      provider_freebet_id: freebet.provider_freebet_id || "",
      currency: freebet.currency,
      op_player_id: freebet.id_user,
      free_bets: freebet.free_bets,
      free_bets_left: freebet.free_bets_left,
      bet_value: toUnits(freebet.bet_value),
      win_amount: toUnits(freebet.win_amount),
      create_date: formatUTC(freebet.create_date),
      deposit_date: formatUTC(freebet.deposit_date),
      cancel_date: formatUTC(freebet.cancel_date),
      end_date: formatUTC(freebet.end_date),
      status: freebet.status,
      game: freebet.game,
      provider: freebet.provider,
    });
  } catch (error) {
    console.error("Error in spribeFreebetInfo:", error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
      detail: error.message,
    });
  }
};

export const spribeAddFreebet = async (req, res) => {
  // const validation = validateSpribeSignature(req);
  // if (!validation.valid) return res.status(200).json(validation);
  try {
    const {
      operator_key,
      secret_token,
      provider,
      operator_freebet_id,
      op_player_id,
      bet_value,
      currency,
      free_bets,
      game,
      end_date,
      start_time,
    } = req.body;

    // ✅ Auth check
    if (
      !operator_key ||
      !secret_token ||
      operator_key.trim() !== OPERATOR_KEY.trim() ||
      secret_token.trim() !== SECRET_TOKEN.trim()
    ) {
      return res.status(200).json({
        code: 401,
        message: "Authorization Error - Invalid credentials",
      });
    }

    // ✅ Check if freebet already exists
    const [existing] = await connection.query(
      "SELECT * FROM spribe_freebets WHERE operator_freebet_id = ? AND provider = ?",
      [operator_freebet_id, provider],
    );

    // Helper: Convert DB value to Spribe units
    const toUnits = (value) => Math.floor(Number(value) * 1000);
    const toDecimal = (units) => Number(units) / 1000;

    // Helper: Format UTC date
    const formatUTC = (date) => {
      if (!date) return null;
      return new Date(date)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "+00:00");
    };

    if (existing.length > 0) {
      const fb = existing[0];
      return res.status(200).json({
        code: 200,
        message: "OK",
        operator_freebet_id: fb.operator_freebet_id,
        provider_freebet_id: fb.provider_freebet_id || "",
        currency: fb.currency,
        op_player_id: fb.id_user,
        free_bets: fb.free_bets,
        free_bets_left: fb.free_bets_left,
        bet_value: toUnits(fb.bet_value),
        win_amount: toUnits(fb.win_amount),
        create_date: formatUTC(fb.create_date),
        deposit_date: formatUTC(fb.deposit_date),
        cancel_date: formatUTC(fb.cancel_date),
        end_date: formatUTC(fb.end_date),
        status: fb.status,
        game: fb.game,
        provider: fb.provider,
      });
    }

    // ✅ Validate user exists
    const [userRows] = await connection.query(
      "SELECT id_user, phone, name_user FROM users WHERE id_user = ?",
      [op_player_id],
    );

    if (!userRows.length) {
      return res.status(200).json({
        code: 404,
        message: "User not found",
      });
    }

    const user = userRows[0];

    // ✅ Insert new freebet
    const [result] = await connection.query(
      `INSERT INTO spribe_freebets 
      (operator_freebet_id, id_user, phone, name_user, currency, free_bets, free_bets_left, bet_value, win_amount, create_date, end_date, status, game, provider, session_token, platform, time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'active', ?, ?, '', 'desktop', UNIX_TIMESTAMP())`,
      [
        operator_freebet_id,
        user.id_user,
        user.phone,
        user.name_user,
        currency,
        free_bets,
        free_bets, // free_bets_left initially same
        toDecimal(bet_value),
        0, // win_amount
        new Date(end_date),
        game,
        provider,
      ],
    );

    const insertedId = result.insertId;

    // ✅ Fetch the inserted row for response
    const [newFB] = await connection.query(
      "SELECT * FROM spribe_freebets WHERE id = ?",
      [insertedId],
    );

    const fb = newFB[0];
    return res.status(200).json({
      code: 200,
      message: "OK",
      operator_freebet_id: fb.operator_freebet_id,
      provider_freebet_id: fb.provider_freebet_id || "",
      currency: fb.currency,
      op_player_id: fb.id_user,
      free_bets: fb.free_bets,
      free_bets_left: fb.free_bets_left,
      bet_value: toUnits(fb.bet_value),
      win_amount: toUnits(fb.win_amount),
      create_date: formatUTC(fb.create_date),
      deposit_date: formatUTC(fb.deposit_date),
      cancel_date: formatUTC(fb.cancel_date),
      end_date: formatUTC(fb.end_date),
      status: fb.status,
      game: fb.game,
      provider: fb.provider,
    });
  } catch (error) {
    console.error("Error in spribeAddFreebet:", error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
      detail: error.message,
    });
  }
};

export const spribeCancelFreebet = async (req, res) => {
  // ✅ Step 1: Validate signature
  // const validation = validateSpribeSignature(req);
  // if (!validation.valid) return res.status(200).json(validation);

  try {
    const { operator_key, secret_token, operator_freebet_id, provider } =
      req.body;

    // ✅ Step 2: Check credentials
    if (
      !operator_key ||
      !secret_token ||
      operator_key.trim() !== OPERATOR_KEY.trim() ||
      secret_token.trim() !== SECRET_TOKEN.trim()
    ) {
      return res.status(200).json({
        code: 401,
        message: "Authorization Error - Invalid credentials",
      });
    }

    // ✅ Step 3: Look up free bet
    const [rows] = await connection.query(
      "SELECT * FROM spribe_freebets WHERE operator_freebet_id = ? AND provider = ?",
      [operator_freebet_id, provider],
    );

    if (!rows.length) {
      return res.status(200).json({
        code: 901,
        message: "Free bet not found",
      });
    }

    const fb = rows[0];

    if (fb.status !== "active") {
      return res.status(200).json({
        code: 902,
        message: "Free bet is not active",
      });
    }

    // ✅ Step 4: Cancel the free bet
    await connection.query(
      "UPDATE spribe_freebets SET status = 'canceled', cancel_date = NOW() WHERE id = ?",
      [fb.id],
    );

    // ✅ Step 5: Format helpers
    const toUnits = (value) => Math.floor(Number(value) * 1000);
    const formatUTC = (date) => {
      if (!date) return null;
      return new Date(date)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "+00:00");
    };

    // ✅ Step 6: Respond with details
    return res.status(200).json({
      code: 200,
      message: "OK",
      operator_freebet_id: fb.operator_freebet_id,
      provider_freebet_id: fb.provider_freebet_id || "",
      currency: fb.currency,
      op_player_id: fb.id_user,
      free_bets: fb.free_bets,
      free_bets_left: fb.free_bets_left,
      bet_value: toUnits(fb.bet_value),
      win_amount: toUnits(fb.win_amount),
      create_date: formatUTC(fb.create_date),
      deposit_date: formatUTC(fb.deposit_date),
      cancel_date: formatUTC(new Date()), // just canceled now
      end_date: formatUTC(fb.end_date),
      status: "canceled",
      game: fb.game,
      provider: fb.provider,
    });
  } catch (error) {
    console.error("Error in spribeCancelFreebet:", error);
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
  spribeFreebetInfo,
  spribeAddFreebet,
  spribeCancelFreebet,
};

export default spribeGameController;
