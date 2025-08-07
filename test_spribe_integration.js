import crypto from 'crypto';

// Updated Spribe credentials
const SECRET_TOKEN = 'P8cs7H7swSnr1WwDRNQOBCPQjCLvkOlQ';
const OPERATOR_KEY = 'reddybook75new';

// Test function to generate signature like Spribe would
function generateSpribeSignature(timestamp, path, body = '') {
    const stringToSign = `${timestamp}${path}${body}`;
    console.log('String to sign:', stringToSign);
    
    const signature = crypto.createHmac('sha256', SECRET_TOKEN)
        .update(stringToSign)
        .digest('hex');
    
    return signature;
}

// Test the auth endpoint
function testAuthEndpoint() {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v1/callback/spribe/auth';
    const body = JSON.stringify({
        user_token: 'test_token_123',
        currency: 'INR'
    });
    
    const signature = generateSpribeSignature(timestamp, path, body);
    
    console.log('\n=== TESTING AUTH ENDPOINT ===');
    console.log('URL:', 'https://75club.games' + path);
    console.log('Headers:');
    console.log('  X-Spribe-Client-ID:', OPERATOR_KEY);
    console.log('  X-Spribe-Client-TS:', timestamp);
    console.log('  X-Spribe-Client-Signature:', signature);
    console.log('Body:', body);
    
    // Test with curl command
    console.log('\nCurl command:');
    console.log(`curl -X POST https://75club.games${path} \\
  -H "Content-Type: application/json" \\
  -H "X-Spribe-Client-ID: ${OPERATOR_KEY}" \\
  -H "X-Spribe-Client-TS: ${timestamp}" \\
  -H "X-Spribe-Client-Signature: ${signature}" \\
  -d '${body}'`);
}

// Test the info endpoint
function testInfoEndpoint() {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v1/callback/spribe/info';
    const body = JSON.stringify({
        user_id: 123,
        currency: 'INR'
    });
    
    const signature = generateSpribeSignature(timestamp, path, body);
    
    console.log('\n=== TESTING INFO ENDPOINT ===');
    console.log('URL:', 'https://75club.games' + path);
    console.log('Headers:');
    console.log('  X-Spribe-Client-ID:', OPERATOR_KEY);
    console.log('  X-Spribe-Client-TS:', timestamp);
    console.log('  X-Spribe-Client-Signature:', signature);
    console.log('Body:', body);
}

// Test the deposit endpoint
function testDepositEndpoint() {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v1/callback/spribe/deposit';
    const body = JSON.stringify({
        user_id: 123,
        amount: 1000,
        provider_tx_id: 'TX_' + Date.now(),
        currency: 'INR'
    });
    
    const signature = generateSpribeSignature(timestamp, path, body);
    
    console.log('\n=== TESTING DEPOSIT ENDPOINT ===');
    console.log('URL:', 'https://75club.games' + path);
    console.log('Headers:');
    console.log('  X-Spribe-Client-ID:', OPERATOR_KEY);
    console.log('  X-Spribe-Client-TS:', timestamp);
    console.log('  X-Spribe-Client-Signature:', signature);
    console.log('Body:', body);
}

// Test the withdraw endpoint
function testWithdrawEndpoint() {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v1/callback/spribe/withdraw';
    const body = JSON.stringify({
        user_id: 123,
        amount: 500,
        provider_tx_id: 'TX_' + Date.now(),
        currency: 'INR'
    });
    
    const signature = generateSpribeSignature(timestamp, path, body);
    
    console.log('\n=== TESTING WITHDRAW ENDPOINT ===');
    console.log('URL:', 'https://75club.games' + path);
    console.log('Headers:');
    console.log('  X-Spribe-Client-ID:', OPERATOR_KEY);
    console.log('  X-Spribe-Client-TS:', timestamp);
    console.log('  X-Spribe-Client-Signature:', signature);
    console.log('Body:', body);
}

// Run all tests
console.log('=== SPRIBE INTEGRATION TEST SCRIPT ===');
console.log('Updated Credentials:');
console.log('  Operator Key:', OPERATOR_KEY);
console.log('  Secret Token:', SECRET_TOKEN);
console.log('  Callback URL: https://75club.games/api/v1/callback/spribe');

testAuthEndpoint();
testInfoEndpoint();
testDepositEndpoint();
testWithdrawEndpoint();

console.log('\n=== TESTING INSTRUCTIONS ===');
console.log('1. Make sure your server is running');
console.log('2. Use the curl commands above to test each endpoint');
console.log('3. Check your server logs for the debug output');
console.log('4. Verify that the signature validation passes');
console.log('5. Test with real user tokens from your database'); 