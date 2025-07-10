// run_inout_games_setup.js
import mysql from 'mysql2/promise';
import fs from 'fs';

const dbConfig = {
  host: 'localhost',
  user: '75new',
  password: 'Pziw7siFNKBb4nJP',
  database: '75new',
};

async function main() {
  let connection;
  try {
    const sql = fs.readFileSync('./inout_games_setup.sql', 'utf8');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to DB!');
    // Split on semicolon for multiple statements (if needed)
    const statements = sql.split(/;\s*$/m).filter(Boolean);
    for (const stmt of statements) {
      if (stmt.trim()) {
        await connection.query(stmt);
        console.log('Executed statement:', stmt.split('\n')[0].slice(0, 80) + '...');
      }
    }
    console.log('✅ inout_games_setup.sql executed successfully.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

main(); 