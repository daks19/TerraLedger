/**
 * Verify that a signature was created by the claimed wallet address
 * This prevents users from registering/logging in as someone else's wallet
 */
export declare function verifyWalletSignature(walletAddress: string, signature: string, message?: string): Promise<boolean>;
/**
 * For development/demo mode - skip signature verification
 * WARNING: Never use this in production!
 */
export declare function shouldSkipSignatureVerification(): boolean;
//# sourceMappingURL=signature.d.ts.map