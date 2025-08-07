#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

// ==== CONFIGURATION ====
const CALLBACK_URL = 'https://75club.games/api/callback/inout';
const INOUT_SECRET = '08C5AF03B9473F5F3200BB09011D78B864E6CC97DC3A1FD565B0D92802DD2E241402B29C146CC5B13EE3D962150E9CDA0260DA08CA0905E4E16542A847B6555B';
const OPERATOR = 'a30c0bc1-d0bd-4257-b662-a840dff37321';
const CURRENCY = 'INR';
const VALID_TOKEN = 'd6127176044692ea910bebd3806403ee'; // Update as needed

function signBody(body) {
  const str = JSON.stringify(body);
  return crypto.createHmac('sha256', INOUT_SECRET).update(str).digest('hex');
}

async function postInout(action, data, token, overrideSecret) {
  const body = { action, ...(token ? { token } : {}), data };
  const secret = overrideSecret || INOUT_SECRET;
  const headers = { 'x-request-sign': crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex') };
  try {
    const res = await axios.post(CALLBACK_URL, body, { headers });
    return res;
  } catch (e) {
    if (e.response) return e.response;
    throw e;
  }
}

function assertFields(obj, required, context) {
  for (const key of required) {
    if (!(key in obj)) {
      throw new Error(`[${context}] Missing required field: ${key}`);
    }
  }
}

function printStep(title, req, res) {
  console.log(`\n=== ${title} ===`);
  console.log('Request:', JSON.stringify(req, null, 2));
  console.log('Response:', JSON.stringify(res.data, null, 2));
}

(async () => {
  try {
    // 1. INIT
    let req = { action: 'init', token: VALID_TOKEN, data: { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY } };
    let res = await postInout('init', req.data, req.token);
    printStep('Session initialization', req, res);
    if (res.status !== 200) throw new Error('Init did not return HTTP 200');
    assertFields(res.data, ['data', 'status'], 'init');
    assertFields(res.data.data, ['code', 'userId', 'nickname', 'balance', 'currency', 'operator'], 'init.data');
    if (res.data.data.code !== 'OK') throw new Error('Init code is not OK');
    let userId = res.data.data.userId;

    // 2. BET
    const betId = crypto.randomUUID();
    req = { action: 'bet', token: VALID_TOKEN, data: { operator: OPERATOR, currency: CURRENCY, amount: '1.00', user_id: userId, transactionId: betId, gameId: crypto.randomUUID() } };
    res = await postInout('bet', req.data, req.token);
    printStep('Player bet', req, res);
    if (res.status !== 200) throw new Error('Bet did not return HTTP 200');
    assertFields(res.data, ['data', 'status'], 'bet');
    assertFields(res.data.data, ['code', 'balance'], 'bet.data');
    if (res.data.data.code !== 'OK') throw new Error('Bet code is not OK');

    // 3. WITHDRAW
    const withdrawId = crypto.randomUUID();
    req = { action: 'withdraw', token: VALID_TOKEN, data: { operator: OPERATOR, currency: CURRENCY, amount: '1.00', result: '1.00', user_id: userId, transactionId: withdrawId, gameId: crypto.randomUUID(), coefficient: '2.00', isFinished: true, debitId: betId } };
    res = await postInout('withdraw', req.data, req.token);
    printStep('Credit (withdraw)', req, res);
    if (res.status !== 200) throw new Error('Withdraw did not return HTTP 200');
    assertFields(res.data, ['data', 'status'], 'withdraw');
    assertFields(res.data.data, ['code', 'balance'], 'withdraw.data');
    if (res.data.data.code !== 'OK') throw new Error('Withdraw code is not OK');

    // 4. ROLLBACK
    const rollbackId = crypto.randomUUID();
    req = { action: 'rollback', token: VALID_TOKEN, data: { operator: OPERATOR, currency: CURRENCY, amount: '1.00', user_id: userId, transactionId: rollbackId, gameId: crypto.randomUUID(), debitId: betId, isFinished: true } };
    res = await postInout('rollback', req.data, req.token);
    printStep('Rollback (refund)', req, res);
    if (res.status !== 200) throw new Error('Rollback did not return HTTP 200');
    assertFields(res.data, ['data', 'status'], 'rollback');
    assertFields(res.data.data, ['code', 'balance'], 'rollback.data');
    // code may be OK or CHECKS_FAIL depending on business logic

    // 5. ERROR CASE: Invalid token
    req = { action: 'init', token: 'invalidtoken', data: { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY } };
    res = await postInout('init', req.data, req.token);
    printStep('Error case: Invalid token', req, res);
    if (res.status !== 200) throw new Error('Invalid token did not return HTTP 200');
    assertFields(res.data, ['data', 'status'], 'error-invalid-token');
    if (!['ACCOUNT_INVALID', 'CHECKS_FAIL', 'UNKNOWN_ERROR'].includes(res.data.data.code)) throw new Error('Invalid token did not return error code');

    // 6. ERROR CASE: Missing required field
    req = { action: 'bet', token: VALID_TOKEN, data: { operator: OPERATOR, currency: CURRENCY, amount: '1.00', transactionId: crypto.randomUUID(), gameId: crypto.randomUUID() } };
    res = await postInout('bet', req.data, req.token);
    printStep('Error case: Missing user_id', req, res);
    if (res.status !== 200) throw new Error('Missing field did not return HTTP 200');
    assertFields(res.data, ['data', 'status'], 'error-missing-userid');
    assertFields(res.data.data, ['code', 'message'], 'error-missing-userid.data');
    if (!['CHECKS_FAIL', 'UNKNOWN_ERROR'].includes(res.data.data.code)) throw new Error('Missing field did not return error code');

    // 7. ERROR CASE: Wrong currency
    req = { action: 'bet', token: VALID_TOKEN, data: { operator: OPERATOR, currency: 'WRD', amount: '1.00', user_id: userId, transactionId: crypto.randomUUID(), gameId: crypto.randomUUID() } };
    res = await postInout('bet', req.data, req.token);
    printStep('Error case: Wrong currency', req, res);
    if (res.status !== 200) throw new Error('Wrong currency did not return HTTP 200');
    assertFields(res.data, ['data', 'status'], 'error-wrong-currency');
    assertFields(res.data.data, ['code', 'message'], 'error-wrong-currency.data');
    if (!['CHECKS_FAIL', 'UNKNOWN_ERROR'].includes(res.data.data.code)) throw new Error('Wrong currency did not return error code');

    // 8. IDEMPOTENCY: Repeat bet
    req = { action: 'bet', token: VALID_TOKEN, data: { operator: OPERATOR, currency: CURRENCY, amount: '1.00', user_id: userId, transactionId: betId, gameId: crypto.randomUUID() } };
    res = await postInout('bet', req.data, req.token);
    printStep('Idempotency: Repeat bet', req, res);
    if (res.status !== 200) throw new Error('Repeat bet did not return HTTP 200');
    assertFields(res.data, ['data', 'status'], 'idempotency-bet');
    assertFields(res.data.data, ['code', 'balance'], 'idempotency-bet.data');

    // 9. SIGNATURE: Invalid signature
    req = { action: 'init', token: VALID_TOKEN, data: { gameMode: 'plinko', operator: OPERATOR, currency: CURRENCY } };
    res = await postInout('init', req.data, req.token, 'WRONGSECRET');
    printStep('Signature: Invalid signature', req, res);
    if (res.status !== 403) throw new Error('Invalid signature did not return HTTP 403');
    assertFields(res.data, ['code', 'message'], 'signature-error');
    if (res.data.code !== 'CHECKS_FAIL') throw new Error('Invalid signature did not return CHECKS_FAIL');

    console.log('\nAll comprehensive API tests PASSED.');
  } catch (err) {
    console.error('\nTEST FAILED:', err.message);
    process.exit(1);
  }
})(); 