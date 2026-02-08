import { logger } from './logger';

/**
 * Validate that all required environment variables are set
 * Fail fast on startup if configuration is missing
 */
export function validateEnvironment(): void {
  const required = {
    // Database
    DATABASE_URL: process.env.DATABASE_URL,
    
    // JWT Secrets
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  const missing: string[] = [];
  const weak: string[] = [];

  // Check for missing variables
  for (const [key, value] of Object.entries(required)) {
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  // Check for weak/default secrets in production
  if (process.env.NODE_ENV === 'production') {
    const weakPatterns = ['your-', 'change-', 'secret', 'password123', 'test'];
    
    if (process.env.JWT_SECRET) {
      const secret = process.env.JWT_SECRET.toLowerCase();
      if (secret.length < 32 || weakPatterns.some(pattern => secret.includes(pattern))) {
        weak.push('JWT_SECRET (too short or uses default value)');
      }
    }
    
    if (process.env.JWT_REFRESH_SECRET) {
      const secret = process.env.JWT_REFRESH_SECRET.toLowerCase();
      if (secret.length < 32 || weakPatterns.some(pattern => secret.includes(pattern))) {
        weak.push('JWT_REFRESH_SECRET (too short or uses default value)');
      }
    }
  }

  // Report findings
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:');
    missing.forEach(key => logger.error(`   - ${key}`));
    logger.error('\nCopy .env.example to .env and fill in the values.');
    // Don't process.exit in serverless - throw error instead
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (weak.length > 0) {
    logger.error('❌ Weak or default environment variables detected in production:');
    weak.forEach(key => logger.error(`   - ${key}`));
    logger.error('\nGenerate strong secrets: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    // Don't process.exit in serverless - throw error instead
    throw new Error(`Weak environment variables: ${weak.join(', ')}`);
  }

  // Warnings for optional but recommended variables
  const warnings: string[] = [];
  
  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL not set - caching disabled');
  }
  
  if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
    warnings.push('IPFS/Pinata not configured - document storage may not work');
  }
  
  if (!process.env.BLOCKCHAIN_RPC_URL) {
    warnings.push('BLOCKCHAIN_RPC_URL not set - will use default');
  }

  if (warnings.length > 0) {
    logger.warn('⚠️  Optional configuration warnings:');
    warnings.forEach(warning => logger.warn(`   - ${warning}`));
  }

  logger.info('✅ Environment validation passed');
}
