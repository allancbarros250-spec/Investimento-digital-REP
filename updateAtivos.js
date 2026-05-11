import yahooFinance from "yahoo-finance2";
import pg from "pg";
import dotenv from "dotenv";
import { ativos } from "./ativos.js";

dotenv.config();

// =====================================
// POSTGRES
// =====================================

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },
});

// =====================================
// DELAY
// =====================================

function delay(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

// =====================================
// MERCADO ABERTO
// =====================================

function mercadoAberto() {

  const agora = new Date();

  const horaBrasil = new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }
  ).format(agora);

  const hora = Number(horaBrasil);

  return hora >= 10 && hora <= 18;
}

// =====================================
// BUSCA SEGURA
// =====================================

async function buscarAtivo(ticker) {

  try {

    const ativo =
      await yahooFinance.quote(ticker);

    return ativo;

  } catch (erro) {

    console.log(`❌ Erro em ${ticker}`);
    console.log(erro.message);

    return null;
  }
}

// =====================================
// ATUALIZAÇÃO
// =====================================

async function atualizarAtivos() {

  console.log("====================================");
  console.log("🚀 Atualizando ativos...");
  console.log("====================================");

  const salvarHistorico =
    mercadoAberto();

  for (const tickerCompleto of ativos) {

    try {

      console.log(
        `🔎 Buscando ${tickerCompleto}`
      );

      const ativo =
        await buscarAtivo(tickerCompleto);

      if (!ativo) {
        continue;
      }

      // =====================================
      // DADOS
      // =====================================

      const ticker =
        tickerCompleto.replace(".SA", "");

      const nome =
        ativo.longName ||
        ativo.shortName ||
        ticker;

      const preco = Number(
        ativo.regularMarketPrice ?? 0
      );

      const variacao = Number(
        ativo.regularMarketChangePercent ?? 0
      );

      const abertura = Number(
        ativo.regularMarketOpen ?? 0
      );

      const maxima = Number(
        ativo.regularMarketDayHigh ?? 0
      );

      const minima = Number(
        ativo.regularMarketDayLow ?? 0
      );

      const volume = Number(
        ativo.regularMarketVolume ?? 0
      );

      if (preco <= 0) {

        console.log(
          `⚠ Preço inválido em ${ticker}`
        );

        continue;
      }

      // =====================================
      // TABELA PRINCIPAL
      // =====================================

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
        (
          $1,$2,$3,$4,$5,$6,$7,$8,NOW()
        )

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
          ticker,
          nome,
          preco,
          variacao,
          abertura,
          maxima,
          minima,
          volume,
        ]
      );

      // =====================================
      // HISTÓRICO
      // =====================================

      if (salvarHistorico) {

        await pool.query(
          `
          INSERT INTO historico_ativos
          (
            ticker,
            preco,
            variacao,
            volume
          )

          VALUES
          (
            $1,$2,$3,$4
          )
          `,
          [
            ticker,
            preco,
            variacao,
            volume,
          ]
        );
      }

      console.log(
        `✅ ${ticker} atualizado`
      );

      console.log(
        `💰 R$ ${preco}`
      );

    } catch (erro) {

      console.log(
        `❌ Falha geral em ${tickerCompleto}`
      );

      console.log(erro.message);
    }

    // =====================================
    // RATE LIMIT
    // =====================================

    await delay(3000);
  }

  console.log("====================================");
  console.log("✅ Finalizado");
  console.log("====================================");
}

// =====================================
// LOOP
// =====================================

async function iniciar() {

  await atualizarAtivos();

  setInterval(async () => {

    await atualizarAtivos();

  }, 5 * 60 * 1000);
}

iniciar();