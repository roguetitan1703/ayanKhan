import connection from '../config/connectDB.js';

// Custom Error class to pass specific codes to the controller
class APIError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

export const handleInit = async (token) => {
    if (!token) throw new APIError("AuthToken is missing", "INVALID_TOKEN");
    
    const [users] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);
    if (users.length === 0) throw new APIError("User not found", "ACCOUNT_INVALID");

    const user = users[0];
    return {
        code: "OK",
        userId: String(user.id_user),
        nickname: user.name_user,
        balance: String(user.money),
        currency: "INR" // Assuming INR for now, can be dynamic later
    };
};

export const handleBet = async (data) => {
    const { user_id, amount, currency, transactionId, gameId } = data;
    const betAmount = parseFloat(amount);

    // Input validation for amounts
    if (betAmount <= 0) {
        throw new APIError("Invalid bet amount", "CHECKS_FAIL");
    }

    // Currency validation
    if (currency !== "INR") {
        throw new APIError("Unsupported currency", "CHECKS_FAIL");
    }

    const [users] = await connection.query('SELECT * FROM users WHERE id_user = ?', [user_id]);
    if (users.length === 0) throw new APIError("User not found for bet", "ACCOUNT_INVALID");
    
    const user = users[0];
    if (user.money < betAmount) throw new APIError("Insufficient funds", "INSUFFICIENT_FUNDS");

    // Implement database transaction atomicity
    const dbConnection = await connection.getConnection();
    try {
        await dbConnection.beginTransaction();
        
        const newBalance = user.money - betAmount;
        await dbConnection.query('UPDATE users SET money = ? WHERE id_user = ?', [newBalance, user_id]);
        await dbConnection.query(
            'INSERT INTO inout_transactions (user_id, action, amount, transaction_id, game_id, currency) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, 'bet', betAmount, transactionId, gameId, currency]
        );
        
        await dbConnection.commit();
        return { code: "OK", balance: String(newBalance) };
    } catch (error) {
        await dbConnection.rollback();
        throw error;
    } finally {
        dbConnection.release();
    }
};

const handleIdempotentTransaction = async (data, actionType, creditAmount) => {
    const { transactionId, user_id, gameId, debitId, currency } = data;

    // Input validation for amounts
    if (creditAmount <= 0) {
        throw new APIError("Invalid amount", "CHECKS_FAIL");
    }

    // 1. Idempotency Check
    const [existing] = await connection.query('SELECT raw_response FROM inout_transactions WHERE transaction_id = ?', [transactionId]);
    if (existing.length > 0 && existing[0].raw_response) {
        const storedResponse = existing[0].raw_response;
        console.log('--- Idempotency Check ---');
        console.log(`Transaction ID: ${transactionId}`);
        console.log('Type of storedResponse:', typeof storedResponse);
        if (typeof storedResponse === 'object' && storedResponse !== null) {
            console.log('Stored response is already an object:', storedResponse);
            return storedResponse;
        } else if (typeof storedResponse === 'string') {
            try {
                console.log('Stored response is a string. Attempting JSON.parse...');
                const parsed = JSON.parse(storedResponse);
                console.log('Parsed stored response:', parsed);
                return parsed;
            } catch (e) {
                console.error('Failed to parse storedResponse string:', storedResponse);
                console.error('Parse error:', e);
                throw new APIError("Idempotent response parsing error", "UNKNOWN_ERROR");
            }
        } else {
            console.error('Unexpected storedResponse type:', typeof storedResponse, storedResponse);
            throw new APIError("Idempotent response format error", "UNKNOWN_ERROR");
        }
    }
    
    // 2. Perform Credit with database transaction atomicity
    const dbConnection = await connection.getConnection();
    try {
        await dbConnection.beginTransaction();
        
        await dbConnection.query('UPDATE users SET money = money + ? WHERE id_user = ?', [creditAmount, user_id]);
        
        // 3. Get new balance
        const [users] = await dbConnection.query('SELECT money FROM users WHERE id_user = ?', [user_id]);
        const newBalance = users[0].money;
        
        // 4. Create Response and Log
        const response = { code: "OK", balance: String(newBalance) };
        await dbConnection.query(
            'INSERT INTO inout_transactions (user_id, action, amount, transaction_id, game_id, currency, debit_id, raw_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, actionType, creditAmount, transactionId, gameId, currency, debitId, JSON.stringify(response)]
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
    const winAmount = parseFloat(data.result);
    return handleIdempotentTransaction(data, 'withdraw', winAmount);
};

export const handleRollback = async (data) => {
    const refundAmount = parseFloat(data.amount);
    return handleIdempotentTransaction(data, 'rollback', refundAmount);
}; 