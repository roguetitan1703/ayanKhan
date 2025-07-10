import connection from '../config/connectDB.js';

// Custom Error class to pass specific codes to the controller
class APIError extends Error {
    constructor(message, code, operator) {
        super(message);
        this.code = code;
        this.operator = operator;
    }
}

// Utility to validate required fields in data
function validateFields(obj, requiredFields, operator) {
    for (const field of requiredFields) {
        if (obj[field] === undefined || obj[field] === null) {
            throw new APIError(`must have required property '${field}':`, 'CHECKS_FAIL', operator);
        }
    }
}

// Helper to format response for each action
function formatResponse(action, data) {
    if (action === 'init') {
        // Only these fields for init
        return {
            code: data.code,
            userId: data.userId,
            nickname: data.nickname,
            balance: data.balance,
            currency: data.currency,
            operator: data.operator
        };
    } else if (action === 'bet' || action === 'withdraw' || action === 'rollback') {
        // Only these fields for bet/withdraw/rollback
        return {
            code: data.code,
            balance: data.balance,
            operator: data.operator
        };
    } else if (data.code && data.message) {
        // Error case
        const err = {
            code: data.code,
            message: data.message,
            operator: data.operator
        };
        if (data.balance !== undefined) err.balance = data.balance;
        return err;
    }
    return data;
}

// Helper to get user balance safely
async function getUserBalance(user_id) {
    try {
        const [users] = await connection.query('SELECT money FROM users WHERE id_user = ?', [user_id]);
        if (users.length > 0) {
            return Number(users[0].money).toFixed(2);
        }
    } catch (e) {}
    return null;
}

export const handleInit = async (token, data = {}) => {
    const operator = data.operator;
    try {
        console.log('[INOUT][INIT] Request:', { token, data });
        validateFields(data, ['operator', 'currency', 'gameMode'], operator);
        if (!token) throw new APIError("AuthToken is missing", "INVALID_TOKEN", operator);
        if (data.currency !== "INR") {
            throw new APIError("Unsupported currency", "CHECKS_FAIL", operator);
        }
        const [users] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);
        if (users.length === 0) throw new APIError("User not found", "ACCOUNT_INVALID", operator);
        const user = users[0];
        const providerBalance = Number(user.money).toFixed(2);
        console.log('[INOUT][INIT] User:', user.id_user, 'Balance:', providerBalance);
        return formatResponse('init', {
            code: "OK",
            userId: String(user.id_user),
            nickname: user.name_user,
            balance: providerBalance,
            currency: "INR",
            operator: operator
        });
    } catch (error) {
        console.error('[INOUT][INIT][ERROR]', error);
        let balance = null;
        if (data && data.user_id) {
            balance = await getUserBalance(data.user_id);
        }
        return formatResponse('init', { code: error.code || 'UNKNOWN_ERROR', message: error.message, operator, balance });
    }
};

export const handleBet = async (data) => {
    const operator = data.operator;
    try {
        console.log('[INOUT][BET] Request:', data);
        validateFields(data, ['user_id', 'amount', 'currency', 'transactionId', 'gameId', 'operator'], operator);
        const { user_id, amount, currency, transactionId, gameId } = data;
        const betAmount = parseFloat(amount);
        if (betAmount <= 0) {
            throw new APIError("Invalid bet amount", "CHECKS_FAIL", operator);
        }
        if (currency !== "INR") {
            throw new APIError("Unsupported currency", "CHECKS_FAIL", operator);
        }
        const [users] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);
        if (users.length === 0) throw new APIError("User not found for bet", "ACCOUNT_INVALID", operator);
        const user = users[0];
        const userBalance = Number(user.money);
        console.log('[INOUT][BET] User:', user_id, 'Balance before:', userBalance, 'Bet amount:', betAmount);
        if (userBalance < betAmount) throw new APIError("Insufficient funds", "INSUFFICIENT_FUNDS", operator);
        const dbConnection = await connection.getConnection();
        try {
            await dbConnection.beginTransaction();
            const newBalance = (userBalance - betAmount).toFixed(2);
            await dbConnection.query('UPDATE users SET money = ? WHERE id_user = ?', [newBalance, user_id]);
            await dbConnection.query(
                'INSERT INTO inout_transactions (user_id, action, amount, transaction_id, game_id, currency, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [user_id, 'bet', betAmount.toFixed(2), transactionId, gameId, currency, operator]
            );
            await dbConnection.commit();
            console.log('[INOUT][BET] User:', user_id, 'Balance after:', newBalance);
            return formatResponse('bet', { code: "OK", balance: newBalance, operator });
        } catch (error) {
            await dbConnection.rollback();
            throw error;
        } finally {
            dbConnection.release();
        }
    } catch (error) {
        console.error('[INOUT][BET][ERROR]', error);
        let balance = null;
        if (data && data.user_id) {
            balance = await getUserBalance(data.user_id);
        }
        return formatResponse('bet', { code: error.code || 'UNKNOWN_ERROR', message: error.message, operator, balance });
    }
};

const handleIdempotentTransaction = async (data, actionType, creditAmount, newBalanceOverride) => {
    const { transactionId, user_id, gameId, debitId, currency, operator } = data;
    try {
        console.log(`[INOUT][${actionType.toUpperCase()}] Request:`, data);
        if (creditAmount <= 0) {
            throw new APIError("Invalid amount", "CHECKS_FAIL", operator);
        }
        // Idempotency Check
        const [existing] = await connection.query('SELECT raw_response FROM inout_transactions WHERE transaction_id = ?', [transactionId]);
        if (existing.length > 0 && existing[0].raw_response) {
            let storedResponse = existing[0].raw_response;
            if (typeof storedResponse === 'string') {
                try { storedResponse = JSON.parse(storedResponse); } catch (e) { storedResponse = null; }
            }
            console.log(`[INOUT][${actionType.toUpperCase()}] Idempotent response returned.`);
            return formatResponse(actionType, storedResponse);
        }
        if (actionType === 'rollback') {
            validateFields(data, ['debitId'], operator);
            const [debitTx] = await connection.query('SELECT * FROM inout_transactions WHERE transaction_id = ?', [debitId]);
            if (debitTx.length === 0) {
                throw new APIError("Original bet transaction not found for rollback", "CHECKS_FAIL", operator);
            }
            // Prevent rollback if withdraw already processed for this bet
            const [withdrawTx] = await connection.query(
                'SELECT * FROM inout_transactions WHERE debit_id = ? AND action = ?', [debitId, 'withdraw']
            );
            if (withdrawTx.length > 0) {
                console.log(`[INOUT][ROLLBACK] Cannot rollback: withdraw already processed for bet ${debitId}`);
                throw new APIError('Cannot rollback: withdraw already processed for this bet', 'CHECKS_FAIL', operator);
            }
            // Check if already rolled back
            const [alreadyRolledBack] = await connection.query('SELECT * FROM inout_transactions WHERE debit_id = ?', [debitId]);
            if (alreadyRolledBack.length > 0) {
                let storedResponse = alreadyRolledBack[0].raw_response;
                if (typeof storedResponse === 'string') {
                    try { storedResponse = JSON.parse(storedResponse); } catch (e) { storedResponse = null; }
                }
                console.log(`[INOUT][ROLLBACK] Already rolled back, returning stored response.`);
                return formatResponse(actionType, storedResponse);
            }
        }
        if (actionType === 'withdraw') {
            validateFields(data, ['debitId'], operator);
            const [debitTx] = await connection.query('SELECT * FROM inout_transactions WHERE transaction_id = ?', [debitId]);
            if (debitTx.length === 0) {
                throw new APIError("Original bet transaction not found for withdraw", "CHECKS_FAIL", operator);
            }
        }
        const dbConnection = await connection.getConnection();
        try {
            await dbConnection.beginTransaction();
            let newBalance;
            const [users] = await dbConnection.query('SELECT money FROM users WHERE id_user = ?', [user_id]);
            const userBalance = Number(users[0].money);
            if (newBalanceOverride !== undefined) {
                newBalance = Number(newBalanceOverride).toFixed(2);
                console.log(`[INOUT][${actionType.toUpperCase()}] User:`, user_id, 'Balance before:', userBalance, 'Set to:', newBalance);
                await dbConnection.query('UPDATE users SET money = ? WHERE id_user = ?', [newBalance, user_id]);
            } else {
                // For rollback, add amount back
                newBalance = (userBalance + creditAmount).toFixed(2);
                console.log(`[INOUT][ROLLBACK] User:`, user_id, 'Balance before:', userBalance, 'Refund amount:', creditAmount, 'After:', newBalance);
                await dbConnection.query('UPDATE users SET money = ? WHERE id_user = ?', [newBalance, user_id]);
            }
            const response = { code: "OK", balance: newBalance, operator };
            await dbConnection.query(
                'INSERT INTO inout_transactions (user_id, action, amount, transaction_id, game_id, currency, debit_id, operator, raw_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [user_id, actionType, creditAmount.toFixed(2), transactionId, gameId, currency, debitId, operator, JSON.stringify(response)]
            );
            await dbConnection.commit();
            console.log(`[INOUT][${actionType.toUpperCase()}] User:`, user_id, 'Balance after:', newBalance);
            return formatResponse(actionType, response);
        } catch (error) {
            await dbConnection.rollback();
            throw error;
        } finally {
            dbConnection.release();
        }
    } catch (error) {
        console.error(`[INOUT][${actionType.toUpperCase()}][ERROR]`, error);
        let balance = null;
        if (data && data.user_id) {
            balance = await getUserBalance(data.user_id);
        }
        return formatResponse(actionType, { code: error.code || 'UNKNOWN_ERROR', message: error.message, operator, balance });
    }
};

export const handleWithdraw = async (data) => {
    const operator = data.operator;
    try {
        console.log('[INOUT][WITHDRAW] Request:', data);
        validateFields(data, ['amount', 'result', 'debitId', 'user_id', 'currency', 'transactionId', 'gameId', 'operator'], operator);
        if (data.currency !== "INR") {
            throw new APIError("Unsupported currency", "CHECKS_FAIL", operator);
        }
        // Set balance to result (not add)
        const newBalance = parseFloat(data.result).toFixed(2);
        return await handleIdempotentTransaction(data, 'withdraw', parseFloat(data.amount), newBalance);
    } catch (error) {
        console.error('[INOUT][WITHDRAW][ERROR]', error);
        let balance = null;
        if (data && data.user_id) {
            balance = await getUserBalance(data.user_id);
        }
        return formatResponse('withdraw', { code: error.code || 'UNKNOWN_ERROR', message: error.message, operator, balance });
    }
};

export const handleRollback = async (data) => {
    const operator = data.operator;
    try {
        console.log('[INOUT][ROLLBACK] Request:', data);
        validateFields(data, ['amount', 'debitId', 'user_id', 'currency', 'transactionId', 'gameId', 'operator'], operator);
        if (data.currency !== "INR") {
            throw new APIError("Unsupported currency", "CHECKS_FAIL", operator);
        }
        const refundAmount = parseFloat(data.amount);
        return await handleIdempotentTransaction(data, 'rollback', refundAmount);
    } catch (error) {
        console.error('[INOUT][ROLLBACK][ERROR]', error);
        let balance = null;
        if (data && data.user_id) {
            balance = await getUserBalance(data.user_id);
        }
        return formatResponse('rollback', { code: error.code || 'UNKNOWN_ERROR', message: error.message, operator, balance });
    }
};

export { formatResponse }; 