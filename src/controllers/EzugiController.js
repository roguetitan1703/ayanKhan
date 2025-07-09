import axios from 'axios';
import connection from "../config/connectDB.js";
import crypto from 'crypto';


// Constants from your example
const API_SALT = "5f3c133b520cf405601bae3e24c1f64a"; // Your API Salt
const agent_id = "4197";
const username = "Reddysbook_INR";


const SECRET_TOKEN = 'db358db8-915e-4dd3-a308-61f29e5b34a3';
const OPERATOR_KEY = 'reddysbookstg';
const OPERATOR_ID = '11030001';
const API_URL = "https://dev-test.ezugi.io/games/launch"
const return_url = "https://75club.games/"
const currency = "INR"


const generateToken = (playerId, timestamp) => {
    const payload = `${playerId}:${timestamp}`;
    return crypto.createHmac('sha256', SECRET_TOKEN).update(payload).digest('hex');
};

const generateHashSignature = (token, timestamp) => {
    const payload = `${token}:${timestamp}`;
    return crypto.createHmac('sha256', SECRET_TOKEN).update(payload).digest('base64');
};

export const ezugiLaunchGame = async (req, res) => {
    const userToken = req.userToken;
    const { gameName } = req.body
    const game = gameName;

    try {
        const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [userToken]);
        console.log(userRows,"userRows")
        // Check if user exists
        if (!userRows.length) {
            return res.status(200).json({
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

        await connection.query('UPDATE users SET ezugiLaunchToken = ? WHERE phone = ?', [token, playerId]);
        console.log(token, "token")

        // Create launch URL
        // const launchUrl = `${API_URL}/${game}?user=${userId}&token=${token}&currency=${currency}&lang=EN&return_url=${return_url}&operator=${OPERATOR_KEY}`;
        // const launchUrl = `https://playint.tableslive.com/auth/?operatorId=${OPERATOR_ID}&token=${token}&selectGame=${game}`;

        const launchUrl = `https://playint.tableslive.com/auth/?operatorId=${OPERATOR_ID}&token=${token}`;

       
        console.log(launchUrl)
        return res.json({ Data: launchUrl });
    } catch (error) {
        console.error('Error fetching player game link:', error);
        throw error;
    }
};

export const ezugiAuth = async (req, res) => {
    const { token, platformId, operatorId, timestamp } = req.body;
    console.log("ezugiAuth", req.body);

    try {
        // Find the user in the database using the provided token
        const [userRows] = await connection.query('SELECT * FROM users WHERE ezugiLaunchToken = ?', [token]);

        console.log(userRows[0])
        // Check if user exists 
        if (!userRows.length) {
            console.log("Token expired or invalid");
            return res.status(200).json({

                    operatorId: operatorId, // Static operator ID
                    errorCode: 6, // Token not found
                    errorDescription: "Token not found.", // Success message
                    timestamp: +new Date, // Current timestamp in milliseconds
                    

            });
        }

        const user = userRows[0];

        const playerTokenAtLaunch = generateToken(user.phone, timestamp);

        // Construct the response to match the desired format
        const response = {
            operatorId: operatorId, // Static operator ID
            uid: user.id_user, // Assuming `id_user` is numeric
            nickName: user.name_user,
            playerTokenAtLaunch: token, // Use the provided value or an empty string
            token: playerTokenAtLaunch,
            balance: Number(parseFloat(user.money).toFixed(2)), // Assuming `money` holds the balance
            currency: "INR", // Default to USD if not provided
            clientIP: "152.58.70.71", // Use request IP or fallback
            errorCode: 0, // No error
            errorDescription: "ok", // Success message
            timestamp: +new Date, // Current timestamp in milliseconds
            VIP: user.vip_status || "0" // Assuming `vip_status` holds VIP status
        };

        console.log("Success Response", response);
        return res.json(response);

    } catch (error) {
        console.error("Error processing request", error);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

//this is credit
export const ezugiDeposit = async (req, res) => {
    console.log(req.body, "ezugiDeposit");

    const {
        currency,
        action_id, 
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
        betTypeID,
        tableId,
        seatId,
        creditAmount,
        operatorId,
        roundId,
        timestamp

    } = req.body;
       

    try {

         // Find the user in the database using the provided user_id
         const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [uid]);

        // Check if the transaction ID is already processed to handle duplicate transactions

        const [duplicateTransaction] = await connection.query('SELECT * FROM ezugitransaction WHERE provider_tx_id = ?', [transactionId]);

        if (duplicateTransaction.length) {
            const duplicateResponse = {
            operatorId: operatorId,
            roundId: roundId,
            uid: uid,
            token: token,
            balance: Number(parseFloat(userRows[0].money).toFixed(2)),
            transactionId: transactionId,
            currency: currency,
            errorCode: 0,
            errorDescription: "Transaction already processed",
            timestamp: +new Date


            };
            return res.status(200).json(duplicateResponse);
        }
       
       
        // Check if user exists
        if (!userRows.length) {
            return res.status(200).json({
                operatorId: operatorId,
                uid: uid,
                nickName: "",
                token: token,
                balance: 0,
                transactionId: transactionId,
                currency: currency,
                errorCode: 7,
                roundId: roundId,
                errorDescription: "User not found",
                timestamp: +new Date
            });
        }

        const user = userRows[0];
        const old_balance = Number(user.money);
        if (creditAmount > old_balance) {
            return res.status(200).json({
            operatorId: operatorId,
            uid: uid,
            nickName: user.name_user,
            token: token,
            balance: Number(parseFloat(old_balance).toFixed(2)), // Use the original old_balance,
            transactionId: transactionId,
            currency: currency,
            timestamp: +new Date,
            errorCode: 400,
            roundId: roundId,
            bonusAmount: 0,
            errorDescription: "ok",

            });
        }
        const new_balance = Number(old_balance) + Number(creditAmount);

        // Update the user's balance
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [new_balance, uid]);

        // Record the deposit transaction in the database
        await connection.query('INSERT INTO ezugitransaction (id_user, type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, deposit_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            uid, 0, user.phone, user.name_user, "ezugi", transactionId, transactionId, old_balance, new_balance, currency, creditAmount, "ezugi", "deposit", gameId, token
        ]);

        // Success response
        const successResponse = {
            uid: uid,
            operatorId: operatorId,
            nickName: user.name_user,
            token: token,
            balance: Number(parseFloat(new_balance).toFixed(2)), // Use the updated new_balance,
            transactionId: transactionId,
            timestamp: +new Date,
            currency: currency,
            errorCode: 0,
            roundId: roundId,
            bonusAmount: 0, // Assuming no bonus for a deposit
            errorDescription: "OK"
        };
           

        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('Error processing deposit:', error);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

//this is debit
export const ezugiWithdraw = async (req, res) => {
    console.log(req.body, "ezugiWithdraw");

    const {
        uid, // User ID
        currency, // Currency (e.g., INR)
        debitAmount, // Amount to withdraw
        transactionId, // Provider transaction ID
        gameId, // Game ID
        betTypeID, // Action ID (or Bet type ID)
        token, // Session token (optional)
        platformId, // Platform ID
        seatId,
        operatorId,
        roundId,
        timestamp,
        tableId,
        serverId
    } = req.body;

    try {


        let [userRows] = await connection.query('SELECT * FROM users WHERE ezugiLaunchToken = ?', [token]);

        // Check if user exists 
        if (!userRows.length) {
            console.log("Token expired or invalid");
            return res.status(200).json({

                    operatorId: operatorId, // Static operator ID
                    errorCode: 6, // Token not found
                    errorDescription: "Token not found", // Success message
                    timestamp: +new Date, // Current timestamp in milliseconds 
                    currency: currency,
                    roundId: roundId,
                    uid: uid,
                    token: token ,
                    balance: 0.0,
                    transactionId: transactionId,

            });
        }

         [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [uid]);

        if (!userRows.length) {
            return res.status(200).json({
                operatorId: operatorId,
                uid: uid,
                token: token,
                balance: 0.0,
                transactionId: transactionId,
                currency: currency,
                errorCode: 7,
                roundId: roundId,
                errorDescription: "User not found",
                timestamp: +new Date
            });
        }

        const [existingTransaction] = await connection.query('SELECT * FROM ezugitransaction WHERE provider_tx_id = ?', [transactionId]);


        if (existingTransaction.length) {
            return res.status(200).json({
                operatorId: operatorId,
                uid: uid,
                nickName: userRows[0].name_user,
                token: token,
                balance: Number(parseFloat(userRows[0].money).toFixed(2)), // Use the original userRows[0].money,
                transactionId: transactionId,
                currency: currency,
                errorCode: 0,
                roundId: roundId,
                errorDescription: "Transaction has already processed",
                timestamp: +new Date
            });
        }

        // Find the user in the database using the provided user ID (uid)
        

        // Check if user exists
       

        const user = userRows[0];
        const old_balance = Number(user.money);

        // Check if user has sufficient funds
        if (old_balance < debitAmount) {
            return res.status(200).json({
                operatorId: operatorId,
                uid: uid,
                nickName: user.name_user,
                token: token,
                balance: Number(parseFloat(old_balance).toFixed(2)), // Use the original old_balance,
                transactionId: transactionId,
                currency: currency,
                errorCode: 3,
                roundId: roundId,
                errorDescription: "Insufficient funds",
                timestamp: +new Date
            });
        }

        // Calculate the new balance after the withdrawal
        const new_balance = old_balance - debitAmount;

        // Update the user's balance in the database
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [new_balance, uid]);

        // Generate a unique operator transaction ID
        const operator_tx_id = transactionId;

        // Record the withdrawal transaction in the database
        await connection.query('INSERT INTO ezugitransaction (id_user, type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            uid, 1, user.phone, user.name_user, "ezugi", transactionId, operator_tx_id, old_balance, new_balance, currency, debitAmount, gameId, "withdraw", betTypeID, token
        ]);

        // Create the success response
        const successResponse = {
                uid,
                operatorId: operatorId,
                nickName: user.name_user,
                token,
                balance: Number(parseFloat(new_balance).toFixed(2)), // Use the updated new_balance,
                transactionId: transactionId,
                currency,
                timestamp: +new Date,
                errorCode: 0,
                roundId: roundId,
                bonusAmount: 0,
                errorDescription: "ok",              
        };

        console.log("Success Response:", successResponse);
        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};


export const ezugiRollback = async (req, res) => {
    console.log(req.body, "ezugiRollback");

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
        timestamp
    } = req.body;

    try {
        // Check if the transaction ID (rollback_provider_tx_id) exists
        const [existingTransaction] = await connection.query('SELECT * FROM ezugitransaction WHERE provider_tx_id = ?', [transactionId]);

        console.log(existingTransaction[0])

        const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [uid]);

        if (!existingTransaction.length) {
            console.log("Transaction not found");
            return res.status(200).json({
                operatorId: operatorId,
                roundId: roundId,
                uid: uid,
                token: token,
                balance: Number(parseFloat(userRows[0].money).toFixed(2)),
                transactionId: transactionId,
                currency: currency,
                errorCode: 9,
                errorDescription: "Transaction not found",
                timestamp: +new Date

            })
        }

        const transaction = existingTransaction[0];
        const old_balance = Number(transaction.new_balance);
        const new_balance = old_balance + Number(rollbackAmount); // Rollback the amount

        console.log("Rollback - old_balance:", old_balance, "new_balance:", new_balance);


        if (!userRows.length) {
            console.log("User not found");
            return res.status(200).json({
                operatorId: operatorId,
                roundId: roundId,
                uid: uid,
                token: token,
                balance: Number(parseFloat(userRows[0].money).toFixed(2)),
                transactionId: transactionId,
                currency: currency,
                errorCode: 9,
                errorDescription: "User not found",
                timestamp: +new Date
            });
        }

        const user = userRows[0];

        // Update the user's balance
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [new_balance, transaction.id_user]);

        const [duplicateTransaction] = await connection.query('SELECT * FROM ezugitransaction WHERE provider_tx_id = ?', [transactionId]);

        if (duplicateTransaction.length) {
            const duplicateResponse = {
            operatorId: operatorId,
            roundId: roundId,
            uid: uid,
            token: token,
            balance: Number(parseFloat(userRows[0].money).toFixed(2)),
            transactionId: transactionId,
            currency: currency,
            errorCode: 9,
            errorDescription: "Transaction already processed",
            timestamp: +new Date


            };
            return res.status(200).json(duplicateResponse);
        }
      

        // Record the rollback transaction in the database
        await connection.query('INSERT INTO ezugitransaction (id_user, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            transaction.id_user, user.phone, user.name_user, "ezugi", transactionId, transactionId, old_balance, new_balance, transaction.currency, rollbackAmount, gameId, "rollback", betTypeID, token, 2 // type 2 for rollback
        ]);

        // Success response
        const successResponse = {
            errorCode: 0,
            errorDescription: "ok",
            timestamp: +new Date,
            operatorId: operatorId,
            roundId: roundId,
            uid: uid,
            token: token,
            balance: Number(parseFloat(new_balance).toFixed(2)), // Use the updated new_balance,
            transactionId: transactionId,
            currency: currency
        };

        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('Error processing rollback:', error);
        return res.status(200).json({
            errorCode: 500,
            message: "Internal error",
        });
    }
};


const ezugiGameController = {
    ezugiLaunchGame,
    ezugiAuth,
    ezugiDeposit,
    ezugiWithdraw,
    ezugiRollback
};

export default ezugiGameController;