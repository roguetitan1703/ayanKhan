// set_user_balance.js
// Usage: node set_user_balance.js <USER_ID> <NEW_BALANCE>
// Example: node set_user_balance.js 9828591 100000

import mysql from 'mysql2/promise';

// --- CONFIGURE THESE VALUES ---
const DB_CONFIG = {
  host: 'localhost',
  user: 'YOUR_DB_USER',
  password: 'YOUR_DB_PASSWORD',
  database: 'YOUR_DB_NAME'
};

const [,, userIdArg, newBalanceArg] = process.argv;

if (!userIdArg || !newBalanceArg) {
  console.error('Usage: node set_user_balance.js <USER_ID> <NEW_BALANCE>');
  process.exit(1);
}

const USER_ID = parseInt(userIdArg, 10);
const NEW_BALANCE = parseFloat(newBalanceArg);

if (isNaN(USER_ID) || isNaN(NEW_BALANCE)) {
  console.error('Invalid arguments. USER_ID must be an integer, NEW_BALANCE must be a number.');
  process.exit(1);
}

async function setUserBalance() {
  const connection = await mysql.createConnection(DB_CONFIG);
  try {
    // Set the balance
    const [result] = await connection.execute(
      'UPDATE users SET money = ? WHERE id_user = ?',
      [NEW_BALANCE, USER_ID]
    );
    console.log(`Rows affected: ${result.affectedRows}`);

    // Fetch and print the new balance
    const [rows] = await connection.execute(
      'SELECT id_user, money FROM users WHERE id_user = ?',
      [USER_ID]
    );
    if (rows.length > 0) {
      console.log(`User ${USER_ID} new balance: ${rows[0].money}`);
    } else {
      console.log('User not found.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

setUserBalance(); 