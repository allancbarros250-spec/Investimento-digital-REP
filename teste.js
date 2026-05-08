import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
});

async function testar() {

  try {

    console.log('Buscando ativo...');

    const ativo = await yahooFinance.quote('PETR4.SA');

    console.log(ativo);

  } catch (error) {

    console.error(error);

  }

}

testar();