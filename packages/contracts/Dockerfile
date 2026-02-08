FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY packages/contracts/package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY packages/contracts ./

# Expose Hardhat node port
EXPOSE 8545

# Start Hardhat node
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
