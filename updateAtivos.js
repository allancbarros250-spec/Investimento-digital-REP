import YahooFinance from "yahoo-finance2";
import pg from "pg";
import dotenv from "dotenv";
import { ativos } from "./ativos.js";

dotenv.config();

// =====================================
// YAHOO FINANCE
// =====================================

const yahooFinance = new YahooFinance();

// =====================================
// POSTGRES / NEON
// =====================================

const { Pool } = pg;

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

    const resultado =
      await yahooFinance.quote(ticker);

    return resultado;

  } catch (erro) {

    console.log(
      `❌ Falha ao buscar ${ticker}`
    );

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
  console.log(
    new Date().toLocaleString("pt-BR")
  );
  console.log("====================================");

  const salvarHistorico =
    mercadoAberto();

  if (!salvarHistorico) {

    console.log(
      "⚠ Mercado fechado"
    );

    console.log(
      "Somente tabela principal será atualizada"
    );
  }

  for (const tickerCompleto of ativos) {

    try {

      console.log(
        `🔎 Buscando ${tickerCompleto}`
      );

      // =====================================
      // BUSCA
      // =====================================

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

      // =====================================
      // VALIDAÇÃO
      // =====================================

      if (preco <= 0) {

        console.log(
          `⚠ Preço inválido para ${ticker}`
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
        `💰 Preço: R$ ${preco}`
      );

    } catch (erro) {

      console.log(
        `❌ Erro geral em ${tickerCompleto}`
      );

      console.log(erro.message);
    }

    // =====================================
    // ANTI RATE LIMIT
    // =====================================

    await delay(3000);
  }

  console.log("====================================");
  console.log("✅ Atualização concluída");
  console.log("====================================");
}

// =====================================
// EXECUÇÃO CONTÍNUA
// =====================================

async function iniciar() {

  try {

    // Primeira execução

    await atualizarAtivos();

    // Executa a cada 5 minutos

    setInterval(async () => {

      await atualizarAtivos();

    }, 5 * 60 * 1000);

  } catch (erro) {

    console.log("❌ Erro fatal");
    console.log(erro.message);
  }
}

iniciar();