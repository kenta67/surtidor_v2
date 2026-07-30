const { Pool } = require('pg');

const pool = new Pool({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.evlpamktwjhxenctxxrd',
  password: '0ds7OImddGcJ8ZEA',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Buscando constraint...');
    const { rows } = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.clientes'::regclass
      AND contype = 'c';
    `);
    
    for (const row of rows) {
      console.log('Dropping constraint:', row.conname);
      await client.query(`ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS "${row.conname}"`);
    }

    // Update existing records to match new constraints
    console.log('Actualizando registros existentes...');
    await client.query(`UPDATE public.clientes SET tipo_documento = 'CI' WHERE tipo_documento = 'DNI'`);
    await client.query(`UPDATE public.clientes SET tipo_documento = 'NIT' WHERE tipo_documento = 'RUC'`);
    await client.query(`UPDATE public.clientes SET tipo_documento = 'Otro' WHERE tipo_documento NOT IN ('CI', 'NIT', 'Otro')`);

    console.log('Agregando nuevo constraint...');
    await client.query(`
      ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_tipo_documento_check
      CHECK (tipo_documento IN ('CI', 'NIT', 'Otro'));
    `);

    console.log('Exito');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
