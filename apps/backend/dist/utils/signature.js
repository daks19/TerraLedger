"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWalletSignature = verifyWalletSignature;
exports.shouldSkipSignatureVerification = shouldSkipSignatureVerification;
const ethers_1 = require("ethers");
const logger_1 = require("./logger");
/**
 * Verify that a signature was created by the claimed wallet address
 * This prevents users from registering/logging in as someone else's wallet
 */
async function verifyWalletSignature(walletAddress, signature, message) {
    try {
        // Default message that should be signed by the wallet
        const defaultMessage = `Sign this message to authenticate with TerraLedger.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
        const messageToVerify = message || defaultMessage;
        // Recover the address from the signature
        const recoveredAddress = ethers_1.ethers.verifyMessage(messageToVerify, signature);
        // Compare recovered address with claimed address (case-insensitive)
        const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
        if (!isValid) {
            logger_1.logger.warn(`Signature verification failed: claimed=${walletAddress}, recovered=${recoveredAddress}`);
        }
        return isValid;
    }
    catch (error) {
        logger_1.logger.error('Signature verification error:', error);
        return false;
    }
}
/**
 * For development/demo mode - skip signature verification
 * WARNING: Never use this in production!
 */
function shouldSkipSignatureVerification() {
    return process.env.NODE_ENV === 'development' || process.env.SKIP_SIGNATURE_VERIFICATION === 'true';
}
//# sourceMappingURL=signature.js.map