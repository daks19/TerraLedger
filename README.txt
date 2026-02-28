# TerraLedger

<p align="center">
	<img src="apps/web/public/assests_own/logo.webp" alt="TerraLedger Logo" width="200"/>
</p>
<p align="center">
	<strong>Secure, transparent, and efficient land ownership management powered by blockchain technology</strong>
</p>

## Overview

TerraLedger is a web application for recording and managing land ownership using a hybrid blockchain architecture. Authoritative ownership records and key events are stored on-chain (Solidity smart contracts), while large documents and spatial data are handled off-chain (IPFS and PostgreSQL with PostGIS).

The system includes:
- **Next.js frontend** for map-based interaction and form workflows
- **Node.js + Express backend** powered by Prisma for API and database operations
- **Solidity smart contracts** (developed with Hardhat) for parcel registration, ownership transfers, and basic inheritance flows

## Purpose

Prototype secure parcel registration and tamper-resistant on-chain ownership records.

## Tech Stack

- Next.js
- Node.js (Express)
- Prisma
- PostgreSQL (+ PostGIS)
- Redis
- IPFS
- Solidity (Hardhat)
- Docker

## Core Concepts

- Store authoritative ownership pointers and events on-chain
- Keep large documents in IPFS
- Store spatial boundary data in PostGIS for efficient querying

## Main Features

- Parcel registration with metadata and optional IPFS document links
- Complete ownership history tracking with an escrow-style transfer pattern
- Basic inheritance plan prototype (conditional transfers)
- Boundary storage in GeoJSON format with PostGIS-enabled spatial queries

## Architecture

- **Frontend:** Next.js (App Router) with React components for maps and forms
- **Backend:** Node.js + Express with Prisma for API/database
- **Database:** PostgreSQL with PostGIS for spatial indexing/queries
- **Off-chain files:** IPFS for document storage (only hashes in DB)
- **Smart contracts:** Solidity, tested with Hardhat

## 📜 Smart Contracts

| Contract              | Description                                   |
|----------------------|-----------------------------------------------|
| AccessControl.sol    | Role management and permission control        |
| LandRegistry.sol     | Parcel registration and ownership tracking    |
| EscrowContract.sol   | Secure ownership transfer using escrow logic  |
| InheritanceManager.sol | Prototype inheritance logic (conditional transfers) |
| LandBoundary.sol     | Boundary storage, validation, and dispute handling |

## Getting Started

### 1. Copy the environment file and update values

```bash
cp .env.example .env
```

### 2. Start PostgreSQL and Redis locally

```bash
docker-compose up -d postgres redis
```

### 3. Run database migrations and seed initial data

```bash
cd apps/backend
npx prisma migrate dev --name init
node prisma/seed.js
```

### 4. Running locally

- Backend: `cd apps/backend && pnpm dev`
- Frontend: `cd apps/web && pnpm dev`

## Testing

- Contract tests: `cd packages/contracts && npx hardhat test`
- Backend tests: `cd apps/backend && pnpm test`
