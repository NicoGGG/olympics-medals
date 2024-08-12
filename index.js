import { Kafka } from 'kafkajs';
import 'dotenv/config';
import createLogger from './logger.js';
import fetchOlympicStatus from './cheerio.js';

const logger = createLogger('index');
const kafkaUrl = process.env.KAFKA_URL ?? 'localhost:9092';
const scanIntervalMs = process.env.SCAN_INTERVAL_MS ?? 60000;
const topicName = process.env.NODE_ENV === 'prod' ? 'olympics' : 'olympics-dev';
const countriesStr = process.env.COUNTRIES ?? 'FRA';

const countries = countriesStr.split(',');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [kafkaUrl],
});

const producer = kafka.producer();

await producer.connect();

async function runService() {
  countries.forEach(async (country) => {
    const countryStatus = await fetchOlympicStatus(country);

    if (countryStatus) {
      const countryMessage = JSON.stringify({
        total: countryStatus.totalMedalsNumber,
        byDiscipline: countryStatus.medalsByDiscipline,
        country,
      });

      logger.info(`Sending message: ${countryMessage}`);

      await producer.send({
        topic: topicName,
        messages: [{ value: countryMessage }],
      });
    }
  });
}

setInterval(runService, scanIntervalMs);
logger.info(
  `Service started. Will scan ${countriesStr} every ${scanIntervalMs} milliseconds. Press Ctrl+C to stop.`,
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
