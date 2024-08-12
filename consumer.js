import { Kafka } from 'kafkajs';
import { MongoClient } from 'mongodb';
import 'dotenv/config';
import createLogger from './logger.js';

const logger = createLogger('consumer');

// MongoDB setup
const mongoUri = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const client = new MongoClient(mongoUri);

const dbName =
  process.env.NODE_ENV === 'prod' ? 'olympicsDB' : 'olympicsDB-dev';
const collectionName =
  process.env.NODE_ENV === 'prod' ? 'medals' : 'medals-dev';

const consumerTopicName =
  process.env.NODE_ENV === 'prod' ? 'olympics' : 'olympics-dev';
const producerTopicName =
  process.env.NODE_ENV === 'prod' ? 'olympics-updates' : 'olympics-updates-dev';
await client.connect();
const db = client.db(dbName);
const collection = db.collection(collectionName);

const kafkaUrl = process.env.KAFKA_URL ?? 'localhost:9092';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [kafkaUrl],
});

const consumer = kafka.consumer({ groupId: consumerTopicName });

await consumer.connect();
await consumer.subscribe({ topic: consumerTopicName, fromBeginning: true });

const producer = kafka.producer();

await producer.connect();

async function shutdown() {
  try {
    await producer.disconnect();
    await consumer.disconnect();
    logger.info('Producer and consumer disconnected');
  } catch (error) {
    logger.error('Error while disconnecting producer and/or consumer', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await consumer.run({
  eachMessage: async ({ _topic, _partition, message }) => {
    const newMessage = JSON.parse(message.value.toString());
    logger.info(`New value: ${JSON.stringify(newMessage)}`);
    const existingMedals = await collection.findOne({
      country: newMessage.country,
    });
    if (existingMedals) {
      logger.info(`Old value: ${JSON.stringify(existingMedals)}`);
      const result = await collection.updateOne(
        { country: newMessage.country },
        { $set: newMessage },
      );
      logger.info(`${result.modifiedCount} documents were updated`);
      if (result.modifiedCount === 0) {
        logger.info('No documents were updated');
      } else {
        const notification = buildMessage(existingMedals, newMessage);
        if (notification) {
          logger.info(notification);
          await producer.send({
            topic: producerTopicName,
            messages: [{ value: notification }],
          });
        }
      }
    } else {
      const result = await collection.insertOne(
        JSON.parse(message.value.toString()),
      );
      logger.info(`A document was inserted with the _id: ${result.insertedId}`);
    }
  },
});

/**
 * Returns a message based on the result of the update operation.
 *
 * @param {UpdateResult<import("mongodb").Document>} result - The result of the update operation.
 * @param {import("mongodb").WithId<import("mongodb").Document>} oldMedals - The medals document.
 * @param {import("mongodb").WithId<import("mongodb").Document>} newMedals - The new medals document.
 *
 * @returns {string} The message based on the result of the update operation.
 */
function buildMessage(oldMedals, newMedals) {
  // TODO: Make unit test to refactor using the new medals objects from Next Data

  let message = '';

  const allOldMedals = oldMedals.total;
  const allNewMedals = newMedals.total;

  const medalsGained = allNewMedals.total - allOldMedals.total;
  if (medalsGained < 0) {
    logger.error("Medals lost or no change, this shouldn't happen");
    return '';
  }
  message += `🏅 Médailles gagnées pour la ${countryNames[newMedals.country]} ${flags[newMedals.country]}: ${medalsGained}\n\n`;
  if (allNewMedals.gold > allOldMedals.gold) {
    const goldMedalsGained = allNewMedals.gold - allOldMedals.gold;
    message += `🥇 Médailles d'or gagnées: ${goldMedalsGained}\n\n`;
  }
  if (allNewMedals.silver > allOldMedals.silver) {
    const silverMedalsGained = allNewMedals.silver - allOldMedals.silver;
    message += `🥈 Médailles d'argent gagnées: ${silverMedalsGained}\n\n`;
  }
  if (allNewMedals.bronze > allOldMedals.bronze) {
    const bronzeMedalsGained = allNewMedals.bronze - allOldMedals.bronze;
    message += `🥉 Médailles de bronze gagnées: ${bronzeMedalsGained}\n\n`;
  }

  // Here find the diff by Discipline
  const medalsByDiscipline = newMedals.byDiscipline;

  medalsByDiscipline.forEach((discipline) => {
    const oldDiscipline = oldMedals.byDiscipline.find(
      (oldDiscipline) => oldDiscipline.name === discipline.name,
    );
    if (oldDiscipline) {
      const medalsGained =
        discipline.winners.length - oldDiscipline.winners.length;
      if (medalsGained > 0) {
        message += `- ${discipline.name}: ${medalsGained} médaille(s)\n`;
      }
    } else {
      message += `- ${discipline.name}: ${discipline.winners.length} médaille(s)\n`;
    }
  });

  message += `\nTotal de médailles gagnées: ${allNewMedals.total}\n`;
  message += `\nTotal de médailles d'or: ${allNewMedals.gold}\n`;
  message += `Total de médailles d'argent: ${allNewMedals.silver}\n`;
  message += `Total de médailles de bronze: ${allNewMedals.bronze}\n`;
  message += `\n Voir le détail des médailles sur https://olympics.com/en/paris-2024/medals/france\n`;

  return message;
}

const countryNames = {
  FRA: 'France',
  POL: 'Poland',
};

const flags = {
  FRA: '🇫🇷',
  POL: '🇵🇱',
};
