// In-Out Games Provider-Matching Test Script
// This script mimics the real provider's test flow and order, using the launch URL method.
// Only the expected fields and flows are tested. No rollback after withdraw is attempted.

const axios = require('axios');
const crypto = require('crypto');

// ==== CONFIGURATION ====
const LAUNCH_URL = 'https://api.inout.games/api/launch?gameMode=plinko&operatorId=a30c0bc1-d0bd-4257-b662-a840dff37321&authToken=30a65962d274860af99269454e6f61a7&currency=INR&lang=en&adaptive=true';
const CALLBACK_URL = 'https://75club.games/api/callback/inout'; // Hosted backend URL
const INOUT_SECRET = process.env.INOUT_SECRET || '08C5AF03B9473F5F3200BB09011D78B864E6CC97DC3A1FD565B0D92802DD2E241402B29C146CC5B13EE3D962150E9CDA0260DA08CA0905E4E16542A847B6555B';
const OPERATOR = 'a30c0bc1-d0bd-4257-b662-a840dff37321';
const CURRENCY = 'INR';

function signBody(body) {
  const str = JSON.stringify(body);
  return crypto.createHmac('sha256', INOUT_SECRET).update(str).digest('hex');
}

async function postInout(action, data, token) {
  const body = { action, ...(token ? { token } : {}), data };
  const headers = { 'x-request-sign': signBody(body) };
  try {
    const res = await axios.post(CALLBACK_URL, body, { headers });
    return res;
  } catch (e) {
    if (e.response) return e.response;
    throw e;
  }
}

function checkFields(obj, expected) {
  return (
    Object.keys(obj).length === expected.length &&
    expected.every((k) => Object.prototype.hasOwnProperty.call(obj, k))
  );
}

function printResult(desc, pass, details) {
  if (pass) {
    console.log(`PASSED: ${desc}`);
  } else {
    console.log(`FAILED: ${desc}`);
    if (details) console.log('    Details:', details);
  }
}

(async () => {
  try {
    console.log('--- Starting In-Out Games Provider-Matching Test Script ---');
    // 1. Launch to get token
    const launchRes = await axios.get(LAUNCH_URL);
    const url = launchRes.request.res.responseUrl;
    console.log('Launch URL response:', url);
    const tokenMatch = url.match(/authToken=([a-f0-9]{32,})/i);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (!token) {
      console.error('Could not extract token from launch URL');
      process.exit(1);
    }
    console.log('Using token:', token);

    // 2. Session initialization
    let res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    console.log('Init response:', res.status, res.data);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === undefined ? res.data.data.code === 'OK' : res.data.code === 'OK');
    const userId = res.data.data ? res.data.data.userId : res.data.userId;
    const balance = parseFloat(res.data.data ? res.data.data.balance : res.data.balance);

    // 3. Standard bet and credit
    const betId = crypto.randomUUID();
    res = await postInout('bet', { operator: OPERATOR, currency: CURRENCY, amount: '1.00', user_id: userId, transactionId: betId, gameId: crypto.randomUUID() }, token);
    console.log('Bet response:', res.status, res.data);
    printResult('Bet returns 200', res.status === 200);
    printResult('Bet response fields', checkFields(res.data.data || res.data, ['code', 'balance', 'operator']), JSON.stringify(res.data));
    printResult('Bet code is OK', (res.data.data || res.data).code === 'OK', JSON.stringify(res.data));

    // 4. Withdraw (credit)
    const withdrawId = crypto.randomUUID();
    res = await postInout('withdraw', {
      operator: OPERATOR,
      currency: CURRENCY,
      amount: '1.00',
      result: (balance + 1.00).toFixed(2),
      coefficient: '2.00',
      user_id: userId,
      transactionId: withdrawId,
      gameId: crypto.randomUUID(),
      isFinished: true,
      debitId: betId,
    }, token);
    console.log('Withdraw response:', res.status, res.data);
    printResult('Withdraw returns 200', res.status === 200);
    printResult('Withdraw response fields', checkFields(res.data.data || res.data, ['code', 'balance', 'operator']), JSON.stringify(res.data));
    printResult('Withdraw code is OK', (res.data.data || res.data).code === 'OK', JSON.stringify(res.data));

    // 5. Standard bet and refund
    const betId2 = crypto.randomUUID();
    res = await postInout('bet', { operator: OPERATOR, currency: CURRENCY, amount: '1.00', user_id: userId, transactionId: betId2, gameId: crypto.randomUUID() }, token);
    console.log('Bet2 response:', res.status, res.data);
    printResult('Bet2 returns 200', res.status === 200);
    printResult('Bet2 response fields', checkFields(res.data.data || res.data, ['code', 'balance', 'operator']), JSON.stringify(res.data));
    printResult('Bet2 code is OK', (res.data.data || res.data).code === 'OK', JSON.stringify(res.data));

    // 6. Rollback (refund)
    const rollbackId = crypto.randomUUID();
    res = await postInout('rollback', {
      operator: OPERATOR,
      currency: CURRENCY,
      amount: '1.00',
      user_id: userId,
      transactionId: rollbackId,
      gameId: crypto.randomUUID(),
      debitId: betId2,
      isFinished: true,
    }, token);
    console.log('Rollback response:', res.status, res.data);
    printResult('Rollback returns 200', res.status === 200);
    printResult('Rollback response fields', checkFields(res.data.data || res.data, ['code', 'balance', 'operator']), JSON.stringify(res.data));
    printResult('Rollback code is OK', (res.data.data || res.data).code === 'OK', JSON.stringify(res.data));

    // 7. Double refund (idempotency)
    res = await postInout('rollback', {
      operator: OPERATOR,
      currency: CURRENCY,
      amount: '1.00',
      user_id: userId,
      transactionId: rollbackId,
      gameId: crypto.randomUUID(),
      debitId: betId2,
      isFinished: true,
    }, token);
    console.log('Double rollback response:', res.status, res.data);
    printResult('Double rollback returns 200', res.status === 200);
    printResult('Double rollback response fields', checkFields(res.data.data || res.data, ['code', 'balance', 'operator']), JSON.stringify(res.data));
    printResult('Double rollback code is OK', (res.data.data || res.data).code === 'OK', JSON.stringify(res.data));

    // 8. Overestimated bet
    res = await postInout('bet', { operator: OPERATOR, currency: CURRENCY, amount: '999999.00', user_id: userId, transactionId: crypto.randomUUID(), gameId: crypto.randomUUID() }, token);
    console.log('Overestimated bet response:', res.status, res.data);
    printResult('Overestimated bet returns 200', res.status === 200);
    printResult('Overestimated bet error', (res.data.data || res.data).code === 'INSUFFICIENT_FUNDS', JSON.stringify(res.data));

    // 9. Incorrect currency
    res = await postInout('bet', { operator: OPERATOR, currency: 'WRD', amount: '1.00', user_id: userId, transactionId: crypto.randomUUID(), gameId: crypto.randomUUID() }, token);
    console.log('Incorrect currency bet response:', res.status, res.data);
    printResult('Incorrect currency returns 200', res.status === 200);
    printResult('Incorrect currency error', (res.data.data || res.data).code === 'CHECKS_FAIL', JSON.stringify(res.data));

    // 10. Non-existent rollback
    res = await postInout('rollback', {
      operator: OPERATOR,
      currency: CURRENCY,
      amount: '1.00',
      user_id: userId,
      transactionId: crypto.randomUUID(),
      gameId: crypto.randomUUID(),
      debitId: crypto.randomUUID(),
      isFinished: true,
    }, token);
    console.log('Non-existent rollback response:', res.status, res.data);
    printResult('Non-existent rollback returns 200', res.status === 200);
    printResult('Non-existent rollback error', (res.data.data || res.data).code === 'CHECKS_FAIL', JSON.stringify(res.data));

    // 11. Incorrect signature
    const badBody = { action: 'init', token, data: { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY } };
    try {
      await axios.post(CALLBACK_URL, badBody, { headers: { 'x-request-sign': 'badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad' } });
      printResult('Incorrect signature should fail', false);
    } catch (e) {
      printResult('Incorrect signature returns 403', e.response && e.response.status === 403, e.response && JSON.stringify(e.response.data));
    }
    console.log('--- Test script completed ---');
  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  }
})(); 