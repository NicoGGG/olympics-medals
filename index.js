import { Kafka } from 'kafkajs';
import axios from 'axios';
import cheerio from 'cheerio';
import 'dotenv/config';

const kafkaUrl = process.env.KAFKA_URL ?? 'localhost:9092';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [kafkaUrl],
});

const producer = kafka.producer();

await producer.connect();

async function fetchFranceOlympicsPage(url) {
  console.log('Fetching France Olympics page');
  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0',
    },
  });
  return response.data;
}

const url = 'https://olympics.com/en/paris-2024/medals/france';

const pageContent = await fetchFranceOlympicsPage(url);

function returnFraMedals(pageContent) {
  // Load the HTML into cheerio
  const $ = cheerio.load(pageContent);

  // Find the div with the data-test-id="virtuoso-item-list"
  const virtuosoItemList = $('div[data-test-id="virtuoso-item-list"]');

  if (virtuosoItemList.length > 0) {
    let allMedals = [];
    // Iterate over each child div inside the virtuoso-item-list
    virtuosoItemList.children('div').each((index, element) => {
      const childDivs = $(element).children('div');
      const country = $(childDivs[0]).find('span.elhe7kv4').text();

      if (country === 'FRA') {
        const fraDiv = $(childDivs[0]);
        const medals = fraDiv.find('.e1oix8v91');
        allMedals = medals
          .map((_, el) => parseInt($(el).text(), 10))
          .toArray()
          .filter((el) => !isNaN(el));
        return false;
      }
    });
    return allMedals;
  } else {
    console.log('No div found with data-test-id="virtuoso-item-list"');
  }
}

const franceMedals = returnFraMedals(pageContent);
console.log(franceMedals);

const franceMedalsObject = {
  gold: franceMedals[0],
  silver: franceMedals[1],
  bronze: franceMedals[2],
  total: franceMedals[3],
};

const fraMessage = JSON.stringify({
  medals: franceMedalsObject,
  country: 'FRA',
});

await producer.send({
  topic: 'olympics',
  messages: [{ value: fraMessage }],
});

await producer.disconnect();
