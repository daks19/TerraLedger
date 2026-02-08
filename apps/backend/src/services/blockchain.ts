import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Import ABIs (would be generated from contracts)
const LandRegistryABI = [
  "function registerParcel(string parcelId, address owner, uint256 areaSqM, string surveyNumber, string village, string district, string state, string boundaryHash, string ipfsDocHash) external",
  "function listForSale(string parcelId, uint256 price) external",
  "function unlistFromSale(string parcelId) external",
  "function getParcel(string parcelId) external view returns (tuple(string parcelId, address owner, uint256 areaSqM, string surveyNumber, string village, string district, string state, string boundaryHash, string ipfsDocHash, uint256 price, uint8 status, uint256 registeredAt, uint256 lastUpdatedAt, bool isForSale))",
  "function transferOwnership(string parcelId, address newOwner, uint256 amount) external",
  "function flagDispute(string parcelId, string reason) external",
  "function resolveDispute(string parcelId, string resolution) external",
  "event ParcelRegistered(string indexed parcelId, address indexed owner, uint256 areaSqM, string surveyNumber, uint256 timestamp)",
  "event OwnershipTransferred(string indexed parcelId, address indexed previousOwner, address indexed newOwner, uint256 amount, uint256 timestamp)",
];

const EscrowContractABI = [
  "function createEscrow(string parcelId, address seller, uint256 amount) external returns (uint256)",
  "function fundEscrow(uint256 escrowId) external payable",
  "function sellerApprove(uint256 escrowId) external",
  "function governmentApprove(uint256 escrowId) external",
  "function refundBuyer(uint256 escrowId) external",
  "function getEscrow(uint256 escrowId) external view returns (tuple(uint256 escrowId, string parcelId, address seller, address buyer, uint256 amount, uint256 platformFee, uint8 status, uint256 createdAt, uint256 completedAt, bool sellerApproved, bool buyerApproved, bool governmentApproved, string documentsHash, uint256 deadline))",
  "event EscrowCreated(uint256 indexed escrowId, string parcelId, address indexed seller, address indexed buyer, uint256 amount, uint256 timestamp)",
  "event EscrowCompleted(uint256 indexed escrowId, address indexed seller, address indexed buyer, uint256 amount, uint256 timestamp)",
];

const InheritanceManagerABI = [
  "function createPlan(string[] parcelIds, bool useAgeMilestones) external returns (uint256)",
  "function addHeir(uint256 planId, address wallet, uint256 percentage, uint256 releaseAge, uint256 birthDate) external",
  "function triggerInheritance(uint256 planId, string deathCertHash) external",
  "function claimInheritance(uint256 planId) external",
  "function uploadWill(uint256 planId, string willHash) external",
  "function getPlan(uint256 planId) external view returns (tuple(uint256 planId, address owner, string[] parcelIds, uint8 status, string willHash, string deathCertHash, uint256 createdAt, uint256 triggeredAt, bool useAgeMilestones))",
  "event PlanCreated(uint256 indexed planId, address indexed owner, string[] parcelIds, uint256 timestamp)",
  "event InheritanceTriggered(uint256 indexed planId, string deathCertHash, address indexed triggeredBy, uint256 timestamp)",
];

const LandBoundaryABI = [
  "function fileDispute(string parcelId, string[] affectedParcelIds, string description, string evidenceHash) external returns (uint256)",
  "function submitEvidence(uint256 disputeId, string evidenceHash) external",
  "function resolveDispute(uint256 disputeId, uint8 resolution, string resolutionDetails, string newBoundaryHash) external",
  "function getDispute(uint256 disputeId) external view returns (tuple(uint256 disputeId, string parcelId, address disputant, uint8 status, string description, uint256 filedAt, uint256 resolvedAt, uint8 resolution))",
  "event DisputeFiled(uint256 indexed disputeId, string parcelId, address indexed disputant, string description, uint256 timestamp)",
  "event DisputeResolved(uint256 indexed disputeId, uint8 resolution, address indexed resolvedBy, uint256 timestamp)",
];

dotenv.config();

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Signer;
  private landRegistry: ethers.Contract;
  private escrowContract: ethers.Contract;
  private inheritanceManager: ethers.Contract;
  private landBoundary: ethers.Contract;
  private readonly rpcUrl: string;

  constructor() {
    const rpcUrl =
      process.env.BLOCKCHAIN_RPC_URL ||
      process.env.RPC_URL ||
      process.env.POLYGON_RPC_URL ||
      'https://rpc-mumbai.maticvigil.com/';

    this.rpcUrl = rpcUrl;

    logger.info(`Blockchain RPC configured: ${this.safeRpcUrlForLog(rpcUrl)}`);

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey || privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      logger.warn('No valid private key configured. Blockchain operations will be simulated.');
      this.wallet = ethers.Wallet.createRandom().connect(this.provider);
    } else {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    }

    // Initialize contracts with addresses from env
    this.landRegistry = new ethers.Contract(
      process.env.LAND_REGISTRY_ADDRESS || ethers.ZeroAddress,
      LandRegistryABI,
      this.wallet
    );

    this.escrowContract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS || ethers.ZeroAddress,
      EscrowContractABI,
      this.wallet
    );

    this.inheritanceManager = new ethers.Contract(
      process.env.INHERITANCE_MANAGER_ADDRESS || ethers.ZeroAddress,
      InheritanceManagerABI,
      this.wallet
    );

    this.landBoundary = new ethers.Contract(
      process.env.LAND_BOUNDARY_ADDRESS || ethers.ZeroAddress,
      LandBoundaryABI,
      this.wallet
    );
  }

  private safeRpcUrlForLog(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  }

  private isSimulationEnabled(): boolean {
    if (process.env.SIMULATE_BLOCKCHAIN === 'true') return true;
    return process.env.NODE_ENV !== 'production';
  }

  private simulateTxHash(): string {
    // 0x + 64 hex chars; recognizable prefix for downstream (very low collision risk)
    const randomSuffix = ethers.hexlify(ethers.randomBytes(28)).slice(2); // 56 hex chars
    return `0xdeadbeef${randomSuffix}`;
  }

  private shouldSimulateForError(error: any): boolean {
    if (!this.isSimulationEnabled()) return false;

    const code = (error?.code ?? '') as string;
    const message = String(error?.message ?? '').toLowerCase();

    // Network/RPC connectivity
    if (
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      message.includes('econnrefused') ||
      message.includes('connect') && message.includes('refused') ||
      message.includes('timeout') ||
      message.includes('failed to fetch') ||
      message.includes('socket')
    ) {
      return true;
    }

    // Common dev/testnet problems
    if (message.includes('insufficient funds')) return true;
    if (message.includes('replacement fee too low')) return true;
    if (message.includes('nonce has already been used')) return true;
    if (message.includes('could not coalesce error')) return true;
    if (message.includes('missing revert data') && message.includes('call exception')) return true;

    return false;
  }

  // Land Registry Functions
  async registerParcel(
    parcelId: string,
    owner: string,
    areaSqM: number,
    surveyNumber: string,
    village: string,
    district: string,
    state: string,
    boundaryHash: string,
    ipfsDocHash: string
  ): Promise<string> {
    try {
      if (this.landRegistry.target === ethers.ZeroAddress) {
        logger.info('Simulating parcel registration');
        return this.simulateTxHash();
      }

      if (!ethers.isAddress(owner)) {
        logger.warn(`Invalid owner address for parcel ${parcelId}. Simulating registration.`);
        return this.simulateTxHash();
      }

      const tx = await this.landRegistry.registerParcel(
        parcelId,
        owner,
        areaSqM,
        surveyNumber,
        village,
        district,
        state,
        boundaryHash,
        ipfsDocHash
      );
      const receipt = await tx.wait();
      logger.info(`Parcel registered: ${parcelId}, tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain registerParcel failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return this.simulateTxHash();
      }

      logger.error('Error registering parcel:', error);
      throw error;
    }
  }

  async listParcelForSale(parcelId: string, price: string): Promise<string> {
    try {
      if (this.landRegistry.target === ethers.ZeroAddress) {
        logger.info('Simulating listing parcel for sale');
        return this.simulateTxHash();
      }

      const tx = await this.landRegistry.listForSale(parcelId, price);
      const receipt = await tx.wait();
      logger.info(`Parcel listed for sale: ${parcelId}, price: ${price}`);
      return receipt.hash;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain listParcelForSale failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return this.simulateTxHash();
      }

      logger.error('Error listing parcel:', error);
      throw error;
    }
  }

  async getParcel(parcelId: string): Promise<any> {
    try {
      if (this.landRegistry.target === ethers.ZeroAddress) {
        return null;
      }
      return await this.landRegistry.getParcel(parcelId);
    } catch (error) {
      logger.error('Error getting parcel:', error);
      throw error;
    }
  }

  // Escrow Functions
  async createEscrow(parcelId: string, seller: string, amount: string): Promise<number> {
    try {
      if (this.escrowContract.target === ethers.ZeroAddress) {
        logger.info('Simulating escrow creation');
        return Math.floor(Date.now() / 1000);
      }

      if (!ethers.isAddress(seller)) {
        logger.warn(`Invalid seller address for escrow on parcel ${parcelId}. Simulating escrow creation.`);
        return Math.floor(Date.now() / 1000);
      }

      const tx = await this.escrowContract.createEscrow(parcelId, seller, amount);
      const receipt = await tx.wait();
      
      // Parse escrow ID from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.escrowContract.interface.parseLog(log);
          return parsed?.name === 'EscrowCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.escrowContract.interface.parseLog(event);
        return Number(parsed?.args.escrowId);
      }

      logger.info(`Escrow created for parcel: ${parcelId}`);
      return 0;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain createEscrow failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return Math.floor(Date.now() / 1000);
      }

      logger.error('Error creating escrow:', error);
      throw error;
    }
  }

  async fundEscrow(escrowId: number, amount: string): Promise<string> {
    try {
      if (this.escrowContract.target === ethers.ZeroAddress) {
        logger.info('Simulating escrow funding');
        return this.simulateTxHash();
      }

      const tx = await this.escrowContract.fundEscrow(escrowId, { value: amount });
      const receipt = await tx.wait();
      logger.info(`Escrow funded: ${escrowId}`);
      return receipt.hash;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain fundEscrow failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return this.simulateTxHash();
      }

      logger.error('Error funding escrow:', error);
      throw error;
    }
  }

  async sellerApprove(escrowId: number): Promise<string> {
    try {
      if (this.escrowContract.target === ethers.ZeroAddress) {
        logger.info('Simulating seller approval');
        return this.simulateTxHash();
      }

      const tx = await this.escrowContract.sellerApprove(escrowId);
      const receipt = await tx.wait();
      logger.info(`Seller approved escrow: ${escrowId}`);
      return receipt.hash;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain sellerApprove failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return this.simulateTxHash();
      }

      logger.error('Error in seller approval:', error);
      throw error;
    }
  }

  async governmentApprove(escrowId: number): Promise<string> {
    try {
      if (this.escrowContract.target === ethers.ZeroAddress) {
        logger.info('Simulating government approval');
        return this.simulateTxHash();
      }

      const tx = await this.escrowContract.governmentApprove(escrowId);
      const receipt = await tx.wait();
      logger.info(`Government approved escrow: ${escrowId}`);
      return receipt.hash;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain governmentApprove failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return this.simulateTxHash();
      }

      logger.error('Error in government approval:', error);
      throw error;
    }
  }

  // Inheritance Functions
  async createInheritancePlan(parcelIds: string[], useAgeMilestones: boolean): Promise<number> {
    try {
      if (this.inheritanceManager.target === ethers.ZeroAddress) {
        logger.info('Simulating inheritance plan creation');
        return Math.floor(Date.now() / 1000);
      }

      const tx = await this.inheritanceManager.createPlan(parcelIds, useAgeMilestones);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.inheritanceManager.interface.parseLog(log);
          return parsed?.name === 'PlanCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.inheritanceManager.interface.parseLog(event);
        return Number(parsed?.args.planId);
      }

      return 0;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain createInheritancePlan failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return Math.floor(Date.now() / 1000);
      }

      logger.error('Error creating inheritance plan:', error);
      throw error;
    }
  }

  async addHeir(
    planId: number,
    wallet: string,
    percentage: number,
    releaseAge: number,
    birthDate: number
  ): Promise<string> {
    try {
      if (this.inheritanceManager.target === ethers.ZeroAddress) {
        logger.info('Simulating adding heir');
        return this.simulateTxHash();
      }

      if (!ethers.isAddress(wallet)) {
        logger.warn(`Invalid heir wallet address for plan ${planId}. Simulating addHeir.`);
        return this.simulateTxHash();
      }

      const tx = await this.inheritanceManager.addHeir(
        planId,
        wallet,
        percentage,
        releaseAge,
        birthDate
      );
      const receipt = await tx.wait();
      logger.info(`Heir added to plan ${planId}: ${wallet}`);
      return receipt.hash;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain addHeir failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return this.simulateTxHash();
      }

      logger.error('Error adding heir:', error);
      throw error;
    }
  }

  async triggerInheritance(planId: number, deathCertHash: string): Promise<string> {
    try {
      if (this.inheritanceManager.target === ethers.ZeroAddress) {
        logger.info('Simulating inheritance trigger');
        return this.simulateTxHash();
      }

      const tx = await this.inheritanceManager.triggerInheritance(planId, deathCertHash);
      const receipt = await tx.wait();
      logger.info(`Inheritance triggered for plan: ${planId}`);
      return receipt.hash;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain triggerInheritance failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return this.simulateTxHash();
      }

      logger.error('Error triggering inheritance:', error);
      throw error;
    }
  }

  // Dispute Functions
  async fileDispute(
    parcelId: string,
    affectedParcelIds: string[],
    description: string,
    evidenceHash: string
  ): Promise<number> {
    try {
      if (this.landBoundary.target === ethers.ZeroAddress) {
        logger.info('Simulating dispute filing');
        return Math.floor(Date.now() / 1000);
      }

      const tx = await this.landBoundary.fileDispute(
        parcelId,
        affectedParcelIds,
        description,
        evidenceHash
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.landBoundary.interface.parseLog(log);
          return parsed?.name === 'DisputeFiled';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.landBoundary.interface.parseLog(event);
        return Number(parsed?.args.disputeId);
      }

      return 0;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain fileDispute failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return Math.floor(Date.now() / 1000);
      }

      logger.error('Error filing dispute:', error);
      throw error;
    }
  }

  async resolveDispute(
    disputeId: number,
    resolution: string,
    resolutionDetails: string,
    newBoundaryHash: string
  ): Promise<string> {
    try {
      if (this.landBoundary.target === ethers.ZeroAddress) {
        logger.info('Simulating dispute resolution');
        return this.simulateTxHash();
      }

      const resolutionType = this.getResolutionType(resolution);
      const tx = await this.landBoundary.resolveDispute(
        disputeId,
        resolutionType,
        resolutionDetails,
        newBoundaryHash
      );
      const receipt = await tx.wait();
      logger.info(`Dispute resolved: ${disputeId}`);
      return receipt.hash;
    } catch (error) {
      if (this.shouldSimulateForError(error)) {
        logger.warn(`Blockchain resolveDispute failed (${this.safeRpcUrlForLog(this.rpcUrl)}). Simulating.`, error);
        return this.simulateTxHash();
      }

      logger.error('Error resolving dispute:', error);
      throw error;
    }
  }

  private getResolutionType(resolution: string): number {
    const types: Record<string, number> = {
      'BOUNDARY_ADJUSTED': 0,
      'NO_CHANGE': 1,
      'SPLIT': 2,
      'MERGED': 3,
    };
    return types[resolution] || 1;
  }

  // Utility Functions
  async verifySignature(message: string, signature: string, expectedAddress: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      logger.error('Error verifying signature:', error);
      return false;
    }
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async getCurrentBlock(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  async estimateGas(contractMethod: () => Promise<any>): Promise<bigint> {
    try {
      const gas = await contractMethod();
      return gas;
    } catch (error) {
      logger.error('Error estimating gas:', error);
      throw error;
    }
  }
}
