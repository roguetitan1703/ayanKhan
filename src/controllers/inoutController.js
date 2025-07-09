import * as inoutService from '../services/inoutService.js';
import connection from '../config/connectDB.js';

export const handleCallback = async (req, res) => {
    const { action, token, data } = req.body;

    try {
        let result;
        switch (action) {
            case 'init':
                result = await inoutService.handleInit(token);
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
        return res.status(200).json(result);
    } catch (error) {
        console.error(`Error processing action "${action}":`, error.message);
        // Respond with HTTP 200 but an error code in the body, as per provider docs.
        return res.status(200).json({ code: error.code || 'UNKNOWN_ERROR', message: error.message });
    }
};

export const generateLaunchUrl = async (req, res) => {
    // This is a placeholder for getting user's auth token.
    // In a real app, you would get this from the user's session.
    const userToken = "3ab4125a85ce5c1b60523b89b9e21232d53f6160af5e98859e406c9baa425833"; // Using test token
    const gameMode = req.query.gameMode || 'plinko';

    const params = new URLSearchParams({
        gameMode: gameMode,
        operatorId: process.env.INOUT_OPERATOR_ID,
        authToken: userToken,
        currency: 'INR',
        lang: 'en',
        adaptive: 'true'
    });

    const launchUrl = `${process.env.INOUT_LAUNCH_URL}?${params.toString()}`;
    
    return res.json({ success: true, url: launchUrl });
}; 