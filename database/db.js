const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const Db = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function testConnection() {
  try {
    await Db.getConnection();
    console.log("⚡️[database]: Connection database is success");
  } catch (error) {
    console.log("Connection database is failed", error);
  }
}

module.exports = {
  Db,
  testConnection,
};
