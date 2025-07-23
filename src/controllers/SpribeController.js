import axios from 'axios';
import connection from "../config/connectDB.js";
import crypto from 'crypto';

const SECRET_TOKEN = '8VcEBp3iD3pSmPs7cvzaMNzFNmTjDSpC';
const OPERATOR_KEY = '75clubgames';
const API_URL = "https://dev-test.spribe.io/games/launch"
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

export const spribeLaunchGame = async (req, res) => {
    const userToken = req.userToken;
    const { gameName } = req.body;
    const game = gameName;

    console.log('[SPRIBE][LAUNCH] Incoming:', { userToken, gameName });

    try {
        const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [userToken]);
        if (!userRows.length) {
            console.error(`[SPRIBE][LAUNCH][ERROR] Token expired or invalid: ${userToken}`);
            return res.status(404).json({
                errorCode: 4,
                message: 'Token expired or invalid',
            });
        }
        const playerId = userRows[0].phone;
        const userId = userRows[0].id_user;
        const timestamp = Date.now();
        const token = generateToken(playerId, timestamp);
        const hashSignature = generateHashSignature(token, timestamp);
        await connection.query('UPDATE users SET spribeLaunchToken = ? WHERE phone = ?', [token, playerId]);
        console.log('[SPRIBE][LAUNCH] Token generated:', token);
        const launchUrl = `${API_URL}/${game}?user=${userId}&token=${token}&currency=${currency}&lang=EN&return_url=${return_url}&operator=${OPERATOR_KEY}`;
        console.log('[SPRIBE][LAUNCH] Launch URL:', launchUrl);
        return res.json({ Data: launchUrl });
    } catch (error) {
        console.error('[SPRIBE][LAUNCH][EXCEPTION]', error, { userToken, gameName });
        throw error;
    }
};

export const spribeInfo = async (req, res) => {
    const { session_token, currency, user_id } = req.body;
    console.log('[SPRIBE][INFO] Incoming:', req.body);
    try {
        const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);
        if (!userRows.length) {
            console.error(`[SPRIBE][INFO][ERROR] User not found for id_user: ${user_id}`);
            return res.status(200).json({
                code: 401,
                message: 'User token is invalid',
            });
        }
        const user = userRows[0];
        const response = {
            code: 200,
            message: 'ok',
            data: {
                user_id: user.id_user,
                username: user.name_user,
                balance: Number(user.money) * 1000,
                currency: currency
            }
        };
        console.log('[SPRIBE][INFO] Response:', response);
        return res.json(response);
    } catch (error) {
        console.error('[SPRIBE][INFO][EXCEPTION]', error, req.body);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

export const spribeAuth = async (req, res) => {
    const { user_token, session_token, platform, currency } = req.body;
    console.log('[SPRIBE][AUTH] Incoming:', req.body);
    try {
        const [userRows] = await connection.query('SELECT * FROM users WHERE spribeLaunchToken = ?', [user_token]);
        if (!userRows.length) {
            console.error(`[SPRIBE][AUTH][ERROR] Invalid or expired token: ${user_token}`);
            return res.status(200).json({
                code: 401,
                message: 'Token expired or invalid',
            });
        }
        const user = userRows[0];
        const response = {
            code: 200,
            message: 'Success',
            data: {
                user_id: user.id_user,
                username: user.name_user,
                balance: Number(user.money) * 1000,
                currency: currency
            }
        };
        console.log('[SPRIBE][AUTH] Response:', response);
        return res.json(response);
    } catch (error) {
        console.error('[SPRIBE][AUTH][EXCEPTION]', error, req.body);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

export const spribeDeposit = async (req, res) => {
    console.log('[SPRIBE][DEPOSIT] Incoming:', req.body);
    const {
        user_id, currency, amount, provider, provider_tx_id, game, action, action_id, session_token, platform, withdraw_provider_tx_id
    } = req.body;
    try {
        const [existingTransaction] = await connection.query('SELECT * FROM spribetransaction WHERE provider_tx_id = ?', [provider_tx_id]);
        if (existingTransaction.length) {
            console.warn(`[SPRIBE][DEPOSIT][DUPLICATE] provider_tx_id: ${provider_tx_id}`);
            const duplicateResponse = {
                code: 409,
                message: 'Duplicate transaction',
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
        const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);
        if (!userRows.length) {
            console.error(`[SPRIBE][DEPOSIT][ERROR] User not found for id_user: ${user_id}`);
            return res.status(401).json({
                code: 401,
                message: 'User token is invalid',
            });
        }
        const user = userRows[0];
        const old_balance = Number(user.money * 1000);
        if (amount > old_balance) {
            console.error(`[SPRIBE][DEPOSIT][ERROR] Insufficient funds for user_id: ${user_id}, required: ${amount}, available: ${old_balance}`);
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
        let new_balance = Number(old_balance) - Number(amount);
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [(new_balance / 1000), user_id]);
        const operator_tx_id = `OP_TX_${Date.now()}`;
        await connection.query('INSERT INTO spribetransaction (id_user,type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, deposit_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)', [
            user_id, 0, user.phone, user.name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, amount, game, action, action_id, session_token
        ]);
        const successResponse = {
            code: 200,
            message: 'Success',
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
        console.log('[SPRIBE][DEPOSIT] Success:', successResponse);
        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('[SPRIBE][DEPOSIT][EXCEPTION]', error, req.body);
        return res.status(500).json({
            code: 500,
            message: 'Internal error',
            detail: error.message
        });
    }
};

export const spribeWithdraw = async (req, res) => {
    console.log('[SPRIBE][WITHDRAW] Incoming:', req.body);
    const {
        user_id, currency, amount, provider, provider_tx_id, game, action, action_id, session_token, platform
    } = req.body;
    try {
        const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);
        if (!userRows.length) {
            console.error(`[SPRIBE][WITHDRAW][ERROR] User not found for id_user: ${user_id}`);
            return res.status(200).json({
                code: 401,
                message: 'User token is invalid',
            });
        }
        const user = userRows[0];
        const old_balance = Number(user.money * 1000);
        if (old_balance < amount) {
            console.error(`[SPRIBE][WITHDRAW][ERROR] Insufficient funds for user_id: ${user_id}, required: ${amount}, available: ${old_balance}`);
            return res.status(200).json({
                code: 402,
                message: 'Insufficient funds',
            });
        }
        const new_balance = Number(old_balance) + Number(amount);
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [(new_balance / 1000), user_id]);
        const operator_tx_id = `OP_TX_${Date.now()}`;
        await connection.query('INSERT INTO spribetransaction (id_user,type, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)', [
            user_id, 1, user.phone, user.name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, amount, game, action, action_id, session_token
        ]);
        const successResponse = {
            code: 200,
            message: 'ok',
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
        console.log('[SPRIBE][WITHDRAW] Success:', successResponse);
        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('[SPRIBE][WITHDRAW][EXCEPTION]', error, req.body);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
        });
    }
};

export const spribeRollback = async (req, res) => {
    console.log('[SPRIBE][ROLLBACK] Incoming:', req.body);
    const {
        user_id, amount, provider, rollback_provider_tx_id, provider_tx_id, game, session_token, action, action_id
    } = req.body;
    try {
        const [existingTransaction] = await connection.query('SELECT * FROM spribetransaction WHERE provider_tx_id = ?', [rollback_provider_tx_id]);
        if (!existingTransaction.length) {
            console.error(`[SPRIBE][ROLLBACK][ERROR] Transaction not found for rollback_provider_tx_id: ${rollback_provider_tx_id}`);
            return res.status(200).json({
                code: 408,
                message: 'Transaction not found',
            });
        }
        const transaction = existingTransaction[0];
        const user_id = transaction.id_user;
        const [userRows] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);
        if (!userRows.length) {
            console.error(`[SPRIBE][ROLLBACK][ERROR] User not found for id_user: ${user_id}`);
            return res.status(200).json({
                code: 401,
                message: 'User token is invalid',
            });
        }
        const user = userRows[0];
        const current_balance = Number(user.money * 1000);
        const rollback_amount = Number(amount);
        const new_balance = current_balance + rollback_amount;
        await connection.query('UPDATE users SET money = ? WHERE id_user = ?', [(new_balance / 1000), user_id]);
        const [duplicateTransaction] = await connection.query('SELECT * FROM spribetransaction WHERE provider_tx_id = ?', [provider_tx_id]);
        if (duplicateTransaction.length) {
            console.warn(`[SPRIBE][ROLLBACK][DUPLICATE] provider_tx_id: ${provider_tx_id}`);
            const duplicateResponse = {
                code: 409,
                message: 'Duplicate transaction',
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
        const operator_tx_id = `OP_TX_${Date.now()}`;
        await connection.query('INSERT INTO spribetransaction (id_user, phone, name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, currency, withdrawal_amount, game, action, action_id, session_token, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            user_id, user.phone, user.name_user, provider, provider_tx_id, operator_tx_id, old_balance, new_balance, transaction.currency, amount, game, action, action_id, session_token, 2
        ]);
        const successResponse = {
            code: 200,
            message: 'Success',
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
        console.log('[SPRIBE][ROLLBACK] Success:', successResponse);
        return res.status(200).json(successResponse);
    } catch (error) {
        console.error('[SPRIBE][ROLLBACK][EXCEPTION]', error, req.body);
        return res.status(200).json({
            code: 500,
            message: 'Internal error',
            detail: error.message
        });
    }
};

const spribeGameController = {
    spribeInfo,
    spribeLaunchGame,
    spribeAuth,
    spribeDeposit,
    spribeWithdraw,
    spribeRollback
};

export default spribeGameController;