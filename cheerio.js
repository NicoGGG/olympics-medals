import axios from 'axios';
import cheerio from 'cheerio';

async function fetchOlympicsMedalsPage(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0',
    },
  });
  return response.data;
}

async function fetchOlympicStatus(countryCode) {
  const url = 'https://olympics.com/en/paris-2024/medals';

  const pageContent = await fetchOlympicsMedalsPage(url);
  const $ = cheerio.load(pageContent);

  const script = $('#__NEXT_DATA__').contents().toString();

  const nextData = JSON.parse(script);
  const medalsTable =
    nextData.props.pageProps.initialMedals.medalStandings.medalsTable;

  const countryMedals = medalsTable.find(
    (medal) => medal.organisation === countryCode,
  );

  if (!countryMedals) {
    logger.warn(`Country ${countryCode} not found in the medals table`);
    return;
  }
  const countryStatus = {
    totalMedalsNumber: countryMedals.medalsNumber.filter(
      (medal) => medal.type === 'Total',
    )[0],
    medalsByDiscipline: countryMedals.disciplines.map((discipline) => {
      const name = discipline.name;
      const winners = discipline.medalWinners.map((winner) => {
        return {
          medal: winner.medalType,
          event: winner.eventDescription,
          competitor: winner.competitorDisplayName,
        };
      });
      return {
        name,
        winners,
      };
    }),
  };
  return countryStatus;
}

export default fetchOlympicStatus;
