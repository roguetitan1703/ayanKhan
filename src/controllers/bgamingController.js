import axios from 'axios';
import connection from "../config/connectDB.js";
import crypto from 'crypto';


const GCP_URL= "https://int.bgaming-system.com/a8r/65lottery-int"
const AUTH_TOKEN="fyhG59ppqkNCatTRqh6cpAEF"
const SERVER_ID="65lottery-int"
const CASINO_ID="65lottery-int"



const generateToken = (playerId, timestamp) => {
    const payload = `${playerId}:${timestamp}`;
    return crypto.createHmac('sha256', SECRET_TOKEN).update(payload).digest('hex');
};

const generateHashSignature = (token, timestamp) => {
    const payload = `${token}:${timestamp}`;
    return crypto.createHmac('sha256', SECRET_TOKEN).update(payload).digest('base64');
};

export const bgamingLaunchGame = async (req, res) => {
   
    try {
        const response = await axios.get(GCP_URL, {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,  // Add token to the headers
            'Server-ID': SERVER_ID,                   // Custom header (optional)
            'Casino-ID': CASINO_ID                   // Custom header (optional)
          }
        });
    
        console.log('Response from server:', response.data);
      } catch (error) {
        console.error('Error configuring server:', error.message);
      }
};

export const bgamingWalletInfo = async (req, res) => {
   

    try {
        // Find the user in the database using the provided token
        const [userRows] = await connection.query('SELECT * FROM users LIMIT 1');

        // Check if user exists 
        if (!userRows.length) {
            console.log("first")
            return res.status(200).json({
                code: 401,
                message: 'Token expired or invalid',
            });
        }
        console.log("second")
        const user = userRows[0];
        // Send a success response with INR currency
        const response = {
            code: 200,
            message: "Success",
            data: {
                user_id: user.id_user,
                username: user.name_user,
                balance: user.money, // Assuming the balance is stored in user table
                currency: currency // Use the currency provided in the request
            }
        };
        console.log("third", response)
        return res.json(response);

    } catch (error) {
        console.log("four")
        console.log(error)
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

export const bgamingAuth = async (req, res) => {
    const { user_token, session_token, platform, currency } = req.body;
    console.log("bgamingAuth", req.body)

    try {
        // Find the user in the database using the provided token
        const [userRows] = await connection.query('SELECT * FROM users WHERE bgamingLaunchToken = ?', [user_token]);

        // Check if user exists 
        if (!userRows.length) {
            console.log("first")
            return res.status(200).json({
                code: 401,
                message: 'Token expired or invalid',
            });
        }
        console.log("second")
        const user = userRows[0];
        // Send a success response with INR currency
        const response = {
            code: 200,
            message: "Success",
            data: {
                user_id: user.id_user,
                username: user.name_user,
                balance: user.money, // Assuming the balance is stored in user table
                currency: currency // Use the currency provided in the request
            }
        };
        console.log("third", response)
        return res.json(response);

    } catch (error) {
        console.log("four")
        console.log(error)
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

export const bgamingDeposit = async (req, res) => {
    console.log(req.body,"bgamingDeposit");

    const {
        user_id, currency, amount, provider, provider_tx_id, game, action, action_id, session_token, platform, withdraw_provider_tx_id
    } = req.body;

    try {
        // Check if the transaction ID is already processed to handle duplicate transactions
        const [existingTransaction] = await connection.query('SELECT * FROM bgamingtransaction WHERE provider_tx_id = ?', [provider_tx_id]);

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
                    currency
                }
            };
            return res.status(200).json(duplicateResponse);
        }

        // Find the user in the database using the provided user_id
        const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);

        // Check if user exists
        if (!userRows.length) {
            return res.status(401).json({
                code: 401,
                message: 'User token is invalid',
            });
        }

        const user = userRows[0];
        const old_balance = Number(user.money);
        if (amount > old_balance) {
            return res.status(402).json({
                code: 402,
                message: 'Insufficient funds',
                data: {
                    user_id,
                    old_balance,
                    required_amount: amount,
                    currency
                }
            });
        }
        const new_balance = Number(old_balance) - Number(amount);

        // Update the user's balance
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [new_balance, user_id]);

        // Generate a unique operator transaction ID
        const operator_tx_id = `OP_TX_${Date.now()}`;

        // Record the deposit transaction in the database
        await connection.query('INSERT INTO bgamingtransaction (id_user,type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, deposit_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)', [
            user_id, 0, user.phone, user.name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, amount, game, action, action_id, session_token
        ]);

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
                currency
            }
        };

        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('Error processing deposit:', error);
        return res.status(500).json({
            code: 500,
            message: 'Internal error',
            detail: error.message
        });
    }
};


export const bgamingWithdraw = async (req, res) => {
    console.log(req.body,"bgamingWithdraw");

    const {
        user_id, currency, amount, provider, provider_tx_id, game, action, action_id, session_token, platform
    } = req.body;

    try {
        // Find the user in the database using the provided user_id
        const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);

        // Check if user exists
        if (!userRows.length) {
            return res.status(200).json({
                code: 401,
                message: 'User token is invalid',
            });
        }

        const user = userRows[0];
        const old_balance = Number(user.money);

        // Check if user has sufficient funds
        if (old_balance < amount) {
            return res.status(200).json({
                code: 402,
                message: 'Insufficient funds',
            });
        }

        const new_balance = Number(old_balance) + Number(amount);

        // Update the user's balance
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [new_balance, user_id]);

        // Generate a unique operator transaction ID
        const operator_tx_id = `OP_TX_${Date.now()}`;

        // Record the withdrawal transaction in the database
        await connection.query('INSERT INTO bgamingtransaction (id_user,type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)', [
            user_id, 1, user.phone, user.name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, amount, game, action, action_id, session_token
        ]);

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
                currency
            }
        };

        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

export const bgamingRollback = async (req, res) => {
    console.log(req.body, "bgamingRollback");

    const {
        user_id, amount, provider, rollback_provider_tx_id, provider_tx_id, game, session_token, action, action_id
    } = req.body;

    try {
        // Check if the transaction ID is already processed
        const [existingTransaction] = await connection.query('SELECT * FROM bgamingtransaction WHERE provider_tx_id = ?', [rollback_provider_tx_id]);

        if (!existingTransaction.length) {
            console.log("Transaction not found")
            return res.status(200).json({
                code: 408,
                message: "Transaction not found",
            });
        }
        console.log("Transaction found")
        const transaction = existingTransaction[0];
        const user_id = transaction.id_user;
        const old_balance = Number(transaction.new_balance);
        const new_balance = Number(old_balance) + Number(amount); // Rollback the amount

        console.log("old_balance", old_balance)
        console.log("new_balance", new_balance)

        // Find the user in the database using the provided user_id
        const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);

        if (!userRows.length) {
            console.log("first")
            return res.status(200).json({
                code: 401,
                message: 'User token is invalid',
            });
        }

        const user = userRows[0];

        // Update the user's balance to reflect the rollback
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [new_balance, user_id]);
        console.log("first2")
        // Check for duplicate rollback using the provider_tx_id
        const [duplicateTransaction] = await connection.query('SELECT * FROM bgamingtransaction WHERE provider_tx_id = ?', [provider_tx_id]);

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
                    currency: transaction.currency
                }
            };
            return res.status(200).json(duplicateResponse);
        }

        // Generate a unique operator transaction ID for the rollback
        const operator_tx_id = `OP_TX_${Date.now()}`;

        // Record the rollback transaction in the database
        await connection.query('INSERT INTO bgamingtransaction (id_user, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            user_id, user.phone, user.name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, transaction.currency, amount, game, action, action_id, session_token, 2 // type 2 for rollback
        ]);

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
                currency: transaction.currency
            }
        };

        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('Error processing rollback:', error);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
            detail: error.message
        });
    }
};


const bgamingGameController = {
    bgamingLaunchGame,
    bgamingAuth,
    bgamingDeposit,
    bgamingWithdraw,
    bgamingRollback,
    bgamingWalletInfo
};

export default bgamingGameController;