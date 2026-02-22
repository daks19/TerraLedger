# TerraLedger

<p align="center">
  <img src="apps/web/public/assests_own/logo.webp" alt="TerraLedger Logo" width="200"/>
</p>

<p align="center">
  <strong>Secure, transparent, and efficient land ownership management powered by blockchain technology</strong>
</p>

TerraLedger is a web-application that record and manage land ownership using a hybrid approach: authoritative references and events live on-chain (Solidity contracts) while large documents and spatial queries stay off-chain (IPFS + Postgres/PostGIS). It includes a Next.js frontend for map-based UI and forms, a Node.js + Prisma backend for APIs and database access, and Solidity contracts (Hardhat) that model parcel registration, transfers, and simple inheritance flows.

Purpose: Prototype parcel registration and safe on-chain ownership records.

Tech used: Next.js, Node.js (Express), Prisma + PostgreSQL (+ PostGIS), Redis, IPFS, Solidity (Hardhat), Docker.

Details:
- Core idea: store authoritative ownership pointers on-chain while keeping large documents off-chain (IPFS) and spatial queries in PostGIS.
- Primary flows included: register parcel, upload evidence, initiate transfer, accept transfer. Each flow includes on-chain events and off-chain records.

Main features

- Parcel registration with metadata and optional document links.
- Ownership history and simple transfer escrow pattern.
- Inheritance plans (basic prototype) to demonstrate conditional transfers.
- Boundary storage as GeoJSON and PostGIS-enabled queries.

Architecture notes

- Frontend: Next.js (app router) with React components for map and forms.
- Backend: Node.js + Express + Prisma for API and DB access.
- Database: PostgreSQL with PostGIS for spatial queries and indexes.
- Off-chain files: IPFS for document storage; only content-addressed links are stored in DB.
- Contracts: Solidity, developed and tested with Hardhat (local network + scripts).

## 📜 Smart Contracts

| Contract | Description |
|----------|-------------|
| `AccessControl.sol` | Role-based access, KYC, multi-sig operations |
| `LandRegistry.sol` | Land parcel registration, ownership, sale listing |
| `EscrowContract.sol` | Multi-signature escrow for property transfers |
| `InheritanceManager.sol` | Inheritance planning with milestones |
| `LandBoundary.sol` | GPS boundary management, dispute handling |


Environment & quick config

1. Copy env example and adjust values:

```bash
cp .env.example .env
```

2. Start Postgres + Redis locally (docker-compose):

```bash
docker-compose up -d postgres redis
```

3. Migrate DB and seed minimal data:

```bash
cd apps/backend
npx prisma migrate dev --name init
node prisma/seed.js
```

Running locally

- Backend: `cd apps/backend && pnpm dev`
- Frontend: `cd apps/web && pnpm dev`
- Optional Hardhat node: `cd packages/contracts && npx hardhat node`

Testing

- Contract tests: `cd packages/contracts && npx hardhat test`
- Backend tests: `cd apps/backend && pnpm test`
