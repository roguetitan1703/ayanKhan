import * as inoutService from '../services/inoutService.js';
import connection from '../config/connectDB.js';

export const handleCallback = async (req, res) => {
    const { action, token, data } = req.body;

    try {
        let result;
        switch (action) {
            case 'init':
                result = await inoutService.handleInit(token, data);
                break;
            case 'bet':
                result = await inoutService.handleBet(data);
                break;
            case 'withdraw':
                result = await inoutService.handleWithdraw(data);
                break;
            case 'rollback':
                result = await inoutService.handleRollback(data);
                break;
            default:
                // As per docs, any other HTTP code is an error, but we should return valid error structure.
                return res.status(200).json({ code: 'UNKNOWN_ERROR', message: 'Invalid action specified' });
        }
        // Always include operator in the response if present in data
        if (data && data.operator && !result.operator) {
            result.operator = data.operator;
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error(`Error processing action "${action}":`, error.message);
        // Respond with HTTP 200 but an error code in the body, as per provider docs.
        return res.status(200).json({ code: error.code || 'UNKNOWN_ERROR', message: error.message });
    }
};

export const generateLaunchUrl = async (req, res) => {
    try {
        // Get the actual user's auth token from cookies
        const authToken = req.cookies.auth;
        
        if (!authToken) {
            return res.status(401).json({ 
                success: false, 
                message: "User not authenticated. Please login first." 
            });
        }

        // Get user data from database using the auth token
        const [users] = await connection.query(
            "SELECT `id_user`, `phone`, `money`, `token` FROM users WHERE `token` = ?",
            [authToken]
        );

        if (!users || users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid authentication token. Please login again." 
            });
        }

        const user = users[0];
        const gameMode = req.query.gameMode || 'plinko';

        // Use the actual user's token for authentication
        const params = new URLSearchParams({
            gameMode: gameMode,
            operatorId: process.env.INOUT_OPERATOR_ID,
            authToken: user.token, // Use the actual user token from database
            currency: 'INR',
            lang: 'en',
            adaptive: 'true'
        });

        const launchUrl = `${process.env.INOUT_LAUNCH_URL}?${params.toString()}`;
        
        console.log(`In-Out Games launch URL generated for user ${user.id_user} (${user.phone}) with game mode: ${gameMode}`);
        
        return res.json({ 
            success: true, 
            url: launchUrl,
            user: {
                id: user.id_user,
                phone: user.phone,
                balance: user.money
            }
        });
    } catch (error) {
        console.error('Error generating In-Out Games launch URL:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error while generating game URL" 
        });
    }
}; 