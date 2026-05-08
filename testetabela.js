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

async function testarTabela() {

  try {

    const resultado = await pool.query(`
      SELECT * FROM ativos
    `);

    console.log(resultado.rows);

  } catch (erro) {

    console.error(erro);

  } finally {

    await pool.end();

  }

}

testarTabela();