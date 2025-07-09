import axios from 'axios';
import connection from "../config/connectDB.js";
import crypto from 'crypto';


// Constants from your example
const API_SALT = "5f3c133b520cf405601bae3e24c1f64a"; // Your API Salt
const agent_id = "4197";
const username = "Reddysbook_INR";


const SECRET_TOKEN = 'A3F0C3B3-8AD3-4D14-8CC3-2B2C4524894E';
const OPERATOR_KEY = 'reddysbookstg';
const OPERATOR_ID = '20004196';
const API_URL = "https://dev-test.smartSoft.io/games/launch"
const return_url = "https://75club.games/"
const currency = "INR"
const Portalname = "lottery65"


const generateToken = (playerId, timestamp) => {
    const payload = `${playerId}:${timestamp}`;
    return crypto.createHmac('sha256', SECRET_TOKEN).update(payload).digest('hex');
};

const generateHashSignature = (token, timestamp) => {
    const payload = `${token}:${timestamp}`;
    return crypto.createHmac('sha256', SECRET_TOKEN).update(payload).digest('base64');
};

export const smartSoftLaunchGame = async (req, res) => {
    const userToken = req.userToken;
    const { gameName } = req.body
    const game = gameName;

    try {
        const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [userToken]);
        console.log(userRows,"userRows")
        // Check if user exists
        if (!userRows.length) {
            return res.status(404).json({
                errorCode: 4,
                message: 'Token expired or invalid',
            });
        }

        const playerId = userRows[0].phone; // Get the actual player ID from the database
        const userId = userRows[0].id_user; // Get the actual player ID from the database
        
       

        // Generate the token and hash signature
        const timestamp = Date.now();
        const token = generateToken(playerId, timestamp);
        const hashSignature = generateHashSignature(token, timestamp);

        await connection.query('UPDATE users SET smartSoftLaunchToken = ? WHERE phone = ?', [token, playerId]);
        console.log(token, "token")

       
        // Create launch URL
        // const launchUrl = `${API_URL}/${game}?user=${userId}&token=${token}&currency=${currency}&lang=EN&return_url=${return_url}&operator=${OPERATOR_KEY}`;

        const launchUrl = `https://eu-staging.ssgportal.com/GameLauncher/Loader.aspx?GameName=${game}&Token=${token}&PortalName=${Portalname}&lang=en&returnUrl=${return_url}`
       

       
        console.log(launchUrl)
        return res.json({ Data: launchUrl });
    } catch (error) {
        console.error('Error fetching player game link:', error);
        throw error;
    }
};


export const ActivateSession = async (req, res) => {
    const { Token } = req.body;
    console.log("ActivateSession", req.body)

    try {
        // Find the user in the database using the provided token
        const [userRows] = await connection.query('SELECT * FROM users WHERE smartSoftLaunchToken = ?', [Token]);

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
        const timestamp = Date.now();
        const SessionId = generateToken(user.phone, timestamp);
        const response = {
           
                SessionId: Token,
                ClientExternalKey: user.id_user,
                UserName: user.name_user,
                CurrencyCode: currency, 
                Portalname: Portalname
           
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

export const smartSoftGetBalance = async (req, res) => {
    try {
        // Log all received headers for debugging
        console.log("Headers received:", req.headers);

        // Extract values from headers (account for case sensitivity)
        const ClientExternalKey = req.headers['x-clientexternalkey'] || req.headers['X-ClientExternalKey'];
        // const CurrencyCode = req.headers['currencycode'] || req.headers['CurrencyCode'];
        const SessionId = req.headers['x-sessionid'] || req.headers['X-SessionId'];

        console.log(ClientExternalKey, currency, SessionId)

        // Validate required headers
        if (!ClientExternalKey) {
            console.error("Missing required headers: X-ClientExternalKey or CurrencyCode");
            return res.status(400).json({
                code: 400,
                message: 'Missing required headers: X-ClientExternalKey',
            });
        }



        // Find the user in the database using the provided SessionId (not ClientExternalKey)
        const [userRows] = await connection.query(
            'SELECT * FROM users WHERE smartSoftLaunchToken = ?',
            [SessionId]
        );

        // Check if user exists
        if (!userRows.length) {
            console.log("Invalid token or token expired");
            return res.status(200).json({
                code: 401,
                message: 'Token expired or invalid',
            });
        }

        const user = userRows[0];

        // Send a success response
        const response = {
            Amount: user.money,
            CurrencyCode: req.query.CurrencyCode, // Use the currency from the header
        };

        console.log("Response sent:", response);
        return res.json(response);

    } catch (error) {
        console.error("Internal error:", error);
        return res.status(500).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

export const smartSoftDeposit = async (req, res) => {
    console.log(req.body, "smartSoftDeposit");

    const { 
        TransactionId, 
        Amount, 
        TransactionType,
        CurrencyCode,
        TransactionInfo
    } = req.body;

    const {
        Source,
        GameName,
        RoundId,
        GameNumber,
        CashierTransacitonId
    } = TransactionInfo;

   

    try {

        const SessionId = req.headers['x-sessionid'] || req.headers['X-SessionId'];

        // Find the user in the database using the provided user_id
        const [userRows] = await connection.query('SELECT * FROM users WHERE smartSoftLaunchToken = ?', [SessionId]);

        // Check if user exists
        if (!userRows.length) {
            return res.status(200).json({
               OperatorErrorHeaders: {
                    "X-ErrorMessage": "Invalid Signature response",
                    "X-ErrorCode": "1"
                },
                HTTPStatusCode: 500
            });
        }
        // Check if the transaction ID is already processed to handle duplicate transactions
        const [existingTransaction] = await connection.query('SELECT * FROM smartSofttransaction WHERE provider_tx_id = ?', [TransactionId]);

        if (existingTransaction.length) {
            const duplicateResponse = {
                ErrorCode: 409,
                message: "Duplicate transaction",
                data: {
                    user_id: existingTransaction[0].id_user, // Correct user_id
                    operator_tx_id: existingTransaction[0].operator_tx_id,
                    provider: 'smartSoft', // Hardcoded provider (adjust if necessary)
                    provider_tx_id: existingTransaction[0].provider_tx_id,
                    old_balance: existingTransaction[0].old_balance,
                    new_balance: existingTransaction[0].new_balance,
                    currency: existingTransaction[0].currency
                }
            };
            return res.status(200).json(duplicateResponse);
        }


        const user = userRows[0];
        const old_balance = parseFloat(user.money);
        
        // Check if the user has sufficient funds
        if (Amount > old_balance) {
            return res.status(402).json({
                code: 402,
                message: 'Insufficient funds',
                data: {
                    user_id: user.id_user,
                    old_balance,
                    required_amount: Amount,
                    currency: CurrencyCode
                }
            });
        }

        const new_balance = parseFloat((old_balance - Amount).toFixed(2));

        // Update the user's balance
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [new_balance, user.id_user]);

        // Generate a unique operator transaction ID
        const operator_tx_id = `OP_TX_${Date.now()}`;

        // Record the deposit transaction in the database
        await connection.query('INSERT INTO smartSofttransaction (id_user, type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, deposit_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            user.id_user, 0, user.phone, user.name_user, 'smartSoft', TransactionId, operator_tx_id, old_balance, new_balance, CurrencyCode, Amount, TransactionInfo.GameName, TransactionInfo.GameNumber, TransactionInfo.RoundId, SessionId
        ]);

        const successResponse = {
            TransactionId: operator_tx_id,
                Balance: new_balance,  // Updated balance
                CurrencyCode
           
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

export const smartSoftWithdraw = async (req, res) => {
    console.log(req.body,"smartSoftWithdraw");

    const { 
        TransactionId, 
        Amount, 
        TransactionType,
        CurrencyCode,
        TransactionInfo
    } = req.body;

    const {
        Source,
        GameName,
        RoundId,
        GameNumber,
        CashierTransacitonId
    } = TransactionInfo;

    try {

        const SessionId = req.headers['x-sessionid'] || req.headers['X-SessionId'];

        // Find the user in the database using the provided user_id
        const [userRows] = await connection.query('SELECT * FROM users WHERE smartSoftLaunchToken = ?', [SessionId]);

        // Check if user exists
        if (!userRows.length) {
            return res.status(200).json({
                code: 401,
                message: 'User token is invalid',
            });
        }

        const user = userRows[0];
        const old_balance = parseFloat(user.money);

        // Check if user has sufficient funds
        if (old_balance < Amount) {
            return res.status(200).json({
                code: 402,
                message: 'Insufficient funds',
            });
        }

        const new_balance = parseFloat((old_balance).toFixed(2)) + parseFloat((Amount).toFixed(2));

        // Update the user's balance
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [new_balance, user.id_user]);    

        // // Generate a unique operator transaction ID
        const operator_tx_id = `OP_TX_${Date.now()}`;

        // Record the withdrawal transaction in the database
        await connection.query('INSERT INTO smartSofttransaction (id_user, type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            user.id_user, 0, user.phone, user.name_user, 'smartSoft', TransactionId, operator_tx_id, old_balance, new_balance, CurrencyCode, Amount, TransactionInfo.GameName, TransactionInfo.GameNumber, TransactionInfo.RoundId, SessionId
        ]);

        const successResponse = {
            TransactionId: operator_tx_id,
            Balance: new_balance,
          
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

export const smartSoftRollback = async (req, res) => {
    console.log(req.body, "smartSoftRollback");

    const {
        CurrentTransactionId,
        TransactionId,
        Amount,
        CurrencyCode,
        TransactionInfo
    } = req.body;

    try {
        const SessionId = req.headers['x-sessionid'] || req.headers['X-SessionId'];

        // Validate session token and retrieve user
        const [userRows] = await connection.query(
            'SELECT * FROM users WHERE smartSoftLaunchToken = ?',
            [SessionId]
        );

        if (!userRows.length) {
            return res.status(200).json({
                code: 401,
                message: 'User token is invalid',
            });
        }

        // Check if the transaction exists
        const [existingTransaction] = await connection.query(
            'SELECT * FROM smartSofttransaction WHERE provider_tx_id = ?',
            [TransactionId]
        );

        if (!existingTransaction.length) {
            return res.status(200).json({
                code: 408,
                message: "Transaction not found",
            });
        }

        console.log("Transaction found", existingTransaction[0]);
        const transaction = existingTransaction[0];
        const user_id = transaction.id_user;
        const old_balance = parseFloat(transaction.new_balance);
        const rollbackAmount = parseFloat(Amount);

        if (isNaN(rollbackAmount) || rollbackAmount <= 0) {
            return res.status(200).json({
                code: 400,
                message: "Invalid amount for rollback",
            });
        }

        // Round both old balance and rollback amount to 2 decimal places (for precision)
        const roundedOldBalance = Math.round(old_balance * 100) / 100;
        const roundedRollbackAmount = Math.round(rollbackAmount * 100) / 100;

        // Calculate the new balance after rollback (subtracting the rollback amount)
        let new_balance = roundedOldBalance + roundedRollbackAmount;

        // Round the new balance to 2 decimal places (to avoid precision errors)
        new_balance = Math.round(new_balance * 100) / 100;

        console.log("old_balance (rounded):", roundedOldBalance, "rollbackAmount (rounded):", roundedRollbackAmount, "new_balance (rounded):", new_balance);

        const user = userRows[0];

        // Prevent duplicate rollback for the same transaction ID
        const [duplicateTransaction] = await connection.query(
            'SELECT * FROM smartSofttransaction WHERE operator_tx_id = ? AND action = 2',
            [TransactionId]
        );

        if (duplicateTransaction.length) {
            return res.status(200).json({
                code: 409,
                message: "Duplicate transaction rollback",
                data: {
                    user_id,
                    operator_tx_id: duplicateTransaction[0].operator_tx_id,
                    provider: "smartSoft",
                    provider_tx_id: duplicateTransaction[0].provider_tx_id,
                    old_balance: duplicateTransaction[0].old_balance,
                    new_balance: duplicateTransaction[0].new_balance,
                    currency: duplicateTransaction[0].currency
                }
            });
        }

        // Update user's balance in the database
        await connection.query(
            'UPDATE users SET money = ? WHERE id_user = ?',
            [new_balance, user_id]
        );

        // Generate a unique operator transaction ID
        const operator_tx_id = `OP_TX_${Date.now()}`;

        // Log the rollback transaction to the database
        await connection.query(
            `INSERT INTO smartSofttransaction 
            (id_user, phone, name_user, provider, provider_tx_id, operator_tx_id, 
            old_balance, new_balance, currency, withdrawal_amount, game, action, 
            action_id, session_token, type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                user_id,
                user.phone,
                user.name_user,
                "smartSoft",
                TransactionId,
                operator_tx_id,
                roundedOldBalance,
                new_balance,
                CurrencyCode || transaction.currency,
                roundedRollbackAmount,
                TransactionInfo?.GameName || "N/A",
                TransactionInfo?.GameNumber || "N/A",
                TransactionInfo?.RoundId || "N/A",
                SessionId,
                2 // type 2 for rollback
            ]
        );

        // Send success response
        return res.status(200).json({
            operator_tx_id,
            Balance: new_balance.toFixed(2)  // Ensure response balance is in two decimal format
        });
    } catch (error) {
        console.error('Error processing rollback:', error);
        return res.status(500).json({
            code: 500,
            message: 'Internal server error',
            detail: error.message
        });
    }
};

// export const smartSoftRollback = async (req, res) => {
//     console.log(req.body, "smartSoftRollback");

//     const {
//         CurrentTransactionId,
//         TransactionId,
//         Amount,
//         CurrencyCode,
//         TransactionInfo
//     } = req.body;

//     try {
//         const SessionId = req.headers['x-sessionid'] || req.headers['X-SessionId'];

//         // Validate session token and retrieve user
//         const [userRows] = await connection.query(
//             'SELECT * FROM users WHERE smartSoftLaunchToken = ?',
//             [SessionId]
//         );

//         if (!userRows.length) {
//             return res.status(200).json({
//                 code: 401,
//                 message: 'User token is invalid',
//             });
//         }

//         // Check if the transaction exists
//         const [existingTransaction] = await connection.query(
//             'SELECT * FROM smartSofttransaction WHERE provider_tx_id = ?',
//             [TransactionId]
//         );

//         if (!existingTransaction.length) {
//             return res.status(200).json({
//                 code: 408,
//                 message: "Transaction not found",
//             });
//         }

//         console.log("Transaction found");
//         const transaction = existingTransaction[0];
//         const user_id = transaction.id_user;
//         const old_balance = parseFloat(transaction.new_balance);
//         const rollbackAmount = parseFloat(Amount);

//         if (isNaN(rollbackAmount) || rollbackAmount <= 0) {
//             return res.status(200).json({
//                 code: 400,
//                 message: "Invalid amount for rollback",
//             });
//         }

//         const new_balance = parseFloat((old_balance + rollbackAmount));
//         console.log("old_balance:", old_balance, "new_balance:", new_balance);

//         const user = userRows[0];

//         // Prevent duplicate rollback for the same transaction ID
//         const [duplicateTransaction] = await connection.query(
//             'SELECT * FROM smartSofttransaction WHERE provider_tx_id = ? AND action = 2',
//             [TransactionId]
//         );

//         if (duplicateTransaction.length) {
//             return res.status(200).json({
//                 code: 409,
//                 message: "Duplicate transaction rollback",
//                 data: {
//                     user_id,
//                     operator_tx_id: duplicateTransaction[0].operator_tx_id,
//                     provider: "smartSoft",
//                     provider_tx_id: duplicateTransaction[0].provider_tx_id,
//                     old_balance: duplicateTransaction[0].old_balance,
//                     new_balance: duplicateTransaction[0].new_balance,
//                     currency: duplicateTransaction[0].currency
//                 }
//             });
//         }

//         // Update user's balance
//         await connection.query(
//             'UPDATE users SET money = ? WHERE id_user = ?',
//             [new_balance, user_id]
//         );

//         // Generate a unique operator transaction ID
//         const operator_tx_id = `OP_TX_${Date.now()}`;

//         // Log the rollback transaction
//         await connection.query(
//             `INSERT INTO smartSofttransaction 
//             (id_user, phone, name_user, provider, provider_tx_id, operator_tx_id, 
//             old_balance, new_balance, currency, withdrawal_amount, game, action, 
//             action_id, session_token, type) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//             [
//                 user_id,
//                 user.phone,
//                 user.name_user,
//                 "smartSoft",
//                 TransactionId,
//                 operator_tx_id,
//                 old_balance,
//                 new_balance,
//                 CurrencyCode || transaction.currency,
//                 rollbackAmount,
//                 TransactionInfo?.GameName || "N/A",
//                 TransactionInfo?.GameNumber || "N/A",
//                 TransactionInfo?.RoundId || "N/A",
//                 SessionId,
//                 2 // type 2 for rollback
//             ]
//         );

//         // Send success response
//         return res.status(200).json({
           
//                 TransactionId,
//                 Balance: new_balance
          
//         });
//     } catch (error) {
//         console.error('Error processing rollback:', error);
//         return res.status(500).json({
//             code: 500,
//             message: 'Internal server error',
//             detail: error.message
//         });
//     }
// };







const smartSoftGameController = {
    smartSoftLaunchGame,
    smartSoftGetBalance,
    smartSoftDeposit,
    smartSoftWithdraw,
    smartSoftRollback,
    ActivateSession
};

export default smartSoftGameController;