import YahooFinance from "yahoo-finance2";
import pkg from "pg";
import dotenv from "dotenv";
import { ativos } from "./ativos.js";

dotenv.config();

// =====================================
// YAHOO
// =====================================

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  timeout: 15000,
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

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

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
// DELAY
// =====================================

function delay(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

// =====================================
// BUSCAR COM SEGURANÇA
// =====================================

async function buscarAtivoSeguro(ticker) {

  try {

    const ativo = await yahooFinance.quote(ticker);

    return ativo;

  } catch (erro) {

    console.log(`❌ Falha Yahoo: ${ticker}`);
    console.log(erro.message);

    return null;
  }
}

// =====================================
// ATUALIZAR
// =====================================

async function atualizarAtivos() {

  console.log("====================================");
  console.log("Atualizando ativos...");
  console.log(
    new Date().toLocaleString("pt-BR")
  );
  console.log("====================================");

  const salvarHistorico =
    mercadoAberto();

  if (!salvarHistorico) {

    console.log("⚠ Mercado fechado");
    console.log(
      "Atualizando apenas tabela principal"
    );
  }

  for (const ticker of ativos) {

    try {

      console.log(`🔎 Buscando ${ticker}`);

      // =====================================
      // YAHOO
      // =====================================

      const ativo =
        await buscarAtivoSeguro(ticker);

      if (!ativo) {
        continue;
      }

      // =====================================
      // DADOS
      // =====================================

      const tickerLimpo =
        ticker.replace(".SA", "");

      const nome =
        ativo.longName ||
        ativo.shortName ||
        tickerLimpo;

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

      // =====================================
      // IGNORA PREÇO INVÁLIDO
      // =====================================

      if (preco <= 0) {

        console.log(
          `⚠ Preço inválido: ${ticker}`
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
            tickerLimpo,
            preco,
            variacao,
            volume,
          ]
        );
      }

      console.log(
        `✅ ${tickerLimpo} atualizado`
      );

      console.log(
        `💰 R$ ${preco}`
      );

    } catch (erro) {

      console.log(
        `❌ Erro geral em ${ticker}`
      );

      console.log(erro.message);
    }

    // =====================================
    // ANTI RATE LIMIT
    // =====================================

    await delay(2500);
  }

  console.log("====================================");
  console.log("✅ Atualização concluída");
  console.log("====================================");
}

// =====================================
// EXECUÇÃO
// =====================================

async function iniciar() {

  try {

    await atualizarAtivos();

    // Atualiza a cada 5 minutos

    setInterval(async () => {

      await atualizarAtivos();

    }, 5 * 60 * 1000);

  } catch (erro) {

    console.log("❌ Erro fatal");
    console.log(erro.message);
  }
}

iniciar();