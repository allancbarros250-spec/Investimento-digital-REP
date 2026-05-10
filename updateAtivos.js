import YahooFinance from "yahoo-finance2";
import pkg from "pg";
import dotenv from "dotenv";
import { ativos } from "./ativos.js";

dotenv.config();

// =====================================
// YAHOO
// =====================================

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
});

// =====================================
// POSTGRES / NEON
// =====================================

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// =====================================
// FUNÇÃO PRA SABER SE É HORÁRIO DE PREGÃO
// 10h às 18h
// =====================================

function mercadoAberto() {

  const agora = new Date();

  const horaBrasil = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false
  }).format(agora);

  const hora = Number(horaBrasil);

  return hora >= 10 && hora <= 18;
}

// =====================================
// ATUALIZAR
// =====================================

async function atualizarAtivos() {

  console.log("====================================");
  console.log("Atualizando ativos...");
  console.log("====================================");

  const salvarHistorico = mercadoAberto();

  if (!salvarHistorico) {

    console.log("Mercado fechado.");
    console.log("Atualizando apenas tabela principal.");

  }

  for (const ticker of ativos) {

    try {

      console.log(`Buscando ${ticker}...`);

      // ============================
      // YAHOO
      // ============================

      const ativo = await yahooFinance.quote(ticker);

      if (!ativo) {

        console.log(`❌ Sem dados para ${ticker}`);
        continue;

      }

      // ============================
      // DADOS
      // ============================

      const tickerLimpo =
        ticker.replace(".SA", "");

      const nome =
        ativo.longName ||
        ativo.shortName ||
        tickerLimpo;

      const preco =
        ativo.regularMarketPrice ?? 0;

      const variacao =
        ativo.regularMarketChangePercent ?? 0;

      const abertura =
        ativo.regularMarketOpen ?? 0;

      const maxima =
        ativo.regularMarketDayHigh ?? 0;

      const minima =
        ativo.regularMarketDayLow ?? 0;

      const volume =
        ativo.regularMarketVolume ?? 0;

      // ============================
      // TABELA PRINCIPAL
      // ============================

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
          tickerLimpo,
          nome,
          preco,
          variacao,
          abertura,
          maxima,
          minima,
          volume,
        ]
      );

      // ============================
      // HISTÓRICO
      // ============================

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
            tickerLimpo,
            preco,
            variacao,
            volume,
          ]
        );

      }

      console.log(`✅ ${tickerLimpo} atualizado`);
      console.log(`Preço: R$ ${preco}`);

    } catch (erro) {

      console.log(`❌ Erro em ${ticker}`);
      console.log(erro.message);

    }

    // =====================================
    // DELAY ANTI RATE LIMIT
    // =====================================

    await new Promise(resolve =>
      setTimeout(resolve, 1500)
    );

  }

  console.log("====================================");
  console.log("Atualização concluída!");
  console.log("====================================");

  await pool.end();
}

atualizarAtivos();