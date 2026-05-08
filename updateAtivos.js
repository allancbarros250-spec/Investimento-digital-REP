import yahooFinance from 'yahoo-finance2';
import pg from 'pg';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const yahoo = new yahooFinance({
  suppressNotices: ['yahooSurvey']
});

const ativos = [
  'PETR4.SA',
  'VALE3.SA',
  'ITUB4.SA',
  'BBAS3.SA',
  'MXRF11.SA',
  'HGLG11.SA',
  'BOVA11.SA'
];

const atualizarAtivos = async () => {

  console.log('====================================');
  console.log('Atualizando ativos...');
  console.log('====================================');

  try {

    // BUSCA TODOS EM PARALELO
    const resultados = await Promise.all(

      ativos.map(async (ticker) => {

        try {

          console.log(`Buscando ${ticker}...`);

          const ativo = await yahoo.quote(ticker);

          return ativo;

        } catch (error) {

          console.error(`❌ Erro ao buscar ${ticker}`);
          console.error(error.message);

          return null;

        }

      })

    );

    // REMOVE ERROS/NULOS
    const ativosValidos = resultados.filter(Boolean);

    for (const ativo of ativosValidos) {

      try {

        // REMOVE .SA
        const tickerLimpo = ativo.symbol.replace('.SA', '');

        // ====================================
        // TABELA PRINCIPAL (SNAPSHOT ATUAL)
        // ====================================

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
            ativo.regularMarketVolume || 0
          ]
        );

        // ====================================
        // HISTÓRICO
        // ====================================

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
            ativo.regularMarketVolume || 0
          ]
        );

        console.log(`✅ ${tickerLimpo} atualizado`);

      } catch (error) {

        console.error(`❌ Erro ao salvar ${ativo.symbol}`);
        console.error(error.message);

      }

    }

    console.log('====================================');
    console.log('Atualização concluída!');
    console.log('====================================');

  } catch (error) {

    console.error('❌ Erro geral');
    console.error(error);

  }

};

// EXECUTA IMEDIATAMENTE
atualizarAtivos();

// EXECUTA A CADA 15 MINUTOS
cron.schedule('*/15 * * * *', () => {

  atualizarAtivos();

});