import mysql from "mysql2/promise";

const pool = mysql.createPool({
  // Use Unix socket when DB_SOCKET is set (e.g. local macOS MySQL),
  // otherwise fall back to TCP host/port (e.g. production server).
  ...(process.env.DB_SOCKET
    ? { socketPath: process.env.DB_SOCKET }
    : {
        host: process.env.DB_HOST ?? "localhost",
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      }),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+07:00",
  dateStrings: true,
});

export default pool;
