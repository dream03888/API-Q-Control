const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const mysql = require("mysql2/promise");
const axios = require('axios');
const { Client } = require("pg");
const { Pool } = require('pg');

const app = express();

app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '500mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

const PORT = dotenv.parsed.PORT || 3000;

// สร้าง HTTP Server
const httpServer = http.createServer(app);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 HTTP Server running on port ${PORT}`);
});

// สร้าง MySQL Pool
const pool = new Pool({
  host: dotenv.parsed.PGHOST,
  user: dotenv.parsed.PGUSER,
  password: dotenv.parsed.PGPASSWORD,
  database: dotenv.parsed.PGDATABASE,
  port: dotenv.parsed.PGPORT
});

const pgClient = new Client({
 host: dotenv.parsed.PGHOST,
  user: dotenv.parsed.PGUSER,
  password: dotenv.parsed.PGPASSWORD,
  database: dotenv.parsed.PGDATABASE,
  port: dotenv.parsed.PGPORT
});
// สร้าง Socket.io
const io = require('socket.io')(httpServer, { 
  cors: { origin: '*' }
});

module.exports = { app, io, pool, axios , pgClient };
