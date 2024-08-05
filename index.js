import { Kafka } from 'kafkajs';
import 'dotenv/config';
import createLogger from './logger.js';
import fetchFranceOlympicStatus from './cheerio.js';

const logger = createLogger('index');
const kafkaUrl = process.env.KAFKA_URL ?? 'localhost:9092';
const scanIntervalMs = process.env.SCAN_INTERVAL_MS ?? 60000;
const topicName = process.env.NODE_ENV === 'prod' ? 'olympics' : 'olympics-dev';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [kafkaUrl],
});

const producer = kafka.producer();

await producer.connect();

async function runService() {
  const franceStatus = await fetchFranceOlympicStatus();

  const fraMessage = JSON.stringify({
    total: franceStatus.totalMedalsNumber,
    byDiscipline: franceStatus.medalsByDiscipline,
    country: 'FRA',
  });

  logger.info(`Sending message: ${fraMessage}`);

  await producer.send({
    topic: topicName,
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
