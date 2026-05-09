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
export const ativos = [

  // =========================
  // AÇÕES IBOVESPA
  // =========================

  "PETR4.SA",
  "VALE3.SA",
  "ITUB4.SA",
  "BBAS3.SA",
  "BBDC4.SA",
  "ABEV3.SA",
  "WEGE3.SA",
  "RENT3.SA",
  "PRIO3.SA",
  "JBSS3.SA",
  "SUZB3.SA",
  "ELET3.SA",
  "ELET6.SA",
  "BPAC11.SA",
  "RAIL3.SA",
  "LREN3.SA",
  "RDOR3.SA",
  "GGBR4.SA",
  "CSNA3.SA",
  "CMIG4.SA",
  "CPLE6.SA",
  "UGPA3.SA",
  "EQTL3.SA",
  "SBSP3.SA",
  "VBBR3.SA",
  "HAPV3.SA",
  "RADL3.SA",
  "B3SA3.SA",
  "EMBR3.SA",
  "KLBN11.SA",
  "BRFS3.SA",
  "CYRE3.SA",
  "MRFG3.SA",
  "TOTS3.SA",
  "CCRO3.SA",
  "ASAI3.SA",
  "GOAU4.SA",
  "MULT3.SA",
  "ENEV3.SA",
  "NTCO3.SA",
  "BRAV3.SA",
  "TIMS3.SA",
  "VIVT3.SA",
  "CPFE3.SA",
  "TAEE11.SA",
  "EGIE3.SA",
  "SANB11.SA",
  "BBSE3.SA",
  "CXSE3.SA",
  "ALOS3.SA",
  "FLRY3.SA",
  "SMTO3.SA",
  "SLCE3.SA",
  "COGN3.SA",
  "CRFB3.SA",
  "PETZ3.SA",
  "YDUQ3.SA",
  "AZUL4.SA",
  "CVCB3.SA",

  // =========================
  // FIIs
  // =========================

  "MXRF11.SA",
  "HGLG11.SA",
  "KNRI11.SA",
  "XPLG11.SA",
  "VISC11.SA",
  "XPML11.SA",
  "HSML11.SA",
  "BRCO11.SA",
  "BTLG11.SA",
  "GGRC11.SA",
  "RBRF11.SA",
  "MALL11.SA",
  "PVBI11.SA",
  "RECT11.SA",
  "RZTR11.SA",
  "KNCR11.SA",
  "IRDM11.SA",
  "VGIR11.SA",
  "CPTS11.SA",
  "HCTR11.SA",
  "CVBI11.SA",
  "DEVA11.SA",
  "KNSC11.SA",
  "RECR11.SA",
  "TRXF11.SA",
  "SNCI11.SA",
  "TGAR11.SA",
  "ALZR11.SA",
  "RBRR11.SA",
  "BCFF11.SA",
  "HGRE11.SA",
  "JSRE11.SA",
  "HGBS11.SA",
  "PATL11.SA",
  "LVBI11.SA",
  "RBVA11.SA",
  "VILG11.SA",
  "URPR11.SA",
  "BCRI11.SA",
  "AFHI11.SA",
  "VGIP11.SA",
  "SNFF11.SA",
  "TEPP11.SA",
  "HFOF11.SA",
  "XPCI11.SA",
  "MCCI11.SA",
  "KFOF11.SA",
  "SARE11.SA",
  "HGCR11.SA",
  "OUJP11.SA",

  // =========================
  // ETFs
  // =========================

  "BOVA11.SA",
  "SMAL11.SA",
  "IVVB11.SA",
  "HASH11.SA",
  "XFIX11.SA",
  "GOVE11.SA",
  "DIVO11.SA",
  "ECOO11.SA",
  "SPXI11.SA",
  "NASD11.SA",
  "QBTC11.SA",
  "QETH11.SA",
  "BOVV11.SA",
  "PIBB11.SA",
  "FIND11.SA",
  "MATB11.SA",
  "ESGB11.SA",
  "ACWI11.SA",
  "WRLD11.SA",
  "GOLD11.SA"

];