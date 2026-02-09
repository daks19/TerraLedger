import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export class IPFSService {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataApiUrl: string;
  private gateway: string;

  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.PINATA_SECRET_API_KEY || '';
    this.pinataApiUrl = process.env.IPFS_API_URL || 'https://api.pinata.cloud';
    this.gateway = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

    if (this.pinataApiKey && this.pinataSecretKey) {
      logger.info('IPFS service initialized with Pinata credentials');
    } else {
      logger.warn('Pinata credentials not configured. IPFS operations will be simulated.');
    }
  }

  /**
   * Upload file to IPFS via Pinata
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    metadata?: Record<string, string>
  ): Promise<{ hash: string; size: number }> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        logger.info('Simulating IPFS upload');
        const contentHash = require('crypto').createHash('sha256').update(fileBuffer).update(Date.now().toString()).digest('base64url').substring(0, 44);
        return {
          hash: `Qm${contentHash}`,
          size: fileBuffer.length,
        };
      }

      const formData = new FormData();
      const blob = new Blob([fileBuffer]);
      formData.append('file', blob, fileName);

      if (metadata) {
        formData.append('pinataMetadata', JSON.stringify({
          name: fileName,
          keyvalues: metadata,
        }));
      }

      const response = await fetch(`${this.pinataApiUrl}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Pinata upload failed: ${response.statusText}`);
      }

      const result = await response.json() as PinataResponse;
      logger.info(`File uploaded to IPFS: ${result.IpfsHash}`);

      return {
        hash: result.IpfsHash,
        size: result.PinSize,
      };
    } catch (error) {
      logger.error('Error uploading to IPFS:', error);
      throw error;
    }
  }

  /**
   * Upload JSON data to IPFS
   */
  async uploadJSON(
    data: Record<string, any>,
    name: string
  ): Promise<{ hash: string; size: number }> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        logger.info('Simulating IPFS JSON upload');
        const jsonStr = JSON.stringify(data);
        const contentHash = require('crypto').createHash('sha256').update(jsonStr).update(Date.now().toString()).digest('base64url').substring(0, 44);
        return {
          hash: `Qm${contentHash}`,
          size: jsonStr.length,
        };
      }

      const response = await fetch(`${this.pinataApiUrl}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey,
        },
        body: JSON.stringify({
          pinataContent: data,
          pinataMetadata: { name },
        }),
      });

      if (!response.ok) {
        throw new Error(`Pinata JSON upload failed: ${response.statusText}`);
      }

      const result = await response.json() as PinataResponse;
      logger.info(`JSON uploaded to IPFS: ${result.IpfsHash}`);

      return {
        hash: result.IpfsHash,
        size: result.PinSize,
      };
    } catch (error) {
      logger.error('Error uploading JSON to IPFS:', error);
      throw error;
    }
  }

  /**
   * Get content from IPFS
   */
  async getContent(hash: string): Promise<any> {
    try {
      const response = await fetch(`${this.gateway}/${hash}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      
      return await response.blob();
    } catch (error) {
      logger.error('Error fetching from IPFS:', error);
      throw error;
    }
  }

  /**
   * Get IPFS gateway URL for a hash
   */
  getGatewayUrl(hash: string): string {
    return `${this.gateway}/${hash}`;
  }

  /**
   * Pin an existing IPFS hash to Pinata
   */
  async pinHash(hash: string, name?: string): Promise<boolean> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        logger.info('Simulating IPFS pinning');
        return true;
      }

      const response = await fetch(`${this.pinataApiUrl}/pinning/pinByHash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey,
        },
        body: JSON.stringify({
          hashToPin: hash,
          pinataMetadata: name ? { name } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Pinata pin failed: ${response.statusText}`);
      }

      logger.info(`Hash pinned: ${hash}`);
      return true;
    } catch (error) {
      logger.error('Error pinning to IPFS:', error);
      throw error;
    }
  }

  /**
   * Unpin a hash from Pinata
   */
  async unpinHash(hash: string): Promise<boolean> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        logger.info('Simulating IPFS unpinning');
        return true;
      }

      const response = await fetch(`${this.pinataApiUrl}/pinning/unpin/${hash}`, {
        method: 'DELETE',
        headers: {
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Pinata unpin failed: ${response.statusText}`);
      }

      logger.info(`Hash unpinned: ${hash}`);
      return true;
    } catch (error) {
      logger.error('Error unpinning from IPFS:', error);
      throw error;
    }
  }

  /**
   * Upload GeoJSON boundaries
   */
  async uploadBoundaries(geoJSON: object, parcelId: string): Promise<string> {
    const result = await this.uploadJSON(
      {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { parcelId },
          geometry: geoJSON,
        }],
      },
      `boundaries-${parcelId}`
    );
    return result.hash;
  }

  // Backwards-compatible alias used by some routes
  async uploadBoundary(parcelId: string, geoJSON: object): Promise<string> {
    return this.uploadBoundaries(geoJSON, parcelId);
  }

  // Backwards-compatible alias used by some routes
  async unpinContent(hash: string): Promise<boolean> {
    return this.unpinHash(hash);
  }

  /**
   * Upload document with encryption (placeholder)
   */
  async uploadEncryptedDocument(
    fileBuffer: Buffer,
    fileName: string,
    encryptionKey?: string
  ): Promise<{ hash: string; encryptedKey?: string }> {
    // In production, implement AES-256 encryption here
    // For now, just upload the file
    const result = await this.uploadFile(fileBuffer, fileName);
    return {
      hash: result.hash,
      encryptedKey: encryptionKey,
    };
  }
}
