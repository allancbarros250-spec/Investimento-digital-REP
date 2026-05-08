import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

// IMPORTA O CRON DE ATUALIZAÇÃO
import './updateAtivos.js';

dotenv.config();

const { Pool } = pg;

const app = express();

app.use(cors());
app.use(express.json());

// ===============================
// CONEXÃO COM POSTGRES / NEON
// ===============================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ===============================
// ROTA PRINCIPAL
// ===============================

app.get('/', (req, res) => {

  res.json({
    status: 'ONLINE',
    mensagem: 'API Investimento Digital funcionando'
  });

});

// ===============================
// LISTAR TODOS OS ATIVOS
// ===============================

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

// ===============================
// BUSCAR ATIVO ESPECÍFICO
// ===============================

app.get('/ativos/:ticker', async (req, res) => {

  try {

    const { ticker } = req.params;

    const resultado = await pool.query(
      `
      SELECT *
      FROM ativos
      WHERE ticker = $1
      `,
      [ticker.toUpperCase()]
    );

    if (resultado.rows.length === 0) {

      return res.status(404).json({
        erro: 'Ativo não encontrado'
      });

    }

    res.json(resultado.rows[0]);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      erro: 'Erro ao buscar ativo'
    });

  }

});

// ===============================
// HISTÓRICO DO ATIVO
// ===============================

app.get('/historico/:ticker', async (req, res) => {

  try {

    const { ticker } = req.params;

    const resultado = await pool.query(
      `
      SELECT *
      FROM historico_ativos
      WHERE ticker = $1
      ORDER BY data_registro DESC
      LIMIT 100
      `,
      [ticker.toUpperCase()]
    );

    res.json(resultado.rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      erro: 'Erro ao buscar histórico'
    });

  }

});

// ===============================
// PORTA DO RENDER
// ===============================

const PORT = process.env.PORT || 3000;

// ===============================
// INICIAR SERVIDOR
// ===============================

app.listen(PORT, () => {

  console.log('====================================');
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log('====================================');

});