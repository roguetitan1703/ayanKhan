import crypto from 'crypto';

export const validateInoutSignature = (req, res, next) => {
    try {
        const providedSignature = req.headers['x-request-sign'];
        if (!providedSignature) {
            console.error("In-Out Security: Missing x-request-sign header.");
            return res.status(403).json({ code: 'CHECKS_FAIL', message: 'Missing signature' });
        }

        // We assume the raw body is available on req.rawBody
        // This requires a change in your main app entrypoint (e.g., server.js)
        const rawBody = req.rawBody;
        if (!rawBody) {
             console.error("In-Out Security: req.rawBody is not available. Ensure Express is configured correctly.");
             return res.status(500).json({ code: 'TEMPORARY_ERROR', message: 'Server configuration error.' });
        }

        const expectedSignature = crypto.createHmac('sha256', process.env.INOUT_SECRET_KEY)
                                      .update(rawBody)
                                      .digest('hex');

        if (providedSignature !== expectedSignature) {
            console.error("In-Out Security: Invalid signature.");
            return res.status(403).json({ code: 'CHECKS_FAIL', message: 'Invalid signature' });
        }

        next();
    } catch (error) {
        console.error("Error in signature validation middleware:", error);
        res.status(500).json({ code: 'UNKNOWN_ERROR', message: 'Internal Server Error' });
    }
}; 