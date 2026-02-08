export declare class BlockchainService {
    private provider;
    private wallet;
    private landRegistry;
    private escrowContract;
    private inheritanceManager;
    private landBoundary;
    private readonly rpcUrl;
    constructor();
    private safeRpcUrlForLog;
    private isSimulationEnabled;
    private simulateTxHash;
    private shouldSimulateForError;
    registerParcel(parcelId: string, owner: string, areaSqM: number, surveyNumber: string, village: string, district: string, state: string, boundaryHash: string, ipfsDocHash: string): Promise<string>;
    listParcelForSale(parcelId: string, price: string): Promise<string>;
    getParcel(parcelId: string): Promise<any>;
    createEscrow(parcelId: string, seller: string, amount: string): Promise<number>;
    fundEscrow(escrowId: number, amount: string): Promise<string>;
    sellerApprove(escrowId: number): Promise<string>;
    governmentApprove(escrowId: number): Promise<string>;
    createInheritancePlan(parcelIds: string[], useAgeMilestones: boolean): Promise<number>;
    addHeir(planId: number, wallet: string, percentage: number, releaseAge: number, birthDate: number): Promise<string>;
    triggerInheritance(planId: number, deathCertHash: string): Promise<string>;
    fileDispute(parcelId: string, affectedParcelIds: string[], description: string, evidenceHash: string): Promise<number>;
    resolveDispute(disputeId: number, resolution: string, resolutionDetails: string, newBoundaryHash: string): Promise<string>;
    private getResolutionType;
    verifySignature(message: string, signature: string, expectedAddress: string): Promise<boolean>;
    getBalance(address: string): Promise<string>;
    getCurrentBlock(): Promise<number>;
    estimateGas(contractMethod: () => Promise<any>): Promise<bigint>;
}
//# sourceMappingURL=blockchain.d.ts.map