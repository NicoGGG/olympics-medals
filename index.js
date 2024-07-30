import { Kafka } from 'kafkajs';
import axios from 'axios';
import cheerio from 'cheerio';
import 'dotenv/config';
import createLogger from './logger.js';

const logger = createLogger('index');
const kafkaUrl = process.env.KAFKA_URL ?? 'localhost:9092';
const scanIntervalMs = process.env.SCAN_INTERVAL_MS ?? 60000;

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [kafkaUrl],
});

const producer = kafka.producer();

await producer.connect();

function returnFraMedals(pageContent) {
  const $ = cheerio.load(pageContent);

  const virtuosoItemList = $('div[data-test-id="virtuoso-item-list"]');

  if (virtuosoItemList.length > 0) {
    let allMedals = [];
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
    logger.error(
      'HTML Parsing error: No div found with data-test-id="virtuoso-item-list"',
    );
  }
}

async function runService() {
  async function fetchFranceOlympicsPage(url) {
    logger.info('Fetching France Olympics page');
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

  const franceMedals = returnFraMedals(pageContent);
  if (!franceMedals) {
    logger.error('No medals found for France');
    process.exit(1);
  }
  logger.info(franceMedals);

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
}

setInterval(runService, scanIntervalMs);
logger.info(
  `Service started. Will scan every ${scanIntervalMs} milliseconds. Press Ctrl+C to stop.`,
);

async function shutdown() {
  try {
    await producer.disconnect();
    logger.info('Producer disconnected');
  } catch (error) {
    logger.error('Error while disconnecting producer', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
