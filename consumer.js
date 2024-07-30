import { Kafka } from 'kafkajs';
import { MongoClient } from 'mongodb';
import 'dotenv/config';
import createLogger from './logger.js';

const logger = createLogger('consumer');

// MongoDB setup
const mongoUri = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const client = new MongoClient(mongoUri);
const dbName = 'olympicsDB';
const collectionName = 'medals';

await client.connect();
const db = client.db(dbName);
const collection = db.collection(collectionName);

const kafkaUrl = process.env.KAFKA_URL ?? 'localhost:9092';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [kafkaUrl],
});

const consumer = kafka.consumer({ groupId: 'olympics' });

await consumer.connect();
await consumer.subscribe({ topic: 'olympics', fromBeginning: true });

const producer = kafka.producer();

await producer.connect();

await consumer.run({
  eachMessage: async ({ _topic, _partition, message }) => {
    const medals = JSON.parse(message.value.toString());
    logger.info(`New value: ${JSON.stringify(medals)}`);
    const fraMedals = await collection.findOne({ country: 'FRA' });
    if (fraMedals) {
      logger.info(`Old value: ${JSON.stringify(fraMedals)}`);
      const result = await collection.updateOne(
        { country: 'FRA' },
        { $set: medals },
      );
      logger.info(`${result.modifiedCount} documents were updated`);
      if (result.modifiedCount === 0) {
        logger.info('No documents were updated');
      } else {
        const message = buildMessage(fraMedals, medals);
        if (message) {
          logger.info(message);
          await producer.send({
            topic: 'olympics-updates',
            messages: [{ value: message }],
          });
        }
      }
    } else {
      const result = await collection.insertOne(
        JSON.parse(message.value.toString()),
      );
      logger.info(
        `A document were inserted with the _id: ${result.insertedId}`,
      );
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
  let medalsGained = 0;
  let goldMedalsGained = 0;
  let silverMedalsGained = 0;
  let bronzeMedalsGained = 0;
  let message = 'Nouvelles médailles pour la France! 🏅🇫🇷\n\n';
  const allOldMedals = oldMedals.medals;
  const allNewMedals = newMedals.medals;
  const country = oldMedals.country;
  logger.info(country, allOldMedals);
  logger.info(country, allNewMedals);
  const newTotalMedals = allNewMedals.total;
  const oldTotalMedals = allOldMedals.total;
  medalsGained = newTotalMedals - oldTotalMedals;
  if (medalsGained < 0) {
    logger.error("Medals lost or no change, this shouldn't happen");
    return '';
  }
  if (allNewMedals.gold > allOldMedals.gold) {
    goldMedalsGained = allNewMedals.gold - allOldMedals.gold;
    message += `🥇 Médailles d'or gagnées: ${goldMedalsGained}\n`;
  }
  if (allNewMedals.silver > allOldMedals.silver) {
    silverMedalsGained = allNewMedals.silver - allOldMedals.silver;
    message += `🥈 Médailles d'argent gagnées: ${silverMedalsGained}\n`;
  }
  if (allNewMedals.bronze > allOldMedals.bronze) {
    bronzeMedalsGained = allNewMedals.bronze - allOldMedals.bronze;
    message += `🥉 Médailles de bronze gagnées: ${bronzeMedalsGained}\n`;
  }

  message += `\nTotal de médailles gagnées: ${allNewMedals.total}\n`;
  message += `\nTotal de médailles d'or: ${allNewMedals.gold}\n`;
  message += `Total de médailles d'argent: ${allNewMedals.silver}\n`;
  message += `Total de médailles de bronze: ${allNewMedals.bronze}\n`;
  message += `\n Voir le détail des médailles sur https://olympics.com/en/paris-2024/medals/france\n`;

  return message;
}
