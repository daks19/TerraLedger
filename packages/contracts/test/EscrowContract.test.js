const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowContract", function () {
  let escrowContract;
  let accessControl;
  let landRegistry;
  let owner;
  let government;
  let seller;
  let buyer;

  const parcelId = "TL-MH-001";
  const escrowAmount = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, government, seller, buyer] = await ethers.getSigners();

    // Deploy AccessControl
    const AccessControl = await ethers.getContractFactory("AccessControl");
    accessControl = await AccessControl.deploy();
    await accessControl.waitForDeployment();

    // Deploy LandRegistry
    const LandRegistry = await ethers.getContractFactory("LandRegistry");
    landRegistry = await LandRegistry.deploy(await accessControl.getAddress());
    await landRegistry.waitForDeployment();

    // Deploy EscrowContract
    const EscrowContract = await ethers.getContractFactory("EscrowContract");
    escrowContract = await EscrowContract.deploy(
      await accessControl.getAddress(),
      await landRegistry.getAddress()
    );
    await escrowContract.waitForDeployment();

    // Setup roles
    await accessControl.grantRole(
      await accessControl.GOVERNMENT_ROLE(),
      government.address
    );
    await accessControl.grantRole(
      await accessControl.LAND_OWNER_ROLE(),
      seller.address
    );
    await accessControl.grantRole(
      await accessControl.BUYER_ROLE(),
      buyer.address
    );

    // Verify KYC
    await accessControl.connect(government).verifyKYC(seller.address);
    await accessControl.connect(government).verifyKYC(buyer.address);

    // Register a parcel
    await landRegistry.connect(government).registerParcel(
      parcelId,
      "SRV/2024/001",
      "Andheri",
      "Mumbai",
      "Maharashtra",
      5000,
      seller.address,
      "QmTestHash"
    );

    // List for sale
    await landRegistry.connect(seller).listForSale(parcelId, escrowAmount);
  });

  describe("Escrow Creation", function () {
    it("Should create escrow with correct amount", async function () {
      await expect(
        escrowContract.connect(buyer).createEscrow(parcelId, { value: escrowAmount })
      )
        .to.emit(escrowContract, "EscrowCreated");

      const escrow = await escrowContract.getEscrow(parcelId);
      expect(escrow.buyer).to.equal(buyer.address);
      expect(escrow.seller).to.equal(seller.address);
      expect(escrow.amount).to.equal(escrowAmount);
      expect(escrow.status).to.equal(0); // PENDING
    });

    it("Should not create escrow with insufficient funds", async function () {
      await expect(
        escrowContract.connect(buyer).createEscrow(parcelId, {
          value: ethers.parseEther("5") // Less than listing price
        })
      ).to.be.revertedWith("Insufficient escrow amount");
    });

    it("Should not create escrow for unlisted parcel", async function () {
      await landRegistry.connect(seller).unlistFromSale(parcelId);

      await expect(
        escrowContract.connect(buyer).createEscrow(parcelId, { value: escrowAmount })
      ).to.be.revertedWith("Parcel not for sale");
    });
  });

  describe("Escrow Approval", function () {
    beforeEach(async function () {
      await escrowContract.connect(buyer).createEscrow(parcelId, { value: escrowAmount });
    });

    it("Should allow seller to approve", async function () {
      await expect(
        escrowContract.connect(seller).approveEscrow(parcelId)
      )
        .to.emit(escrowContract, "EscrowApproved")
        .withArgs(parcelId, seller.address);

      const escrow = await escrowContract.getEscrow(parcelId);
      expect(escrow.sellerApproved).to.be.true;
    });

    it("Should allow buyer to approve", async function () {
      await expect(
        escrowContract.connect(buyer).approveEscrow(parcelId)
      )
        .to.emit(escrowContract, "EscrowApproved")
        .withArgs(parcelId, buyer.address);

      const escrow = await escrowContract.getEscrow(parcelId);
      expect(escrow.buyerApproved).to.be.true;
    });

    it("Should allow government to approve", async function () {
      await expect(
        escrowContract.connect(government).governmentApprove(parcelId)
      )
        .to.emit(escrowContract, "EscrowApproved")
        .withArgs(parcelId, government.address);

      const escrow = await escrowContract.getEscrow(parcelId);
      expect(escrow.governmentApproved).to.be.true;
    });

    it("Should not allow unauthorized approval", async function () {
      const [, , , , randomUser] = await ethers.getSigners();
      await expect(
        escrowContract.connect(randomUser).approveEscrow(parcelId)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Escrow Completion", function () {
    beforeEach(async function () {
      await escrowContract.connect(buyer).createEscrow(parcelId, { value: escrowAmount });
      await escrowContract.connect(seller).approveEscrow(parcelId);
      await escrowContract.connect(buyer).approveEscrow(parcelId);
      await escrowContract.connect(government).governmentApprove(parcelId);
    });

    it("Should complete escrow and transfer ownership", async function () {
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

      await expect(
        escrowContract.connect(government).completeEscrow(parcelId)
      ).to.emit(escrowContract, "EscrowCompleted");

      // Check ownership transferred
      const parcel = await landRegistry.getParcel(parcelId);
      expect(parcel.owner).to.equal(buyer.address);

      // Check seller received funds (minus platform fee)
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter).to.be.gt(sellerBalanceBefore);

      // Check escrow status
      const escrow = await escrowContract.getEscrow(parcelId);
      expect(escrow.status).to.equal(1); // COMPLETED
    });

    it("Should not complete without all approvals", async function () {
      // Create new escrow
      await landRegistry.connect(government).registerParcel(
        "TL-MH-002",
        "SRV/2024/002",
        "Bandra",
        "Mumbai",
        "Maharashtra",
        3000,
        seller.address,
        "QmTestHash2"
      );
      await landRegistry.connect(seller).listForSale("TL-MH-002", escrowAmount);
      await escrowContract.connect(buyer).createEscrow("TL-MH-002", { value: escrowAmount });
      // Only seller approves
      await escrowContract.connect(seller).approveEscrow("TL-MH-002");

      await expect(
        escrowContract.connect(government).completeEscrow("TL-MH-002")
      ).to.be.revertedWith("Not all parties approved");
    });
  });

  describe("Escrow Refund", function () {
    beforeEach(async function () {
      await escrowContract.connect(buyer).createEscrow(parcelId, { value: escrowAmount });
    });

    it("Should refund buyer on cancellation", async function () {
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      await escrowContract.connect(seller).cancelEscrow(parcelId);

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalanceAfter).to.be.gt(buyerBalanceBefore);

      const escrow = await escrowContract.getEscrow(parcelId);
      expect(escrow.status).to.equal(2); // REFUNDED
    });

    it("Should allow buyer to cancel", async function () {
      await expect(
        escrowContract.connect(buyer).cancelEscrow(parcelId)
      ).to.emit(escrowContract, "EscrowRefunded");
    });
  });
});
