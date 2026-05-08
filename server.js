import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});


// ========================================
// ROTA PRINCIPAL
// ========================================

app.get('/', (req, res) => {

  res.json({
    status: 'API ONLINE'
  });

});


// ========================================
// TODOS OS ATIVOS
// ========================================

app.get('/ativos', async (req, res) => {

  try {

    const resultado = await pool.query(`
      SELECT *
      FROM ativos
      ORDER BY ticker ASC
    `);

    res.json(resultado.rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      erro: 'Erro ao buscar ativos'
    });

  }

});


// ========================================
// HISTÓRICO DE UM ATIVO
// ========================================

app.get('/historico/:ticker', async (req, res) => {

  try {

    const { ticker } = req.params;

    const resultado = await pool.query(
      `
      SELECT *
      FROM historico_ativos
      WHERE ticker = $1
      ORDER BY data_coleta ASC
      `,
      [ticker]
    );

    res.json(resultado.rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      erro: 'Erro ao buscar histórico'
    });

  }

});


// ========================================
// SERVIDOR
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`Servidor rodando na porta ${PORT}`);

});