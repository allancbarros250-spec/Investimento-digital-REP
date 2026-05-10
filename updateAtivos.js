import yahooFinance from "yahoo-finance2";
import pkg from "pg";
import dotenv from "dotenv";
import { ativos } from "./ativos.js";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

console.log("====================================");
console.log("Atualizando ativos...");
console.log("====================================");

async function atualizarAtivos() {
  for (const ticker of ativos) {
    try {
      console.log(`Buscando ${ticker}...`);

      const ativo = await yahooFinance.quote(ticker);

      if (!ativo || !ativo.regularMarketPrice) {
        console.log(`❌ Dados inválidos para ${ticker}`);
        continue;
      }

      // REMOVE O .SA PARA PADRONIZAR
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

        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())

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
          ativo.longName || ativo.shortName || tickerLimpo,
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

      console.log(`✅ ${tickerLimpo} atualizado`);
    } catch (erro) {
      console.log(`❌ Erro em ${ticker}`);
      console.log(erro.message);
    }
  }

  console.log("====================================");
  console.log("Atualização concluída!");
  console.log("====================================");

  await pool.end();
}

atualizarAtivos();