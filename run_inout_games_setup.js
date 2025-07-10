// run_inout_games_setup.js
import mysql from 'mysql2/promise';
import fs from 'fs';

const dbConfig = {
  host: 'localhost',
  user: '75new',
  password: 'Pziw7siFNKBb4nJP',
  database: '75new',
};

async function ensureColumnExists(connection, table, column, type) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`);
    console.log(`Added column '${column}' to table '${table}'.`);
  } else {
    console.log(`Column '${column}' already exists in table '${table}'.`);
  }
}

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
    // Ensure required columns exist
    await ensureColumnExists(connection, 'inout_transactions', 'operator', 'VARCHAR(255)');
    await ensureColumnExists(connection, 'inout_transactions', 'raw_response', 'JSON');
    await ensureColumnExists(connection, 'inout_transactions', 'debit_id', 'VARCHAR(255)');
    console.log('✅ inout_games_setup.sql and schema checks executed successfully.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

main(); 