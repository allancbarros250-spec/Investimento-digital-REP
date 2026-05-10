// VERSAO NOVA TESTE 999
import YahooFinance from "yahoo-finance2";
import pkg from "pg";
import dotenv from "dotenv";
import { ativos } from "./ativos.js";

dotenv.config();

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
});

const { Pool } = pkg;

// CONEXÃO COM O NEON
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

      // BUSCA NO YAHOO
      const ativo = await yahooFinance.quote(ticker);

      // VERIFICA SE VEIO DADO
      if (!ativo) {

        console.log(`❌ Sem dados para ${ticker}`);
        continue;

      }

      // REMOVE .SA
      const tickerLimpo = ticker.replace(".SA", "");

      // DADOS
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

      // =====================================
      // INSERE / ATUALIZA TABELA PRINCIPAL
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

      console.log(`✅ ${tickerLimpo} atualizado`);
      console.log(`Preço: R$ ${preco}`);

    } catch (erro) {

      console.log(`❌ Erro em ${ticker}`);

      // MOSTRA O ERRO REAL
      console.log(erro);

    }

    // EVITA RATE LIMIT
    await new Promise(resolve =>
      setTimeout(resolve, 1000)
    );
  }

  console.log("====================================");
  console.log("Atualização concluída!");
  console.log("====================================");

  await pool.end();
}

atualizarAtivos();