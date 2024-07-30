import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPath = path.resolve(__dirname, 'combined.log');

function createLogger(serviceName) {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return stack
          ? `${timestamp} [${level}] [${serviceName}]: ${message}\n${stack}`
          : `${timestamp} [${level}] [${serviceName}]: ${message}`;
      }),
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: logPath }),
    ],
  });

  return logger;
}

export default createLogger;
