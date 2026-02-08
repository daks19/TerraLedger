"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeDefs = void 0;
exports.typeDefs = `#graphql
  # Enums
  enum UserRole {
    LAND_OWNER
    BUYER
    GOVERNMENT_OFFICIAL
    SURVEYOR
    NOTARY
    ADMIN
  }

  enum KYCStatus {
    PENDING
    VERIFIED
    REJECTED
  }

  enum ParcelStatus {
    ACTIVE
    TRANSFERRED
    DISPUTED
    INACTIVE
  }

  enum TransactionStatus {
    PENDING
    FUNDED
    VERIFIED
    COMPLETED
    FAILED
    REFUNDED
    CANCELLED
  }

  enum DisputeStatus {
    OPEN
    UNDER_REVIEW
    EVIDENCE_PHASE
    RESOLVED
    REJECTED
    APPEALED
  }

  enum InheritancePlanStatus {
    ACTIVE
    TRIGGERED
    EXECUTING
    COMPLETED
    CANCELLED
  }

  # User types
  type User {
    id: ID!
    walletAddress: String!
    email: String
    phone: String
    name: String
    roles: [UserRole!]!
    kycStatus: KYCStatus!
    twoFactorEnabled: Boolean!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
    ownedParcels: [LandParcel!]
    inheritancePlans: [InheritancePlan!]
  }

  type AuthPayload {
    token: String!
    refreshToken: String!
    user: User!
  }

  # Land Parcel types
  type LandParcel {
    id: ID!
    parcelId: String!
    owner: User!
    surveyNumber: String!
    areaSqM: Float!
    village: String!
    district: String!
    state: String!
    boundaryHash: String
    ipfsDocHash: String
    price: String
    isForSale: Boolean!
    status: ParcelStatus!
    blockchainTxHash: String
    createdAt: String!
    updatedAt: String!
    transactions: [Transaction!]
    disputes: [Dispute!]
    previousOwners: [ParcelOwnerHistory!]
    auditEntries: [AuditLog!]
  }

  type ParcelOwnerHistory {
    id: ID!
    ownerWallet: String!
    fromDate: String!
    toDate: String
    txHash: String
  }

  type GeoJSON {
    type: String!
    coordinates: [[Float!]!]!
  }

  # Transaction types
  type Transaction {
    id: ID!
    escrowId: Int
    parcel: LandParcel!
    seller: User!
    buyer: User!
    amount: String!
    platformFee: String
    status: TransactionStatus!
    sellerApproved: Boolean!
    buyerApproved: Boolean!
    govtApproved: Boolean!
    documentsHash: String
    blockchainHash: String
    deadline: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
  }

  # Dispute types
  type Dispute {
    id: ID!
    disputeId: Int
    parcel: LandParcel!
    filer: User!
    affectedParcelIds: [String!]
    description: String!
    evidenceHash: String
    additionalEvidence: [String!]
    status: DisputeStatus!
    resolutionType: String
    resolutionDetails: String
    resolvedBy: String
    resolvedAt: String
    createdAt: String!
    surveyReport: SurveyReport
  }

  type SurveyReport {
    id: ID!
    surveyor: User!
    licenseNumber: String!
    reportHash: String!
    signature: String!
    isValid: Boolean!
    verifiedAt: String
    createdAt: String!
  }

  # Inheritance types
  type InheritancePlan {
    id: ID!
    planId: Int
    owner: User!
    parcelIds: [String!]!
    willHash: String
    deathCertHash: String
    status: InheritancePlanStatus!
    useAgeMilestones: Boolean!
    triggeredAt: String
    completedAt: String
    createdAt: String!
    heirs: [Heir!]
    milestones: [ReleaseMilestone!]
  }

  type Heir {
    id: ID!
    user: User!
    walletAddress: String!
    percentage: Int!
    releaseAge: Int
    birthDate: String
    hasClaimed: Boolean!
    claimedAt: String
  }

  type ReleaseMilestone {
    id: ID!
    age: Int!
    percentage: Int!
  }

  # Audit types
  type AuditLog {
    id: ID!
    parcel: LandParcel
    user: User!
    action: String!
    details: String
    txHash: String
    createdAt: String!
  }

  # Document types
  type Document {
    id: ID!
    name: String!
    type: String!
    ipfsHash: String!
    size: Int!
    mimeType: String!
    createdAt: String!
  }

  # Search & Filter types
  input ParcelFilter {
    district: String
    village: String
    status: ParcelStatus
    isForSale: Boolean
    minArea: Float
    maxArea: Float
    minPrice: String
    maxPrice: String
  }

  input TransactionFilter {
    status: TransactionStatus
    parcelId: String
    sellerId: String
    buyerId: String
  }

  type ParcelSearchResult {
    parcels: [LandParcel!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type DashboardStats {
    totalParcels: Int!
    activeParcels: Int!
    disputedParcels: Int!
    totalTransactions: Int!
    pendingTransactions: Int!
    completedTransactions: Int!
    totalUsers: Int!
    verifiedUsers: Int!
  }

  # Input types
  input RegisterUserInput {
    walletAddress: String!
    email: String
    phone: String
    name: String
    role: UserRole!
    signature: String!
  }

  input RegisterParcelInput {
    surveyNumber: String!
    areaSqM: Float!
    village: String!
    district: String!
    state: String!
    latitude: Float!
    longitude: Float!
    boundaryGeoJSON: String!
    documentsHash: String
  }

  input UpdateParcelInput {
    price: String
    isForSale: Boolean
    documentsHash: String
  }

  input CreateTransactionInput {
    parcelId: String!
    amount: String!
  }

  input CreateDisputeInput {
    parcelId: String!
    affectedParcelIds: [String!]
    description: String!
    evidenceHash: String
  }

  input CreateInheritancePlanInput {
    parcelIds: [String!]!
    useAgeMilestones: Boolean
  }

  input AddHeirInput {
    planId: String!
    walletAddress: String!
    percentage: Int!
    releaseAge: Int
    birthDate: String
  }

  input AddMilestoneInput {
    planId: String!
    age: Int!
    percentage: Int!
  }

  # Queries
  type Query {
    # User queries
    me: User
    user(id: ID!): User
    userByWallet(walletAddress: String!): User
    users(role: UserRole, kycStatus: KYCStatus, limit: Int, offset: Int): [User!]!

    # Parcel queries
    parcel(id: ID!): LandParcel
    parcelByParcelId(parcelId: String!): LandParcel
    parcelBySurveyNumber(surveyNumber: String!): LandParcel
    parcels(filter: ParcelFilter, limit: Int, offset: Int): ParcelSearchResult!
    searchParcels(query: String!, limit: Int): [LandParcel!]!
    myParcels: [LandParcel!]!
    parcelHistory(parcelId: String!): [AuditLog!]!

    # Transaction queries
    transaction(id: ID!): Transaction
    transactions(filter: TransactionFilter, limit: Int, offset: Int): [Transaction!]!
    myTransactions: [Transaction!]!

    # Dispute queries
    dispute(id: ID!): Dispute
    disputes(status: DisputeStatus, limit: Int, offset: Int): [Dispute!]!
    parcelDisputes(parcelId: String!): [Dispute!]!

    # Inheritance queries
    inheritancePlan(id: ID!): InheritancePlan
    myInheritancePlan: InheritancePlan
    inheritancePlansAsHeir: [InheritancePlan!]!
    checkHeirEligibility(planId: String!): HeirEligibility

    # Map queries
    parcelBoundaries(parcelId: String!): GeoJSON
    parcelsInBounds(minLat: Float!, minLng: Float!, maxLat: Float!, maxLng: Float!): [LandParcel!]!

    # Dashboard
    dashboardStats: DashboardStats!
  }

  type HeirEligibility {
    isHeir: Boolean!
    hasClaimed: Boolean!
    percentage: Int!
    claimablePercentage: Int!
    releaseAge: Int
    currentAge: Int
  }

  # Mutations
  type Mutation {
    # Auth mutations
    register(input: RegisterUserInput!): AuthPayload!
    login(walletAddress: String!, signature: String!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    enable2FA: TwoFactorSetup!
    verify2FA(code: String!): Boolean!
    disable2FA(code: String!): Boolean!
    logout: Boolean!

    # KYC mutations
    submitKYC(documentType: String!, documentHash: String!): User!
    verifyKYC(userId: String!, status: KYCStatus!, notes: String): User!

    # Parcel mutations
    registerParcel(input: RegisterParcelInput!): LandParcel!
    updateParcel(parcelId: String!, input: UpdateParcelInput!): LandParcel!
    listParcelForSale(parcelId: String!, price: String!): LandParcel!
    unlistParcel(parcelId: String!): LandParcel!
    updateBoundaries(parcelId: String!, boundaryGeoJSON: String!): LandParcel!

    # Transaction mutations
    createTransaction(input: CreateTransactionInput!): Transaction!
    fundTransaction(transactionId: String!): Transaction!
    approveTransaction(transactionId: String!): Transaction!
    cancelTransaction(transactionId: String!, reason: String!): Transaction!
    uploadTransactionDocuments(transactionId: String!, documentsHash: String!): Transaction!

    # Dispute mutations
    fileDispute(input: CreateDisputeInput!): Dispute!
    submitEvidence(disputeId: String!, evidenceHash: String!): Dispute!
    submitSurveyReport(disputeId: String!, reportHash: String!, signature: String!): Dispute!
    resolveDispute(disputeId: String!, resolution: String!, details: String!, newBoundaryHash: String): Dispute!

    # Inheritance mutations
    createInheritancePlan(input: CreateInheritancePlanInput!): InheritancePlan!
    addHeir(input: AddHeirInput!): InheritancePlan!
    removeHeir(planId: String!, heirId: String!): InheritancePlan!
    addMilestone(input: AddMilestoneInput!): InheritancePlan!
    uploadWill(planId: String!, willHash: String!): InheritancePlan!
    triggerInheritance(planId: String!, deathCertHash: String!): InheritancePlan!
    claimInheritance(planId: String!): InheritancePlan!
    cancelInheritancePlan(planId: String!): InheritancePlan!
  }

  type TwoFactorSetup {
    secret: String!
    qrCode: String!
  }

  # Subscriptions
  type Subscription {
    transactionUpdated(transactionId: String!): Transaction!
    parcelStatusChanged(parcelId: String!): LandParcel!
    newDisputeFiled(parcelId: String!): Dispute!
    inheritanceTriggered(planId: String!): InheritancePlan!
  }
`;
//# sourceMappingURL=schema.js.map