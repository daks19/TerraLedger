# TerraLedger - Quick Start (Working UI)

## 🚀 Get It Running (5 Minutes)

### 1. Set Up Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env - MINIMUM REQUIRED:
# DATABASE_URL=postgresql://terraledger:terraledger_secret@localhost:5432/terraledger
# JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
# JWT_REFRESH_SECRET=<generate again>
# SKIP_SIGNATURE_VERIFICATION=true  # For demo/dev only!
```

### 2. Start Services
```bash
# Option A: Docker Compose (Easiest)
docker-compose up -d postgres redis
cd apps/backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev

# In another terminal:
cd apps/web  
npm install
npm run dev
```

**Open:** http://localhost:3000

**Demo Login:**
- Admin: `terraadmin@terraledger.com` / `password123`
- User: `owner@example.com` / `user1234`

### 3. What Works Now
✅ Full UI with emerald theme, glows, animations
✅ User authentication (email/password)
✅ Dashboard with property listings
✅ Admin approval queue
✅ Property details pages
✅ Unique wallet address enforcement
✅ Map view
✅ Transaction history
✅ Inheritance planning

### 4. What's Not Done (Finish Later)
- ⚠️ Wallet signature verification (currently skipped in dev mode)
- ⚠️ IPFS/Pinata integration (needs API keys)
- ⚠️ Blockchain contract deployment (needs setup)
- ⚠️ Production secrets (using dev defaults)

### 5. Environment Variables Needed Later

**For IPFS (Document Storage):**
```
PINATA_API_KEY=your-key
PINATA_SECRET_KEY=your-secret
```

**For Blockchain:**
```
BLOCKCHAIN_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/your-api-key
PRIVATE_KEY=0x...
```

**Deploy Contracts:**
```bash
cd packages/contracts
npm install
npx hardhat run scripts/deploy.js --network mumbai
# Copy contract addresses to .env
```

---

## 🎯 Current Status

**Working:**
- ✅ Backend API with authentication
- ✅ Database with migrations
- ✅ Frontend UI (complete)
- ✅ Validation & error handling
- ✅ Docker configs ready

**Skipped (Dev Mode):**
- Wallet signature checks (set `SKIP_SIGNATURE_VERIFICATION=true`)
- IPFS uploads (optional for testing)
- Blockchain transactions (simulated)

**To Production:**
1. Generate real JWT secrets
2. Add Pinata keys
3. Deploy smart contracts
4. Remove `SKIP_SIGNATURE_VERIFICATION`
5. Set `NODE_ENV=production`

---

## 📝 Quick Commands

```bash
# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Reset database
cd apps/backend
npx prisma migrate reset
npx prisma db seed

# Build for production
docker-compose up -d --build

# Check health
curl http://localhost:4000/health
```

---

**Status: ✅ UI is working and ready for demos!**
