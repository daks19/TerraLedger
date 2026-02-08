export declare class IPFSService {
    private pinataApiKey;
    private pinataSecretKey;
    private pinataApiUrl;
    private gateway;
    constructor();
    /**
     * Upload file to IPFS via Pinata
     */
    uploadFile(fileBuffer: Buffer, fileName: string, metadata?: Record<string, string>): Promise<{
        hash: string;
        size: number;
    }>;
    /**
     * Upload JSON data to IPFS
     */
    uploadJSON(data: Record<string, any>, name: string): Promise<{
        hash: string;
        size: number;
    }>;
    /**
     * Get content from IPFS
     */
    getContent(hash: string): Promise<any>;
    /**
     * Get IPFS gateway URL for a hash
     */
    getGatewayUrl(hash: string): string;
    /**
     * Pin an existing IPFS hash to Pinata
     */
    pinHash(hash: string, name?: string): Promise<boolean>;
    /**
     * Unpin a hash from Pinata
     */
    unpinHash(hash: string): Promise<boolean>;
    /**
     * Upload GeoJSON boundaries
     */
    uploadBoundaries(geoJSON: object, parcelId: string): Promise<string>;
    uploadBoundary(parcelId: string, geoJSON: object): Promise<string>;
    unpinContent(hash: string): Promise<boolean>;
    /**
     * Upload document with encryption (placeholder)
     */
    uploadEncryptedDocument(fileBuffer: Buffer, fileName: string, encryptionKey?: string): Promise<{
        hash: string;
        encryptedKey?: string;
    }>;
}
//# sourceMappingURL=ipfs.d.ts.map