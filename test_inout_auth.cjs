const crypto = require('crypto');

const SECRET = '08C5AF03B9473F5F3200BB09011D78B864E6CC97DC3A1FD565B0D92802DD2E241402B29C146CC5B13EE3D962150E9CDA0260DA08CA0905E4E16542A847B6555B'; // Use the same secret as your backend/test
const body = {
  action: "withdraw",
  token: "222c03e18eabc4372f8e220f7828197c",
  gameMode: "plinko",
  data: {
    gameId: "1234567890",
    operator: "a30c0bc1-d0bd-4257-b662-a840dff37321",
    currency: "INR",
    amount: "10000",
    result: "10000",
    user_id: "1234567890",
    transactionId: "1234567890",
    coefficient: "1.00",
    isFinished: true,
    debitId: "1234567890"
  }
};

const bodyString = JSON.stringify(body);
const signature = crypto.createHmac('sha256', SECRET).update(bodyString).digest('hex');
console.log('Signature:', signature);
console.log('Body:', bodyString);

(async () => {

// make the request to the url
const url = 'https://75club.games/api/inout';
const response = await fetch(url, {
  method: 'POST', 
  body: bodyString,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${signature}`
  }
});

console.log('Response:', response);

})();