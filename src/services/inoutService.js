import connection from '../config/connectDB.js';

// Custom Error class to pass specific codes to the controller
class APIError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

// Utility to validate required fields in data
function validateFields(obj, requiredFields) {
    for (const field of requiredFields) {
        if (obj[field] === undefined || obj[field] === null) {
            throw new APIError(`must have required property '${field}':`, 'CHECKS_FAIL');
        }
    }
}

export const handleInit = async (token, data = {}) => {
    // Validate required fields in data
    validateFields(data, ['operator', 'currency', 'gameMode']);
    if (!token) throw new APIError("AuthToken is missing", "INVALID_TOKEN");
    if (data.currency !== "INR") {
        throw new APIError("Unsupported currency", "CHECKS_FAIL");
    }
    const [users] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);
    if (users.length === 0) throw new APIError("User not found", "ACCOUNT_INVALID");
    const user = users[0];
    // Convert balance to provider format (multiply by 1000 like Spribe)
    const providerBalance = Number(user.money) * 1000;
    return {
        code: "OK",
        userId: String(user.id_user),
        nickname: user.name_user,
        balance: String(providerBalance),
        currency: "INR"
    };
};

export const handleBet = async (data) => {
    validateFields(data, ['user_id', 'amount', 'currency', 'transactionId', 'gameId', 'operator']);
    const { user_id, amount, currency, transactionId, gameId } = data;
    const betAmount = parseFloat(amount);
    if (betAmount <= 0) {
        throw new APIError("Invalid bet amount", "CHECKS_FAIL");
    }
    if (currency !== "INR") {
        throw new APIError("Unsupported currency", "CHECKS_FAIL");
    }
    const [users] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);
    if (users.length === 0) throw new APIError("User not found for bet", "ACCOUNT_INVALID");
    const user = users[0];
    const userBetAmount = betAmount / 1000;
    const userBalance = Number(user.money);
    if (userBalance < userBetAmount) throw new APIError("Insufficient funds", "INSUFFICIENT_FUNDS");
    const dbConnection = await connection.getConnection();
    try {
        await dbConnection.beginTransaction();
        // Use toFixed(8) to avoid floating point issues
        const newBalance = Number((userBalance - userBetAmount).toFixed(8));
        await dbConnection.query('UPDATE users SET money = ? WHERE id_user = ?', [newBalance, user_id]);
        await dbConnection.query(
            'INSERT INTO inout_transactions (user_id, action, amount, transaction_id, game_id, currency) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, 'bet', userBetAmount, transactionId, gameId, currency]
        );
        await dbConnection.commit();
        return { code: "OK", balance: String(newBalance * 1000) };
    } catch (error) {
        await dbConnection.rollback();
        throw error;
    } finally {
        dbConnection.release();
    }
};

const handleIdempotentTransaction = async (data, actionType, creditAmount) => {
    const { transactionId, user_id, gameId, debitId, currency } = data;
    if (creditAmount <= 0) {
        throw new APIError("Invalid amount", "CHECKS_FAIL");
    }
    const userCreditAmount = creditAmount / 1000;
    // Idempotency Check
    const [existing] = await connection.query('SELECT raw_response FROM inout_transactions WHERE transaction_id = ?', [transactionId]);
    if (existing.length > 0 && existing[0].raw_response) {
        const storedResponse = existing[0].raw_response;
        if (typeof storedResponse === 'object' && storedResponse !== null) {
            return storedResponse;
        } else if (typeof storedResponse === 'string') {
            try {
                return JSON.parse(storedResponse);
            } catch (e) {
                throw new APIError("Idempotent response parsing error", "UNKNOWN_ERROR");
            }
        } else {
            throw new APIError("Idempotent response format error", "UNKNOWN_ERROR");
        }
    }
    // For rollback, check if debitId exists and not already rolled back
    if (actionType === 'rollback') {
        validateFields(data, ['debitId']);
        const [debitTx] = await connection.query('SELECT * FROM inout_transactions WHERE transaction_id = ?', [debitId]);
        if (debitTx.length === 0) {
            throw new APIError("Original bet transaction not found for rollback", "CHECKS_FAIL");
        }
        // Check if already rolled back
        const [alreadyRolledBack] = await connection.query('SELECT * FROM inout_transactions WHERE debit_id = ?', [debitId]);
        if (alreadyRolledBack.length > 0) {
            // Already rolled back, return last response
            if (alreadyRolledBack[0].raw_response) {
                try {
                    return JSON.parse(alreadyRolledBack[0].raw_response);
                } catch (e) {
                    throw new APIError("Idempotent rollback response parsing error", "UNKNOWN_ERROR");
                }
            }
        }
    }
    // For withdraw, check if debitId exists (for idempotency)
    if (actionType === 'withdraw') {
        validateFields(data, ['debitId']);
        const [debitTx] = await connection.query('SELECT * FROM inout_transactions WHERE transaction_id = ?', [debitId]);
        if (debitTx.length === 0) {
            throw new APIError("Original bet transaction not found for withdraw", "CHECKS_FAIL");
        }
    }
    const dbConnection = await connection.getConnection();
    try {
        await dbConnection.beginTransaction();
        // Use toFixed(8) to avoid floating point issues
        await dbConnection.query('UPDATE users SET money = money + ? WHERE id_user = ?', [Number(userCreditAmount.toFixed(8)), user_id]);
        const [users] = await dbConnection.query('SELECT money FROM users WHERE id_user = ?', [user_id]);
        const newBalance = users[0].money;
        const response = { code: "OK", balance: String(newBalance * 1000) };
        await dbConnection.query(
            'INSERT INTO inout_transactions (user_id, action, amount, transaction_id, game_id, currency, debit_id, raw_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, actionType, userCreditAmount, transactionId, gameId, currency, debitId, JSON.stringify(response)]
        );
        await dbConnection.commit();
        return response;
    } catch (error) {
        await dbConnection.rollback();
        throw error;
    } finally {
        dbConnection.release();
    }
};

export const handleWithdraw = async (data) => {
    validateFields(data, ['amount', 'coefficient', 'debitId', 'user_id', 'currency', 'transactionId', 'gameId', 'operator']);
    if (data.currency !== "INR") {
        throw new APIError("Unsupported currency", "CHECKS_FAIL");
    }
    // Win amount = amount * coefficient
    const winAmount = parseFloat(data.amount) * parseFloat(data.coefficient);
    return handleIdempotentTransaction(data, 'withdraw', winAmount);
};

export const handleRollback = async (data) => {
    validateFields(data, ['amount', 'debitId', 'user_id', 'currency', 'transactionId', 'gameId', 'operator']);
    if (data.currency !== "INR") {
        throw new APIError("Unsupported currency", "CHECKS_FAIL");
    }
    const refundAmount = parseFloat(data.amount);
    return handleIdempotentTransaction(data, 'rollback', refundAmount);
}; 