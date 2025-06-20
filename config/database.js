const { Pool } = require('pg');

// Usar a variável DATABASE_URL do .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
