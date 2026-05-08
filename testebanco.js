import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testarBanco() {

  try {

    console.log('Conectando ao banco...');

    const resultado = await pool.query('SELECT NOW()');

    console.log('✅ Banco conectado!');
    console.log(resultado.rows);

  } catch (erro) {

    console.error('❌ Erro ao conectar:');
    console.error(erro);

  } finally {

    await pool.end();

  }

}

testarBanco();