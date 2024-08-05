import axios from 'axios';
import cheerio from 'cheerio';

async function fetchFranceOlympicsPage(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0',
    },
  });
  return response.data;
}

async function fetchFranceOlympicStatus() {
  const url = 'https://olympics.com/en/paris-2024/medals/france';

  const pageContent = await fetchFranceOlympicsPage(url);
  const $ = cheerio.load(pageContent);

  const script = $('#__NEXT_DATA__').contents().toString();

  const nextData = JSON.parse(script);
  const medalsTable =
    nextData.props.pageProps.initialMedals.medalStandings.medalsTable;

  const franceMedals = medalsTable.find(
    (medal) => medal.organisation === 'FRA',
  );

  const franceStatus = {
    totalMedalsNumber: franceMedals.medalsNumber.filter(
      (medal) => medal.type === 'Total',
    )[0],
    medalsByDiscipline: franceMedals.disciplines.map((discipline) => {
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
  return franceStatus;
}

export default fetchFranceOlympicStatus;
