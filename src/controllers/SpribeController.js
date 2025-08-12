import axios from "axios";
import connection from "../config/connectDB.js";
import crypto from "crypto";

const SECRET_TOKEN = "P8cs7H7swSnr1WwDRNQOBCPQjCLvkOlQ";
const OPERATOR_KEY = "reddybook75new";
const API_URL = "https://dev-test.spribe.io/games/launch";
const return_url = "https://75club.games/";
const currency = "INR";

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

export const spribeLaunchGame = async (req, res) => {
  const userToken = req.userToken;
  const { gameName } = req.body;

  console.log(
    `[LAUNCH] Incoming request: token=${userToken}, game=${gameName}`,
  );

  try {
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE token = ?",
      [userToken],
    );
    console.log(`[LAUNCH] DB lookup result: ${JSON.stringify(userRows)}`);

    if (!userRows.length) {
      console.log(`[LAUNCH] ERROR: No user found for token ${userToken}`);
      return res.status(404).json({
        errorCode: 4,
        message: "Token expired or invalid",
      });
    }

    const user = userRows[0];
    const token = generateToken(user.phone, Date.now());
    console.log(`[LAUNCH] Generated token: ${token}`);

    await connection.query(
      "UPDATE users SET spribeLaunchToken = ? WHERE phone = ?",
      [token, user.phone],
    );
    console.log(`[LAUNCH] Updated spribeLaunchToken for phone=${user.phone}`);

    const launchParams = new URLSearchParams({
      user: user.id_user,
      token: token,
      lang: LANG,
      currency: CURRENCY,
      operator: OPERATOR_KEY,
      account_history_url: CALLBACK_URL,
    });
    const launchUrl = `${API_URL}/${gameName}?${launchParams.toString()}`;
    console.log(`[LAUNCH] Final game URL: ${launchUrl}`);

    return res.json({ Data: launchUrl });
  } catch (error) {
    console.log(`[LAUNCH][EXCEPTION] ${error.message}\n${error.stack}`);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const spribeInfo = async (req, res) => {
  const { session_token, currency, user_id } = req.body;
  console.log("spribeInfo", req.body);

  try {
    // Find the user in the database using the provided token
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );

    // Check if user exists
    if (!userRows.length) {
      console.log("first");
      return res.status(200).json({
        code: 401,
        message: "User token is invalid",
      });
    }
    console.log("second");
    const user = userRows[0];
    // Send a success response with INR currency

    // 1000 stands for 1
    // 500 = 500000 units
    // 0.5 = 500 units
    // 0.05 = 50 units

    const response = {
      code: 200,
      message: "ok",
      data: {
        user_id: user.id_user,
        username: user.name_user,
        balance: Number(user.money) * 1000, // Convert to the correct unit by dividing by 1000
        currency: currency, // Use the currency provided in the request
      },
    };

    console.log("third", response);
    return res.json(response);
  } catch (error) {
    console.log("four");
    console.log(error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
    });
  }
};

export const spribeAuth = async (req, res) => {
  const { user_token, session_token, platform, currency } = req.body;
  console.log("spribeAuth", req.body);

  try {
    // Find the user in the database using the provided token
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE spribeLaunchToken = ?",
      [user_token],
    );

    // Check if user exists
    if (!userRows.length) {
      console.log("first");
      return res.status(200).json({
        code: 401,
        message: "Token expired or invalid",
      });
    }
    console.log("second");
    const user = userRows[0];
    // Send a success response with INR currency

    // 1000 stands for 1
    // 500 = 500000 units
    // 0.5 = 500 units
    // 0.05 = 50 units

    const response = {
      code: 200,
      message: "Success",
      data: {
        user_id: user.id_user,
        username: user.name_user,
        balance: Number(user.money) * 1000, // Convert to the correct unit by dividing by 1000
        currency: currency, // Use the currency provided in the request
      },
    };

    console.log("third", response);
    return res.json(response);
  } catch (error) {
    console.log("four");
    console.log(error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
    });
  }
};

export const spribeDeposit = async (req, res) => {
  console.log(req.body, "spribeDeposit");

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
    withdraw_provider_tx_id,
  } = req.body;

  try {
    // Check if the transaction ID is already processed to handle duplicate transactions
    const [existingTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [provider_tx_id],
    );

    if (existingTransaction.length) {
      const duplicateResponse = {
        code: 409,
        message: "Duplicate transaction",
        data: {
          user_id,
          operator_tx_id: existingTransaction[0].operator_tx_id,
          provider,
          provider_tx_id,
          old_balance: existingTransaction[0].old_balance,
          new_balance: existingTransaction[0].new_balance,
          currency,
        },
      };
      return res.status(200).json(duplicateResponse);
    }

    // Find the user in the database using the provided user_id
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );

    // Check if user exists
    if (!userRows.length) {
      return res.status(401).json({
        code: 401,
        message: "User token is invalid",
      });
    }

    const user = userRows[0];
    const old_balance = Number(user.money * 1000);
    if (amount > old_balance) {
      return res.status(402).json({
        code: 402,
        message: "Insufficient funds",
        data: {
          user_id,
          old_balance,
          required_amount: amount,
          currency,
        },
      });
    }
    let new_balance = Number(old_balance) - Number(amount);

    // Update the user's balance
    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance / 1000,
      user_id,
    ]);

    // Generate a unique operator transaction ID
    const operator_tx_id = `OP_TX_${Date.now()}`;

    // Record the deposit transaction in the database
    await connection.query(
      "INSERT INTO spribetransaction (id_user,type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, deposit_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)",
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
        currency,
        amount,
        game,
        action,
        action_id,
        session_token,
      ],
    );

    const successResponse = {
      code: 200,
      message: "Success",
      data: {
        user_id,
        operator_tx_id,
        provider,
        provider_tx_id,
        old_balance,
        new_balance,
        currency,
      },
    };

    return res.status(200).json(successResponse);
  } catch (error) {
    console.error("Error processing deposit:", error);
    return res.status(500).json({
      code: 500,
      message: "Internal error",
      detail: error.message,
    });
  }
};

export const spribeWithdraw = async (req, res) => {
  console.log(req.body, "spribeWithdraw");

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
    // Find the user in the database using the provided user_id
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );

    // Check if user exists
    if (!userRows.length) {
      return res.status(200).json({
        code: 401,
        message: "User token is invalid",
      });
    }

    const user = userRows[0];
    const old_balance = Number(user.money * 1000);

    // Check if user has sufficient funds
    if (old_balance < amount) {
      return res.status(200).json({
        code: 402,
        message: "Insufficient funds",
      });
    }

    const new_balance = Number(old_balance) + Number(amount);

    // Update the user's balance
    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance / 1000,
      user_id,
    ]);

    // Generate a unique operator transaction ID
    const operator_tx_id = `OP_TX_${Date.now()}`;

    // Record the withdrawal transaction in the database
    await connection.query(
      "INSERT INTO spribetransaction (id_user,type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)",
      [
        user_id,
        1,
        user.phone,
        user.name_user,
        provider,
        provider_tx_id,
        operator_tx_id,
        old_balance,
        new_balance,
        currency,
        amount,
        game,
        action,
        action_id,
        session_token,
      ],
    );

    const successResponse = {
      code: 200,
      message: "ok",
      data: {
        user_id,
        operator_tx_id,
        provider,
        provider_tx_id,
        old_balance,
        new_balance,
        currency,
      },
    };

    return res.status(200).json(successResponse);
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return res.status(200).json({
      code: 500,
      message: "Internal error",
    });
  }
};

export const spribeRollback = async (req, res) => {
  console.log(req.body, "spribeRollback");

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
    // Check if the transaction ID is already processed
    const [existingTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [rollback_provider_tx_id],
    );

    if (!existingTransaction.length) {
      console.log("Transaction not found");
      return res.status(200).json({
        code: 408,
        message: "Transaction not found",
      });
    }
    console.log("Transaction found");
    const transaction = existingTransaction[0];
    const user_id = transaction.id_user;
    const old_balance = Number(transaction.new_balance);
    const new_balance = Number(old_balance) + Number(amount); // Rollback the amount

    console.log("old_balance", old_balance);
    console.log("new_balance", new_balance);

    // Find the user in the database using the provided user_id
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [user_id],
    );

    if (!userRows.length) {
      console.log("first");
      return res.status(200).json({
        code: 401,
        message: "User token is invalid",
      });
    }

    const user = userRows[0];

    // Update the user's balance to reflect the rollback
    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance,
      user_id,
    ]);
    console.log("first2");
    // Check for duplicate rollback using the provider_tx_id
    const [duplicateTransaction] = await connection.query(
      "SELECT * FROM spribetransaction WHERE provider_tx_id = ?",
      [provider_tx_id],
    );

    if (duplicateTransaction.length) {
      const duplicateResponse = {
        code: 409,
        message: "Duplicate transaction",
        data: {
          user_id,
          operator_tx_id: duplicateTransaction[0].operator_tx_id,
          provider,
          provider_tx_id,
          old_balance: duplicateTransaction[0].old_balance,
          new_balance: duplicateTransaction[0].new_balance,
          currency: transaction.currency,
        },
      };
      return res.status(200).json(duplicateResponse);
    }

    // Generate a unique operator transaction ID for the rollback
    const operator_tx_id = `OP_TX_${Date.now()}`;

    // Record the rollback transaction in the database
    await connection.query(
      "INSERT INTO spribetransaction (id_user, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user_id,
        user.phone,
        user.name_user,
        provider,
        provider_tx_id,
        operator_tx_id,
        old_balance,
        new_balance,
        transaction.currency,
        amount,
        game,
        action,
        action_id,
        session_token,
        2, // type 2 for rollback
      ],
    );

    const successResponse = {
      code: 200,
      message: "Success",
      data: {
        user_id,
        operator_tx_id,
        provider,
        provider_tx_id,
        old_balance,
        new_balance,
        currency: transaction.currency,
      },
    };

    return res.status(200).json(successResponse);
  } catch (error) {
    console.error("Error processing rollback:", error);
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
