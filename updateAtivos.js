import yahooFinance from "yahoo-finance2";
import pkg from "pg";
import { ativos } from "./ativos.js";

const { Pool } = pkg;

/*
===========================================
CONEXÃO POSTGRES / NEON
===========================================
*/

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/*
===========================================
FUNÇÃO PRINCIPAL
===========================================
*/

async function atualizarAtivos() {

  console.log("====================================");
  console.log("Atualizando ativos...");
  console.log("====================================");

  for (const ticker of ativos) {

    try {

      console.log(`Buscando ${ticker}...`);

      /*
      ===========================================
      BUSCA DADOS DO YAHOO
      ===========================================
      */

      const ativo = await yahooFinance.quote(ticker);

      /*
      ===========================================
      REMOVE .SA
      ===========================================
      */

      const tickerLimpo = ticker.replace(".SA", "");

      /*
      ===========================================
      INSERE / ATUALIZA TABELA PRINCIPAL
      ===========================================
      */

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
          ativo.longName || ativo.shortName || tickerLimpo,
          ativo.regularMarketPrice || 0,
          ativo.regularMarketChangePercent || 0,
          ativo.regularMarketOpen || 0,
          ativo.regularMarketDayHigh || 0,
          ativo.regularMarketDayLow || 0,
          ativo.regularMarketVolume || 0
        ]
      );

      /*
      ===========================================
      HISTÓRICO DOS ATIVOS
      ===========================================
      */

      await pool.query(
        `
        INSERT INTO historico_ativos
        (
          ticker,
          preco,
          variacao,
          volume,
          data_coleta
        )

        VALUES
        ($1,$2,$3,$4,NOW())
        `,
        [
          tickerLimpo,
          ativo.regularMarketPrice || 0,
          ativo.regularMarketChangePercent || 0,
          ativo.regularMarketVolume || 0
        ]
      );

      console.log(`✅ ${ticker} atualizado`);

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

/*
===========================================
EXECUTA
===========================================
*/

atualizarAtivos();