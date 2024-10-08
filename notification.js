import { Kafka } from 'kafkajs';
import axios from 'axios';
import 'dotenv/config';
import createLogger from './logger.js';

const logger = createLogger('notification');
const consumerTopicName =
  process.env.NODE_ENV === 'prod' ? 'olympics-updates' : 'olympics-updates-dev';

const discordWebhook = process.env.DISCORD_WEBHOOK;
if (!discordWebhook) {
  logger.error('Please provide a DISCORD_WEBHOOK in the environment variables');
  process.exit(1);
}

const kafkaUrl = process.env.KAFKA_URL ?? 'localhost:9092';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [kafkaUrl],
});

const consumer = kafka.consumer({ groupId: consumerTopicName });

await consumer.connect();
await consumer.subscribe({ topic: consumerTopicName, fromBeginning: true });

consumer.run({
  eachMessage: async ({ _topic, _partition, message }) => {
    const messageValue = message.value.toString();
    logger.info(`Sending message: ${messageValue}`);
    axios.post(discordWebhook, {
      content: messageValue,
    });
  },
});

async function shutdown() {
  try {
    await consumer.disconnect();
    logger.info('Consumer disconnected');
  } catch (error) {
    logger.error('Error while disconnecting consumer', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
