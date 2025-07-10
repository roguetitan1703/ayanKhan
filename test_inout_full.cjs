#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

// ==== CONFIGURATION ====
const LAUNCH_URL = 'https://api.inout.games/api/launch?gameMode=plinko&operatorId=a30c0bc1-d0bd-4257-b662-a840dff37321&authToken=30a65962d274860af99269454e6f61a7&currency=INR&lang=en&adaptive=true';
const CALLBACK_URL = 'https://75club.games/api/callback/inout';
const INOUT_SECRET = '08C5AF03B9473F5F3200BB09011D78B864E6CC97DC3A1FD565B0D92802DD2E241402B29C146CC5B13EE3D962150E9CDA0260DA08CA0905E4E16542A847B6555B';
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

// Main test runner - replicates provider's exact test scenarios
(async () => {
  try {
    console.log('=== In-Out Games Provider Test Replication ===');
    
    // 1. Launch to get token
    const launchRes = await axios.get(LAUNCH_URL);
    const url = launchRes.request.res.responseUrl;
    const tokenMatch = url.match(/authToken=([a-f0-9]{32,})/i);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (!token) {
      console.error('Could not extract token from launch URL');
      process.exit(1);
    }
    console.log('Using token:', token);

    // === SCENARIO 1: Standard bet and credit ===
    console.log('\n--- Scenario 1: Standard bet and credit ---');
    
    // 1.1 Session initialization
    let res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === 'OK');
    const userId = res.data.userId;
    const balance = parseFloat(res.data.balance);

    // 1.2 Player's bet
    const betId = crypto.randomUUID();
    res = await postInout('bet', { 
      operator: OPERATOR, 
      currency: CURRENCY, 
      amount: '1.00', 
      user_id: userId, 
      transactionId: betId, 
      gameId: crypto.randomUUID() 
    }, token);
    printResult('Player bet returns 200', res.status === 200);
    printResult('Player bet code is OK', res.data.code === 'OK');
    printResult('Player bet response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 1.3 Re-initializing session
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Re-initializing session returns 200', res.status === 200);
    printResult('Re-initializing session code is OK', res.data.code === 'OK');

    // 1.4 Credit based on game results
    const withdrawId = crypto.randomUUID();
    res = await postInout('withdraw', {
      operator: OPERATOR,
      currency: CURRENCY,
      amount: '1.00',
      result: '1.00',
      user_id: userId,
      transactionId: withdrawId,
      gameId: crypto.randomUUID(),
      coefficient: '2.00',
      isFinished: true,
      debitId: betId,
    }, token);
    printResult('Credit returns 200', res.status === 200);
    printResult('Credit code is OK', res.data.code === 'OK');
    printResult('Credit response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 1.5 Additional session initialization
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Additional session initialization returns 200', res.status === 200);
    printResult('Additional session initialization code is OK', res.data.code === 'OK');

    // === SCENARIO 2: Standard bet and double refund ===
    console.log('\n--- Scenario 2: Standard bet and double refund ---');
    
    // 2.1 Session initialization
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === 'OK');

    // 2.2 Player's bet
    const betId2 = crypto.randomUUID();
    res = await postInout('bet', { 
      operator: OPERATOR, 
      currency: CURRENCY, 
      amount: '1.00', 
      user_id: userId, 
      transactionId: betId2, 
      gameId: crypto.randomUUID() 
    }, token);
    printResult('Player bet returns 200', res.status === 200);
    printResult('Player bet code is OK', res.data.code === 'OK');
    printResult('Player bet response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 2.3 Player's balance refund
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
    printResult('Balance refund returns 200', res.status === 200);
    printResult('Balance refund code is OK', res.data.code === 'OK');
    printResult('Balance refund response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 2.4 Repeated refund operation (idempotency)
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
    printResult('Repeated refund returns 200', res.status === 200);
    printResult('Repeated refund code is OK', res.data.code === 'OK');
    printResult('Repeated refund response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 2.5 Re-initializing session
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Re-initializing session returns 200', res.status === 200);
    printResult('Re-initializing session code is OK', res.data.code === 'OK');

    // === SCENARIO 3: Incorrect bet currency ===
    console.log('\n--- Scenario 3: Incorrect bet currency ---');
    
    // 3.1 Session initialization
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === 'OK');

    // 3.2 Player's bet with wrong currency
    res = await postInout('bet', { 
      operator: OPERATOR, 
      currency: 'WRD', 
      amount: '1.00', 
      user_id: userId, 
      transactionId: crypto.randomUUID(), 
      gameId: crypto.randomUUID() 
    }, token);
    printResult('Incorrect currency bet returns 200', res.status === 200);
    printResult('Incorrect currency bet error', res.data.code === 'CHECKS_FAIL');

    // 3.3 Re-initializing session
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Re-initializing session returns 200', res.status === 200);
    printResult('Re-initializing session code is OK', res.data.code === 'OK');

    // === SCENARIO 4: Standard initialization ===
    console.log('\n--- Scenario 4: Standard initialization ---');
    
    // 4.1 Session initialization
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === 'OK');

    // 4.2 Re-initializing session
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Re-initializing session returns 200', res.status === 200);
    printResult('Re-initializing session code is OK', res.data.code === 'OK');

    // === SCENARIO 5: Overestimated bet ===
    console.log('\n--- Scenario 5: Overestimated bet ---');
    
    // 5.1 Session initialization
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === 'OK');

    // 5.2 Player's bet with too high amount
    res = await postInout('bet', { 
      operator: OPERATOR, 
      currency: CURRENCY, 
      amount: '2.00', 
      user_id: userId, 
      transactionId: crypto.randomUUID(), 
      gameId: crypto.randomUUID() 
    }, token);
    printResult('Overestimated bet returns 200', res.status === 200);
    printResult('Overestimated bet error', res.data.code === 'INSUFFICIENT_FUNDS');

    // 5.3 Re-initializing session
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Re-initializing session returns 200', res.status === 200);
    printResult('Re-initializing session code is OK', res.data.code === 'OK');

    // === SCENARIO 6: Non-existent rollback ===
    console.log('\n--- Scenario 6: Non-existent rollback ---');
    
    // 6.1 Session initialization
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === 'OK');

    // 6.2 Credit to player balance (non-existent rollback)
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
    printResult('Non-existent rollback returns 200', res.status === 200);
    printResult('Non-existent rollback error', res.data.code === 'CHECKS_FAIL');

    // 6.3 Re-initializing session
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Re-initializing session returns 200', res.status === 200);
    printResult('Re-initializing session code is OK', res.data.code === 'OK');

    // === SCENARIO 7: Standard bet and double credit ===
    console.log('\n--- Scenario 7: Standard bet and double credit ---');
    
    // 7.1 Session initialization
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === 'OK');

    // 7.2 Player's bet
    const betId3 = crypto.randomUUID();
    res = await postInout('bet', { 
      operator: OPERATOR, 
      currency: CURRENCY, 
      amount: '1.00', 
      user_id: userId, 
      transactionId: betId3, 
      gameId: crypto.randomUUID() 
    }, token);
    printResult('Player bet returns 200', res.status === 200);
    printResult('Player bet code is OK', res.data.code === 'OK');
    printResult('Player bet response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 7.3 Credit based on game results
    const withdrawId2 = crypto.randomUUID();
    res = await postInout('withdraw', {
      operator: OPERATOR,
      currency: CURRENCY,
      amount: '1.00',
      result: '1.00',
      user_id: userId,
      transactionId: withdrawId2,
      gameId: crypto.randomUUID(),
      coefficient: '2.00',
      isFinished: true,
      debitId: betId3,
    }, token);
    printResult('Credit returns 200', res.status === 200);
    printResult('Credit code is OK', res.data.code === 'OK');
    printResult('Credit response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 7.4 Repeated credit based on game results (idempotency)
    res = await postInout('withdraw', {
      operator: OPERATOR,
      currency: CURRENCY,
      amount: '1.00',
      result: '1.00',
      user_id: userId,
      transactionId: withdrawId2,
      gameId: crypto.randomUUID(),
      coefficient: '2.00',
      isFinished: true,
      debitId: betId3,
    }, token);
    printResult('Repeated credit returns 200', res.status === 200);
    printResult('Repeated credit code is OK', res.data.code === 'OK');
    printResult('Repeated credit response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 7.5 Re-initializing session
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Re-initializing session returns 200', res.status === 200);
    printResult('Re-initializing session code is OK', res.data.code === 'OK');

    // === SCENARIO 8: Incorrect signature key ===
    console.log('\n--- Scenario 8: Incorrect signature key ---');
    
    // 8.1 Session initialization with bad signature
    const badBody = { action: 'init', token, data: { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY } };
    try {
      await axios.post(CALLBACK_URL, badBody, { headers: { 'x-request-sign': '01e9dd8bb3fac402fd99cc0f411ff469d0063c4aede1decd2b35e1130d646731' } });
      printResult('Incorrect signature should fail', false);
    } catch (e) {
      printResult('Incorrect signature returns 403', e.response && e.response.status === 403);
    }

    // === SCENARIO 9: Standard bet and refund ===
    console.log('\n--- Scenario 9: Standard bet and refund ---');
    
    // 9.1 Session initialization
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Session initialization returns 200', res.status === 200);
    printResult('Session initialization code is OK', res.data.code === 'OK');

    // 9.2 Player's bet
    const betId4 = crypto.randomUUID();
    res = await postInout('bet', { 
      operator: OPERATOR, 
      currency: CURRENCY, 
      amount: '1.00', 
      user_id: userId, 
      transactionId: betId4, 
      gameId: crypto.randomUUID() 
    }, token);
    printResult('Player bet returns 200', res.status === 200);
    printResult('Player bet code is OK', res.data.code === 'OK');
    printResult('Player bet response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 9.3 Player's balance refund
    const rollbackId2 = crypto.randomUUID();
    res = await postInout('rollback', {
      operator: OPERATOR,
      currency: CURRENCY,
      amount: '1.00',
      user_id: userId,
      transactionId: rollbackId2,
      gameId: crypto.randomUUID(),
      debitId: betId4,
      isFinished: true,
    }, token);
    printResult('Balance refund returns 200', res.status === 200);
    printResult('Balance refund code is OK', res.data.code === 'OK');
    printResult('Balance refund response fields', checkFields(res.data, ['code', 'balance', 'operator']));

    // 9.4 Re-initializing session
    res = await postInout('init', { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY }, token);
    printResult('Re-initializing session returns 200', res.status === 200);
    printResult('Re-initializing session code is OK', res.data.code === 'OK');

    console.log('\n=== All Provider Test Scenarios Completed ===');
    
  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  }
})();