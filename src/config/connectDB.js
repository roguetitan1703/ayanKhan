import mysql from "mysql2/promise";

const connection = mysql.createPool({
  host: "localhost",
  user: "75new",
  password: "Pziw7siFNKBb4nJP",
  database: "75new",
});

// // LOCAL DEVELOPMENT DATABASE (FOR TESTING)
// const connection = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: 'password',
//   database: 'ayanKhan',
// });

// REMOTE PRODUCTION SERVER (ONLINE) - UNCOMMENT WHEN REMOTE ACCESS IS AVAILABLE
// const connection = mysql.createPool({
//   host: '62.72.43.210',
//   user: '65l',
//   password: 'fs6kLY4xdjTeEPaf',
//   database: '65l',
// });

// PRODUCTION DATABASE (LIVE SITE) - UNCOMMENT WHEN READY FOR PRODUCTION
// const connection = mysql.createPool({
//   host: 'localhost',
//   user: '75new',
//   password: 'Pziw7siFNKBb4nJP',
//   database: '75new',
// });

// const connection = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: '75club',
// });

// DATABASE_HOST=62.72.43.210
// DATABASE_USER=65l
// DATABASE_PASSWORD=fs6kLY4xdjTeEPaf
// DATABASE_NAME=	65l

export default connection;
