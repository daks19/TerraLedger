import winston from 'winston';
import path from 'path';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

const logLevel = process.env.LOG_LEVEL || 'info';

// Determine transports based on environment
const transports: winston.transport[] = [
  // Console output (always available)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
  }),
];

// Only add file transports in non-serverless environments
// Vercel serverless functions have a read-only filesystem
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  try {
    transports.push(
      new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join('logs', 'combined.log'),
        maxsize: 5242880,
        maxFiles: 5,
      })
    );
  } catch {
    // Silently skip file transports if filesystem is not writable
  }
}

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
});

// Add HTTP stream for morgan
(logger as any).http = (message: string) => {
  logger.log('http', message);
  return logger;
};
