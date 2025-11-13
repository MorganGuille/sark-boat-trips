const { Pool } = require("pg");
// const { Pool } = require("pg/esm/index.mjs");
require("dotenv").config();

const localConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(localConfig);

pool.on("connect", () => {
  console.log("PostgreSQL client connected successfully");
});

pool.on("error", (err) => {
  console.error("Unexpected error ", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),

  getClient: () => pool.connect(),
};
