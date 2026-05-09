import pg from "pg";
import yahooFinance from "yahoo-finance2";
import { ativos } from "./ativos.js";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const yahoo = new yahooFinance.default({
  suppressNotices: ["yahooSurvey"],
});

function mercadoAberto() {
  const agora = new Date();

  const diaSemana = agora.getDay();

  // 0 = domingo
  // 6 = sábado
  if (diaSemana === 0 || diaSemana === 6) {
    return false;
  }

  const horaBrasil = agora.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  const [hora] = horaBrasil.split(":").map(Number);

  return hora >= 10 && hora < 18;
}

async function atualizarAtivos() {
  console.log("====================================");
  console.log("Iniciando atualização...");
  console.log("====================================");

  if (!mercadoAberto()) {
    console.log("Mercado fechado.");
    process.exit(0);
  }

  let sucesso = 0;
  let erros = 0;

  for (const ticker of ativos) {
    try {
      console.log(`Buscando ${ticker}...`);

      const ativo = await yahoo.quote(ticker);

      if (!ativo || !ativo.regularMarketPrice) {
        console.log(`❌ Dados inválidos em ${ticker}`);
        erros++;
        continue;
      }

      const tickerLimpo = ticker.replace(".SA", "");

      // TABELA PRINCIPAL
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
          ativo.longName || tickerLimpo,
          ativo.regularMarketPrice || 0,
          ativo.regularMarketChangePercent || 0,
          ativo.regularMarketOpen || 0,
          ativo.regularMarketDayHigh || 0,
          ativo.regularMarketDayLow || 0,
          ativo.regularMarketVolume || 0,
        ]
      );

      // HISTÓRICO
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
          ativo.regularMarketPrice || 0,
          ativo.regularMarketChangePercent || 0,
          ativo.regularMarketVolume || 0,
        ]
      );

      console.log(`✅ ${ticker} atualizado`);
      sucesso++;
    } catch (erro) {
      console.log(`❌ Erro em ${ticker}`);
      console.log(erro.message);
      erros++;
    }
  }

  console.log("====================================");
  console.log("Atualização concluída");
  console.log(`✅ Sucesso: ${sucesso}`);
  console.log(`❌ Erros: ${erros}`);
  console.log("====================================");

  process.exit(0);
}

atualizarAtivos();