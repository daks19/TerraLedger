import { PrismaClient, UserRole, KYCStatus, ParcelStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo government official user
  const adminPassword = await bcrypt.hash('password123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'terraadmin@terraledger.com' },
    update: { passwordHash: adminPassword },
    create: {
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      email: 'terraadmin@terraledger.com',
      phone: '9000000001',
      name: 'Government Admin',
      passwordHash: adminPassword,
      roles: [UserRole.GOVERNMENT_OFFICIAL, UserRole.ADMIN],
      kycStatus: KYCStatus.VERIFIED,
      isActive: true,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // Create demo land owner
  const userPassword = await bcrypt.hash('user1234', 12);
  const landOwner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: { passwordHash: userPassword },
    create: {
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      email: 'owner@example.com',
      phone: '9000000002',
      name: 'Rajesh Kumar',
      passwordHash: userPassword,
      roles: [UserRole.LAND_OWNER],
      kycStatus: KYCStatus.VERIFIED,
      isActive: true,
    },
  });
  console.log(`✅ Land owner: ${landOwner.email}`);

  // Create demo land parcels
  const parcels = [
    {
      parcelId: 'TL-MH-001',
      surveyNumber: 'SRV/2024/001',
      areaSqM: 5000,
      village: 'Andheri East',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      latitude: 19.1136,
      longitude: 72.8697,
      boundaryHash: 'QmXk7VNp1U4DnLHk7z1b4pDRKQFwfEtJ5yL3c8pWnN9qM2',
      ipfsDocHash: 'QmR7TxYg9Dp3Q2zKp3m1hVfMk8UjN2cE5wL6nB4xPsC9A7',
      blockchainTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
    {
      parcelId: 'TL-MH-002',
      surveyNumber: 'SRV/2024/002',
      areaSqM: 2500,
      village: 'Powai',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      latitude: 19.1176,
      longitude: 72.9060,
      boundaryHash: 'QmYk8VNp2U5DnLHk8z2b5pDRKQGwfEuJ6yL4c9pWnN0rM3',
      ipfsDocHash: 'QmS8TxYg0Ep4Q3zKp4m2hVgMk9UjN3cE6wL7nB5xPsD0B8',
      blockchainTxHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    {
      parcelId: 'TL-KA-001',
      surveyNumber: 'SRV/2023/105',
      areaSqM: 10000,
      village: 'Whitefield',
      district: 'Bangalore Urban',
      state: 'Karnataka',
      latitude: 12.9698,
      longitude: 77.7500,
      boundaryHash: 'QmZk9VNp3U6DnLHk9z3b6pDRKQHwfEvJ7yL5c0pWnN1sM4',
      ipfsDocHash: 'QmT9TxYg1Fp5Q4zKp5m3hVhMk0UjN4cE7wL8nB6xPsE1C9',
      blockchainTxHash: '0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234',
    },
    {
      parcelId: 'TL-DL-001',
      surveyNumber: 'SRV/2024/050',
      areaSqM: 3000,
      village: 'Dwarka',
      district: 'South West Delhi',
      state: 'Delhi',
      latitude: 28.5921,
      longitude: 77.0460,
      boundaryHash: 'QmAk0VNp4U7DnLHk0z4b7pDRKQIwfEwJ8yL6c1pWnN2tM5',
      ipfsDocHash: 'QmU0TxYg2Gp6Q5zKp6m4hViMk1UjN5cE8wL9nB7xPsF2D0',
      blockchainTxHash: '0x890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
    },
  ];

  for (const parcel of parcels) {
    const created = await prisma.landParcel.upsert({
      where: { parcelId: parcel.parcelId },
      update: {},
      create: {
        ...parcel,
        ownerId: landOwner.id,
        status: ParcelStatus.ACTIVE,
      },
    });
    console.log(`✅ Parcel: ${created.parcelId} - ${created.village}, ${created.district}`);
  }

  // Create ownership history entries
  const ownershipHistory = (prisma as any).ownershipHistory;
  if (!ownershipHistory) {
    console.warn('⚠️ Skipping ownership history seed: Prisma model "OwnershipHistory" is not available on this PrismaClient.');
  } else {
    for (const parcel of parcels) {
      const dbParcel = await prisma.landParcel.findUnique({ where: { parcelId: parcel.parcelId } });
      if (dbParcel) {
        await ownershipHistory.upsert({
          where: {
            parcelId_timestamp: {
              parcelId: dbParcel.id,
              timestamp: new Date('2024-01-15'),
            },
          },
          update: {},
          create: {
            parcelId: dbParcel.id,
            previousOwnerId: landOwner.id,
            newOwnerId: landOwner.id,
            transactionHash: parcel.blockchainTxHash,
            timestamp: new Date('2024-01-15'),
          },
        });
      }
    }
    console.log(`✅ Ownership history created`);
  }

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Admin: terraadmin@terraledger.com / password123');
  console.log('   User:  owner@example.com / user1234');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
