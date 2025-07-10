#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');
const { URL } = require('url');

// ==== PASTE YOUR LAUNCH URL HERE ====
const LAUNCH_URL = 'https://api.inout.games/api/launch?gameMode=plinko&operatorId=a30c0bc1-d0bd-4257-b662-a840dff37321&authToken=222c03e18eabc4372f8e220f7828197c&currency=INR&lang=en&adaptive=true';

// ==== SET YOUR INOUT SECRET HERE ====
const SECRET = '08C5AF03B9473F5F3200BB09011D78B864E6CC97DC3A1FD565B0D92802DD2E241402B29C146CC5B13EE3D962150E9CDA0260DA08CA0905E4E16542A847B6555B'; // <-- CHANGE THIS TO YOUR REAL SECRET

// ==== EXTRACT PARAMS FROM URL ====
const urlObj = new URL(LAUNCH_URL);
const BASE_URL = 'https://75club.games';
const GAME_MODE = urlObj.searchParams.get('gameMode');
const OPERATOR = urlObj.searchParams.get('operatorId');
const TOKEN = urlObj.searchParams.get('authToken');
const CURRENCY = urlObj.searchParams.get('currency') || 'INR';

// Helper to sign the request body
function signBody(body, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// Helper to POST to /api/callback/inout
async function postInout(action, data, opts = {}) {
  const body = {
    action,
    token: TOKEN,
    data: { ...data },
  };
  const rawBody = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    'x-request-sign': opts.signature || signBody(rawBody),
  };
  try {
    const res = await axios.post(`${BASE_URL}/api/callback/inout`, body, { headers, validateStatus: () => true });
    return { status: res.status, data: res.data };
  } catch (e) {
    return { status: e.response?.status || 500, data: e.response?.data || { error: e.message } };
  }
}

// Helper to print test results
function printResult(desc, passed, details = '') {
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${passed ? 'PASSED' : 'FAILED'}\x1b[0m: ${desc}`);
  if (!passed && details) {
    console.log('    Details:', details);
  }
}

// Main test runner
(async () => {
  let summary = [];
  let userId, balance, gameId, transactionId, debitId;
  let lastInitBalance;

  // 1. Session initialization (init)
  const initData = {
    gameMode: GAME_MODE,
    operator: OPERATOR,
    currency: CURRENCY,
  };
  const initRes = await postInout('init', initData);
  printResult('Session initialization returns 200', initRes.status === 200, JSON.stringify(initRes.data));
  printResult('Session initialization code is OK', initRes.data.code === 'OK', JSON.stringify(initRes.data));
  userId = initRes.data.userId;
  balance = parseFloat(initRes.data.balance);
  lastInitBalance = balance;
  summary.push(initRes.data.code === 'OK');

  // 2. Player bet (bet)
  transactionId = crypto.randomUUID();
  gameId = crypto.randomUUID();
  const betData = {
    operator: OPERATOR,
    currency: CURRENCY,
    amount: '1000', // 1 unit (since backend divides by 1000)
    user_id: userId,
    transactionId,
    gameId,
  };
  const betRes = await postInout('bet', betData);
  printResult('Player bet returns 200', betRes.status === 200, JSON.stringify(betRes.data));
  printResult('Player bet code is OK', betRes.data.code === 'OK', JSON.stringify(betRes.data));
  const balanceAfterBet = parseFloat(betRes.data.balance);
  printResult('Balance decreased by 1000', balanceAfterBet === balance - 1000, `Expected: ${balance - 1000}, Got: ${balanceAfterBet}`);
  summary.push(betRes.data.code === 'OK' && balanceAfterBet === balance - 1000);

  // 3. Withdraw (credit winnings)
  const withdrawId = crypto.randomUUID();
  const withdrawData = {
    operator: OPERATOR,
    currency: CURRENCY,
    amount: '1000',
    coefficient: '2.00',
    user_id: userId,
    transactionId: withdrawId,
    gameId,
    result: '1',
    isFinished: true,
    debitId: transactionId,
  };
  const withdrawRes = await postInout('withdraw', withdrawData);
  printResult('Withdraw returns 200', withdrawRes.status === 200, JSON.stringify(withdrawRes.data));
  printResult('Withdraw code is OK', withdrawRes.data.code === 'OK', JSON.stringify(withdrawRes.data));
  const balanceAfterWithdraw = parseFloat(withdrawRes.data.balance);
  printResult('Balance increased by 2000', balanceAfterWithdraw === balanceAfterBet + 2000, `Expected: ${balanceAfterBet + 2000}, Got: ${balanceAfterWithdraw}`);
  summary.push(withdrawRes.data.code === 'OK' && balanceAfterWithdraw === balanceAfterBet + 2000);

  // 4. Rollback (refund bet)
  const rollbackId = crypto.randomUUID();
  const rollbackData = {
    operator: OPERATOR,
    currency: CURRENCY,
    amount: '1000',
    user_id: userId,
    transactionId: rollbackId,
    gameId,
    debitId: transactionId,
    isFinished: true,
  };
  const rollbackRes = await postInout('rollback', rollbackData);
  printResult('Rollback returns 200', rollbackRes.status === 200, JSON.stringify(rollbackRes.data));
  printResult('Rollback code is OK', rollbackRes.data.code === 'OK', JSON.stringify(rollbackRes.data));
  const balanceAfterRollback = parseFloat(rollbackRes.data.balance);
  printResult('Balance increased by 1000', balanceAfterRollback === balanceAfterWithdraw + 1000, `Expected: ${balanceAfterWithdraw + 1000}, Got: ${balanceAfterRollback}`);
  summary.push(rollbackRes.data.code === 'OK' && balanceAfterRollback === balanceAfterWithdraw + 1000);

  // 5. Overestimated bet (insufficient funds)
  const overBetId = crypto.randomUUID();
  const overBetData = {
    operator: OPERATOR,
    currency: CURRENCY,
    amount: (balanceAfterRollback + 1000000).toString(),
    user_id: userId,
    transactionId: overBetId,
    gameId: crypto.randomUUID(),
  };
  const overBetRes = await postInout('bet', overBetData);
  printResult('Overestimated bet returns INSUFFICIENT_FUNDS', overBetRes.data.code === 'INSUFFICIENT_FUNDS', JSON.stringify(overBetRes.data));
  summary.push(overBetRes.data.code === 'INSUFFICIENT_FUNDS');

  // 6. Incorrect currency
  const badCurrencyId = crypto.randomUUID();
  const badCurrencyData = {
    operator: OPERATOR,
    currency: 'WRD',
    amount: '1000',
    user_id: userId,
    transactionId: badCurrencyId,
    gameId: crypto.randomUUID(),
  };
  const badCurrencyRes = await postInout('bet', badCurrencyData);
  printResult('Incorrect currency returns CHECKS_FAIL', badCurrencyRes.data.code === 'CHECKS_FAIL', JSON.stringify(badCurrencyRes.data));
  summary.push(badCurrencyRes.data.code === 'CHECKS_FAIL');

  // 7. Incorrect signature
  const badSigId = crypto.randomUUID();
  const badSigData = {
    operator: OPERATOR,
    currency: CURRENCY,
    amount: '1000',
    user_id: userId,
    transactionId: badSigId,
    gameId: crypto.randomUUID(),
  };
  const badSigRes = await postInout('bet', badSigData, { signature: 'bad_signature' });
  printResult('Incorrect signature returns CHECKS_FAIL', badSigRes.data.code === 'CHECKS_FAIL', JSON.stringify(badSigRes.data));
  summary.push(badSigRes.data.code === 'CHECKS_FAIL');

  // 8. Idempotency: repeat withdraw
  const repeatWithdrawRes = await postInout('withdraw', withdrawData);
  printResult('Repeat withdraw is idempotent', repeatWithdrawRes.data.balance === withdrawRes.data.balance, `Expected: ${withdrawRes.data.balance}, Got: ${repeatWithdrawRes.data.balance}`);
  summary.push(repeatWithdrawRes.data.balance === withdrawRes.data.balance);

  // 9. Idempotency: repeat rollback
  const repeatRollbackRes = await postInout('rollback', rollbackData);
  printResult('Repeat rollback is idempotent', repeatRollbackRes.data.balance === rollbackRes.data.balance, `Expected: ${rollbackRes.data.balance}, Got: ${repeatRollbackRes.data.balance}`);
  summary.push(repeatRollbackRes.data.balance === rollbackRes.data.balance);

  // 10. Non-existent rollback
  const nonExistRollbackId = crypto.randomUUID();
  const nonExistRollbackData = {
    operator: OPERATOR,
    currency: CURRENCY,
    amount: '1000',
    user_id: userId,
    transactionId: crypto.randomUUID(),
    gameId: crypto.randomUUID(),
    debitId: nonExistRollbackId,
    isFinished: true,
  };
  const nonExistRollbackRes = await postInout('rollback', nonExistRollbackData);
  printResult('Non-existent rollback returns CHECKS_FAIL', nonExistRollbackRes.data.code === 'CHECKS_FAIL', JSON.stringify(nonExistRollbackRes.data));
  summary.push(nonExistRollbackRes.data.code === 'CHECKS_FAIL');

  // 11. Final balance check (should match lastInitBalance + 2000 + 1000)
  const finalInitRes = await postInout('init', initData);
  const finalBalance = parseFloat(finalInitRes.data.balance);
  printResult('Final balance matches expected', finalBalance === lastInitBalance + 2000 + 1000, `Expected: ${lastInitBalance + 2000 + 1000}, Got: ${finalBalance}`);
  summary.push(finalBalance === lastInitBalance + 2000 + 1000);

  // Summary
  const passed = summary.filter(Boolean).length;
  const total = summary.length;
  console.log(`\nTest summary: ${passed}/${total} passed.`);
  process.exit(passed === total ? 0 : 1);
})(); 