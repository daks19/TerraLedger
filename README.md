# TerraLedger - Blockchain-Based Land Registry System

<p align="center">
  <img src="apps/web/public/assests_own/logo.webp" alt="TerraLedger Logo" width="200"/>
</p>

<p align="center">
  <strong>Secure, transparent, and efficient land ownership management powered by blockchain technology</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#api-documentation">API Docs</a>
</p>

---

## 🌟 Features

### User Authentication & Authorization
- Multi-factor authentication (Email + TOTP)
- Role-based access control (Admin, Government Official, Land Owner, Buyer, Surveyor, Notary)
- KYC verification workflow
- Wallet-based authentication with signature verification

### Land Record Management
- Digital land registration with unique Parcel IDs
- Document storage on IPFS
- Complete ownership history and audit trails
- Support for property listing marketplace

### Ownership Transfer
- Multi-signature escrow transactions
- Government verification workflow
- Secure fund management
- Platform fee handling

### Inheritance Management
- Create inheritance plans with multiple heirs
- Percentage-based allocation
- Age-based release milestones
- Death certificate verification triggers

### Boundary & Dispute Resolution
- GPS coordinate validation
- Surveyor digital signatures
- Boundary dispute filing with evidence
- Overlap detection system

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│    Dashboard │ Property Map │ Transactions │ Inheritance        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (Node.js)                       │
│     GraphQL │ REST API │ Auth │ File Upload │ WebSocket         │
└─────────────────────────────────────────────────────────────────┘
                    │                    │
         ┌──────────┴──────────┐        │
         ▼                     ▼        ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │    Redis    │  │      IPFS       │
│   + PostGIS     │  │   (Cache)   │  │   (Documents)   │
└─────────────────┘  └─────────────┘  └─────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Blockchain (Polygon)                          │
│  LandRegistry │ EscrowContract │ InheritanceManager │ Boundary  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+ with PostGIS
- Redis 7+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/terraledger.git
   cd terraledger
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development services**
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Run database migrations**
   ```bash
   cd apps/backend
   npx prisma migrate dev
   ```

6. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd apps/backend && pnpm dev

   # Terminal 2 - Frontend
   cd apps/web && pnpm dev

   # Terminal 3 - Hardhat node
   cd packages/contracts && npx hardhat node
   ```

7. **Deploy contracts (local)**
   ```bash
   cd packages/contracts
   npx hardhat run scripts/deploy.js --network localhost
   ```

## 📦 Project Structure

```
terraledger/
├── apps/
│   ├── backend/           # Node.js/Express API
│   │   ├── src/
│   │   │   ├── graphql/   # GraphQL schema & resolvers
│   │   │   ├── routes/    # REST API routes
│   │   │   ├── services/  # Business logic
│   │   │   ├── middleware/# Auth, validation
│   │   │   └── utils/     # Helpers
│   │   └── prisma/        # Database schema
│   │
│   └── web/               # Next.js frontend
│       ├── src/
│       │   ├── app/       # App router pages
│       │   └── components/# React components
│       └── public/        # Static assets
│
├── packages/
│   └── contracts/         # Solidity smart contracts
│       ├── contracts/     # Contract source files
│       └── scripts/       # Deployment scripts
│
└── k8s/                   # Kubernetes manifests
```

## 📜 Smart Contracts

| Contract | Description |
|----------|-------------|
| `AccessControl.sol` | Role-based access, KYC, multi-sig operations |
| `LandRegistry.sol` | Land parcel registration, ownership, sale listing |
| `EscrowContract.sol` | Multi-signature escrow for property transfers |
| `InheritanceManager.sol` | Inheritance planning with milestones |
| `LandBoundary.sol` | GPS boundary management, dispute handling |

### Contract Deployment

```bash
# Deploy to local Hardhat
npx hardhat run scripts/deploy.js --network localhost

# Deploy to Polygon Mumbai
npx hardhat run scripts/deploy.js --network polygon_mumbai

# Deploy to Polygon Mainnet
npx hardhat run scripts/deploy.js --network polygon_mainnet
```

## 🔌 API Documentation

### GraphQL Endpoint
```
POST /graphql
```

### REST Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/refresh` | Refresh tokens |
| POST | `/api/auth/2fa/setup` | Setup 2FA |
| POST | `/api/auth/2fa/verify` | Verify 2FA code |

#### Land Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/land/:parcelId` | Get parcel details |
| POST | `/api/land/register` | Register new parcel |
| POST | `/api/land/transfer` | Initiate transfer |
| GET | `/api/land/search` | Search parcels |

#### Inheritance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/inheritance/setup` | Create plan |
| POST | `/api/inheritance/trigger` | Trigger distribution |
| POST | `/api/inheritance/claim` | Claim inheritance |

## 🐳 Docker Deployment

```bash
# Development
docker-compose up -d

# Production build
docker-compose -f docker-compose.prod.yml up -d
```

## ☸️ Kubernetes Deployment

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n terraledger

# View logs
kubectl logs -f deployment/backend -n terraledger
```

## 🧪 Testing

```bash
# Run contract tests
cd packages/contracts
npx hardhat test

# Run backend tests
cd apps/backend
pnpm test

# Run frontend tests
cd apps/web
pnpm test
```

## 🔒 Security

- All sensitive data encrypted at rest and in transit
- JWT tokens with short expiry and refresh mechanism
- Rate limiting on all API endpoints
- SQL injection prevention via Prisma ORM
- XSS protection with Content Security Policy
- CORS properly configured for production

## 📊 Monitoring

- Health check endpoints at `/health`
- Prometheus metrics at `/metrics`
- Structured logging with Winston
- Error tracking with Sentry (optional)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenZeppelin](https://openzeppelin.com/) for secure contract libraries
- [Hardhat](https://hardhat.org/) for Ethereum development
- [Prisma](https://prisma.io/) for database management
- [Next.js](https://nextjs.org/) for the React framework
- [Leaflet](https://leafletjs.com/) for interactive maps

---

<p align="center">
  Built with ❤️ for transparent land ownership
</p>
