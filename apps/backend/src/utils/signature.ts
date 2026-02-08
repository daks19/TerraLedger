import { ethers } from 'ethers';
import { logger } from './logger';

/**
 * Verify that a signature was created by the claimed wallet address
 * This prevents users from registering/logging in as someone else's wallet
 */
export async function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  message?: string
): Promise<boolean> {
  try {
    // Default message that should be signed by the wallet
    const defaultMessage = `Sign this message to authenticate with TerraLedger.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
    const messageToVerify = message || defaultMessage;

    // Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(messageToVerify, signature);

    // Compare recovered address with claimed address (case-insensitive)
    const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

    if (!isValid) {
      logger.warn(`Signature verification failed: claimed=${walletAddress}, recovered=${recoveredAddress}`);
    }

    return isValid;
  } catch (error) {
    logger.error('Signature verification error:', error);
    return false;
  }
}

/**
 * For development/demo mode - skip signature verification
 * WARNING: Never use this in production!
 */
export function shouldSkipSignatureVerification(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.SKIP_SIGNATURE_VERIFICATION === 'true';
}
