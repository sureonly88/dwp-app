const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ socketPath:'/tmp/mysql.sock', user:'yakinyakin', password:'', database:'dwp' });
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as total FROM anggota');
    console.log('COUNT result:', JSON.stringify(rows));
    const [data] = await pool.execute('SELECT id,nama,status FROM anggota LIMIT 3');
    console.log('Data sample:', JSON.stringify(data));
  } catch(e) {
    console.error('DB ERROR:', e.message);
  }
  await pool.end();
})();
