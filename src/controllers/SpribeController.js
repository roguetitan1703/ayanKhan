import axios from "axios";
import connection from "../config/connectDB.js";
import crypto from "crypto";

const SECRET_TOKEN = "8VcEBp3iD3pSmPs7cvzaMNzFNmTjDSpC";
const OPERATOR_KEY = "75clubgames";
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
  const game = gameName;

  // console.log(userToken, gameName, game)

  try {
    const [userRows] = await connection.query(
      "SELECT * FROM users WHERE token = ?",
      [userToken],
    );

    // console.log(userRows,"userRows")
    // Check if user exists
    if (!userRows.length) {
      return res.status(404).json({
        errorCode: 4,
        message: "Token expired or invalid",
      });
    }

    const playerId = userRows[0].phone; // Get the actual player ID from the database
    const userId = userRows[0].id_user; // Get the actual player ID from the database

    // Generate the token and hash signature
    const timestamp = Date.now();
    const token = generateToken(playerId, timestamp);
    const hashSignature = generateHashSignature(token, timestamp);

    await connection.query(
      "UPDATE users SET spribeLaunchToken = ? WHERE phone = ?",
      [token, playerId],
    );
    console.log(token, "token");
    // Create launch URL
    const launchUrl = `${API_URL}/${game}?user=${userId}&token=${token}&currency=${currency}&lang=EN&return_url=${return_url}&operator=${OPERATOR_KEY}`;
    console.log(launchUrl);
    return res.json({ Data: launchUrl });
  } catch (error) {
    console.error("Error fetching player game link:", error);
    throw error;
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

    // Get current user balance from database instead of using transaction's new_balance
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
    const current_balance = Number(user.money * 1000); // Convert to same scale as transaction amounts
    const rollback_amount = Number(amount);
    const new_balance = current_balance + rollback_amount;

    console.log("current_balance", current_balance);
    console.log("rollback_amount", rollback_amount);
    console.log("new_balance", new_balance);

    // Update the user's balance to reflect the rollback (convert back to user's scale)
    await connection.query("UPDATE users SET money = ? WHERE id_user = ?", [
      new_balance / 1000,
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
