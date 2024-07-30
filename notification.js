import { Kafka } from 'kafkajs';
import axios from 'axios';
import 'dotenv/config';

const discordWebhook = process.env.DISCORD_WEBHOOK;
if (!discordWebhook) {
  console.error(
    'Please provide a DISCORD_WEBHOOK in the environment variables',
  );
  process.exit(1);
}

const kafkaUrl = process.env.KAFKA_URL ?? 'localhost:9092';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [kafkaUrl],
});

const consumer = kafka.consumer({ groupId: 'olympics-updates' });

await consumer.connect();
await consumer.subscribe({ topic: 'olympics-updates', fromBeginning: true });

consumer.run({
  eachMessage: async ({ _topic, _partition, message }) => {
    const messageValue = message.value.toString();
    console.log(messageValue);
    axios.post(discordWebhook, {
      content: messageValue,
    });
  },
});