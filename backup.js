const { Client } = require('pg');
const fs = require('fs');

async function backup() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  
  const backup = {};
  for (const { tablename } of tables.rows) {
    const result = await client.query(`SELECT * FROM ${tablename}`);
    backup[tablename] = result.rows;
    console.log(`✓ ${tablename}: ${result.rows.length} rows`);
  }
  
  const filename = `jhsc_backup_${new Date().toISOString().slice(0,10)}.json`;
  fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
  console.log(`\nSaved: ${filename}`);
  await client.end();
}

backup().catch(console.error);
