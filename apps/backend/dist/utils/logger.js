"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
}));
const logLevel = process.env.LOG_LEVEL || 'info';
// Determine transports based on environment
const transports = [
    // Console output (always available)
    new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), logFormat),
    }),
];
// Only add file transports in non-serverless environments
// Vercel serverless functions have a read-only filesystem
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    try {
        transports.push(new winston_1.default.transports.File({
            filename: path_1.default.join('logs', 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        }), new winston_1.default.transports.File({
            filename: path_1.default.join('logs', 'combined.log'),
            maxsize: 5242880,
            maxFiles: 5,
        }));
    }
    catch {
        // Silently skip file transports if filesystem is not writable
    }
}
exports.logger = winston_1.default.createLogger({
    level: logLevel,
    format: logFormat,
    transports,
});
// Add HTTP stream for morgan
exports.logger.http = (message) => {
    exports.logger.log('http', message);
    return exports.logger;
};
//# sourceMappingURL=logger.js.map