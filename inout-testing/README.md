# In-Out Games Integration Testing Suite

This testing suite mimics the functionality of the In-Out Games team's tester and produces similar output to help you test your integration internally before submitting it to them.

## Features

- ✅ **Comprehensive Test Scenarios**: Tests all the scenarios from the original In-Out Games test results
- ✅ **Signature Generation**: Properly generates HMAC-SHA256 signatures for requests
- ✅ **Detailed Reporting**: Provides detailed test reports with pass/fail status
- ✅ **Flexible Testing**: Run all tests, single scenarios, or quick tests
- ✅ **Real-time Logging**: Shows request/response details for debugging

## Installation

1. Navigate to the testing directory:
```bash
cd inout-testing
```

2. Install dependencies:
```bash
npm install
```

## Configuration

The testing suite uses the following configuration (already set up):

```javascript
const CONFIG = {
    OPERATOR_ID: 'a30c0bc1-d0bd-4257-b662-a840dff37321',
    SECRET_KEY: '08C5AF03B9473F5F3200BB09011D78B864E6CC97DC3A1FD565B0D92802DD2E241402B29C146CC5B13EE3D962150E9CDA0260DA08CA0905E4E16542A847B6555B',
    WEBHOOK_URL: 'http://localhost:3000/api/inout/callback',
    AUTH_TOKEN: '222c03e18eabc4372f8e220f7828197c',
    GAME_MODE: 'plinko',
    CURRENCY: 'INR'
};
```

**Important**: Make sure your webhook endpoint is running at `http://localhost:3000/api/inout/callback` or update the `WEBHOOK_URL` in the configuration.

## Usage

### 1. Quick Test (Basic Functionality)
Test the basic integration flow:
```bash
npm run test:quick
```

### 2. Single Scenario Test
Test a specific scenario:
```bash
npm run test:single "Standard bet and credit"
```

Available scenarios:
- Standard bet and credit
- Standard bet and double refund
- Incorrect bet currency
- Standard initialization
- Overestimated bet
- Non-existent rollback
- Standard bet and double credit
- Incorrect signature key
- Standard bet and refund

### 3. Full Test Suite
Run all test scenarios:
```bash
npm run test
```

## Test Scenarios

The testing suite includes all the scenarios from the original In-Out Games test results:

1. **Standard bet and credit** - Basic betting and winning flow
2. **Standard bet and double refund** - Betting and refunding flow
3. **Incorrect bet currency** - Error handling for wrong currency
4. **Standard initialization** - Session initialization testing
5. **Overestimated bet** - Insufficient funds handling
6. **Non-existent rollback** - Error handling for invalid rollback
7. **Standard bet and double credit** - Idempotency testing
8. **Incorrect signature key** - Security testing
9. **Standard bet and refund** - Complete betting and refunding flow

## Expected Response Format

Your webhook endpoint should return responses in this format:

### Success Responses
```json
{
  "code": "OK",
  "userId": "9828591",
  "nickname": "Member38992",
  "balance": "1.00",
  "currency": "INR",
  "operator": "a30c0bc1-d0bd-4257-b662-a840dff37321"
}
```

### Error Responses
```json
{
  "code": "CHECKS_FAIL",
  "message": "Error description",
  "operator": "a30c0bc1-d0bd-4257-b662-a840dff37321",
  "balance": "1.00"
}
```

## Signature Verification

The testing suite generates proper HMAC-SHA256 signatures for each request. Your webhook endpoint should verify these signatures using the same secret key.

## Troubleshooting

### Common Issues

1. **Connection Refused**: Make sure your webhook server is running
2. **Invalid Signature**: Check that your signature verification logic matches the testing suite
3. **Missing Fields**: Ensure your responses include all required fields
4. **Wrong Response Format**: Verify your response structure matches the expected format

### Debug Mode

The testing suite provides detailed logging for each request and response. Check the console output for:
- Request body and headers
- Response status and data
- Error messages
- Test results

## Integration with Your Backend

Make sure your backend:

1. **Handles all webhook actions**: `init`, `bet`, `withdraw`, `rollback`
2. **Validates signatures**: Verify the `X-REQUEST-SIGN` header
3. **Returns proper responses**: Use the expected response format
4. **Handles errors gracefully**: Return appropriate error codes and messages
5. **Maintains data consistency**: Ensure balance updates are atomic

## Example Output

```
🚀 Starting In-Out Games Integration Tests
📡 Webhook URL: http://localhost:3000/api/inout/callback
🎮 Game Mode: plinko
💰 Currency: INR
🏢 Operator ID: a30c0bc1-d0bd-4257-b662-a840dff37321

============================================================
🧪 Running Scenario: Standard bet and credit
============================================================

📋 Step: Session initialization
🔧 Action: init
[INIT] Making request to: http://localhost:3000/api/inout/callback
Request body: {
  "action": "init",
  "token": "222c03e18eabc4372f8e220f7828197c",
  "data": {
    "gameMode": "plinko",
    "operator": "a30c0bc1-d0bd-4257-b662-a840dff37321",
    "currency": "INR"
  }
}
Signature: 2f2c5475b946374b83e787e6004e38d372b37adc8d700ddaaa246b2ca412147b
Response status: 200
Response data: {
  "code": "OK",
  "userId": "9828591",
  "nickname": "Member38992",
  "balance": "1.00",
  "currency": "INR",
  "operator": "a30c0bc1-d0bd-4257-b662-a840dff37321"
}
Duration: 426ms
✅ Session initialized - User: 9828591, Balance: 1.00
```

## Support

If you encounter issues with the testing suite, check:
1. Your webhook endpoint is accessible
2. Your response format matches the expected structure
3. Your signature verification is working correctly
4. Your database transactions are atomic

The testing suite is designed to help you identify and fix integration issues before submitting to In-Out Games for official testing. 