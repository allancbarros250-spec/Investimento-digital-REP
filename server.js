import express from "express";
import cors from "cors";
import pg from "pg";
import yahooFinance from "yahoo-finance2";

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

const ativos = [
  "PETR4.SA",
  "VALE3.SA",
  "ITUB4.SA",
  "BBAS3.SA",
  "MXRF11.SA",
  "HGLG11.SA",
  "BOVA11.SA",
];

async function atualizarAtivos() {
  console.log("Atualizando ativos...");

  for (const ticker of ativos) {
    try {
      const ativo = await yahooFinance.quote(ticker);

      const tickerLimpo = ticker.replace(".SA", "");

      await pool.query(
        `
        INSERT INTO ativos
        (
          ticker,
          nome,
          preco,
          variacao,
          abertura,
          maxima,
          minima,
          volume,
          atualizacao
        )

        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,NOW())

        ON CONFLICT (ticker)

        DO UPDATE SET
          nome = EXCLUDED.nome,
          preco = EXCLUDED.preco,
          variacao = EXCLUDED.variacao,
          abertura = EXCLUDED.abertura,
          maxima = EXCLUDED.maxima,
          minima = EXCLUDED.minima,
          volume = EXCLUDED.volume,
          atualizacao = NOW()
        `,
        [
          tickerLimpo,
          ativo.longName,
          ativo.regularMarketPrice,
          ativo.regularMarketChangePercent,
          ativo.regularMarketOpen,
          ativo.regularMarketDayHigh,
          ativo.regularMarketDayLow,
          ativo.regularMarketVolume,
        ]
      );

      await pool.query(
        `
        INSERT INTO historico_ativos
        (
          ticker,
          preco,
          variacao,
          volume
        )

        VALUES ($1,$2,$3,$4)
        `,
        [
          tickerLimpo,
          ativo.regularMarketPrice,
          ativo.regularMarketChangePercent,
          ativo.regularMarketVolume,
        ]
      );

      console.log(`✅ ${ticker} atualizado`);
    } catch (erro) {
      console.log(`❌ Erro em ${ticker}`);
      console.log(erro.message);
    }
  }
}

setInterval(atualizarAtivos, 60000);

app.get("/", (req, res) => {
  res.json({
    status: "online",
  });
});

app.get("/ativos", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT *
      FROM ativos
      ORDER BY ticker
    `);

    res.json(resultado.rows);
  } catch (erro) {
    res.status(500).json({
      erro: erro.message,
    });
  }
});

app.get("/historico/:ticker", async (req, res) => {
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
  } catch (erro) {
    res.status(500).json({
      erro: erro.message,
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  await atualizarAtivos();
});