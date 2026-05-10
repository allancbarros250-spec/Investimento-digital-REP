import YahooFinance from "yahoo-finance2";
import pkg from "pg";
import dotenv from "dotenv";
import { ativos } from "./ativos.js";

dotenv.config();

const yahooFinance = new YahooFinance();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Função para dar uma pausa e não ser bloqueado pelo Yahoo
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function atualizarAtivos() {
  console.log("=== INICIANDO ATUALIZAÇÃO ===");

  for (const ticker of ativos) {
    try {
      // Espera 1 segundo antes de cada busca para evitar bloqueios
      await sleep(1000); 

      console.log(`Buscando ${ticker}...`);
      const ativo = await yahooFinance.quote(ticker);

      if (!ativo) {
        console.log(`⚠️ Sem resposta para ${ticker}`);
        continue;
      }

      const preco = ativo.regularMarketPrice || ativo.previousClose || ativo.postMarketPrice;

      if (!preco) {
        console.log(`⚠️ Preço não encontrado para ${ticker}`);
        continue;
      }

      const tickerLimpo = ticker.replace(".SA", "");
      const nomeAtivo = ativo.longName || ativo.shortName || tickerLimpo;

      // Update Tabela Principal
      await pool.query(
        `INSERT INTO ativos (ticker, nome, preco, variacao, abertura, maxima, minima, volume, atualizacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (ticker) DO UPDATE SET
         nome = EXCLUDED.nome, preco = EXCLUDED.preco, variacao = EXCLUDED.variacao,
         abertura = EXCLUDED.abertura, maxima = EXCLUDED.maxima, minima = EXCLUDED.minima,
         volume = EXCLUDED.volume, atualizacao = NOW()`,
        [
          tickerLimpo, nomeAtivo, preco,
          ativo.regularMarketChangePercent || 0,
          ativo.regularMarketOpen || preco,
          ativo.regularMarketDayHigh || preco,
          ativo.regularMarketDayLow || preco,
          ativo.regularMarketVolume || 0,
        ]
      );

      // Update Histórico
      await pool.query(
        `INSERT INTO historico_ativos (ticker, preco, variacao, volume) VALUES ($1, $2, $3, $4)`,
        [tickerLimpo, preco, ativo.regularMarketChangePercent || 0, ativo.regularMarketVolume || 0]
      );

      console.log(`✅ ${tickerLimpo}: R$ ${preco.toFixed(2)}`);

    } catch (erro) {
      console.log(`❌ Erro em ${ticker}: Ticker pode estar inválido ou fora do ar.`);
    }
  }

  console.log("=== FINALIZADO ===");
  await pool.end();
}

atualizarAtivos();