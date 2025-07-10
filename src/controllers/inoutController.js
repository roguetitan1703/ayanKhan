import * as inoutService from '../services/inoutService.js';
import connection from '../config/connectDB.js';

// Use formatResponse from inoutService
const { formatResponse } = require('../services/inoutService');

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
                result = { code: 'CHECKS_FAIL', message: 'Unknown action', operator: data.operator };
        }
        // Format the response for the action
        const formatted = formatResponse(action, result);
        res.status(200).json({ data: formatted, status: 200 });
    } catch (err) {
        // Format error response
        const formatted = formatResponse(action, err);
        res.status(200).json({ data: formatted, status: 200 });
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