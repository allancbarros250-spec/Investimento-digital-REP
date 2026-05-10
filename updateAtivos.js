import yahooFinanceModule from "yahoo-finance2";
import pkg from "pg";
import dotenv from "dotenv";
import { ativos } from "./ativos.js";

dotenv.config();

const YahooFinanceClass = yahooFinanceModule.YahooFinance || yahooFinanceModule.default?.YahooFinance || yahooFinanceModule;
const yahooFinance = new YahooFinanceClass();

const { Pool } = pkg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function atualizarAtivos() {
    console.log("=== INICIANDO ATUALIZAÇÃO ===");

    for (const ticker of ativos) {
        try {
            await sleep(3000); 

            console.log(`Buscando ${ticker}...`);
            
            // NA V3: Passamos apenas o ticker primeiro. 
            // As opções de validação e headers agora são tratadas de forma mais simples.
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

            await pool.query(
                `INSERT INTO historico_ativos (ticker, preco, variacao, volume) VALUES ($1, $2, $3, $4)`,
                [tickerLimpo, preco, ativo.regularMarketChangePercent || 0, ativo.regularMarketVolume || 0]
            );

            console.log(`✅ ${tickerLimpo}: R$ ${preco.toFixed(2)}`);

        } catch (erro) {
            console.log(`❌ Erro em ${ticker}: ${erro.message}`);
        }
    }

    console.log("=== FINALIZADO COM SUCESSO ===");
    await pool.end();
}

atualizarAtivos();