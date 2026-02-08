const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LandRegistry", function () {
  let landRegistry;
  let accessControl;
  let owner;
  let government;
  let landOwner;
  let buyer;

  beforeEach(async function () {
    [owner, government, landOwner, buyer] = await ethers.getSigners();

    // Deploy AccessControl
    const AccessControl = await ethers.getContractFactory("AccessControl");
    accessControl = await AccessControl.deploy();
    await accessControl.waitForDeployment();

    // Deploy LandRegistry
    const LandRegistry = await ethers.getContractFactory("LandRegistry");
    landRegistry = await LandRegistry.deploy(await accessControl.getAddress());
    await landRegistry.waitForDeployment();

    // Setup roles
    await accessControl.grantRole(
      await accessControl.GOVERNMENT_ROLE(),
      government.address
    );
    await accessControl.grantRole(
      await accessControl.LAND_OWNER_ROLE(),
      landOwner.address
    );
    await accessControl.grantRole(
      await accessControl.BUYER_ROLE(),
      buyer.address
    );

    // Verify KYC for land owner
    await accessControl.connect(government).verifyKYC(landOwner.address);
  });

  describe("Land Registration", function () {
    it("Should register a new land parcel", async function () {
      const parcelId = "TL-MH-001";
      const surveyNumber = "SRV/2024/001";
      const village = "Andheri";
      const district = "Mumbai";
      const state = "Maharashtra";
      const areaSqM = 5000;
      const boundaryHash = "QmTestBoundaryHash";

      await expect(
        landRegistry.connect(government).registerParcel(
          parcelId,
          surveyNumber,
          village,
          district,
          state,
          areaSqM,
          landOwner.address,
          boundaryHash
        )
      )
        .to.emit(landRegistry, "ParcelRegistered")
        .withArgs(parcelId, landOwner.address, areaSqM);

      const parcel = await landRegistry.getParcel(parcelId);
      expect(parcel.owner).to.equal(landOwner.address);
      expect(parcel.surveyNumber).to.equal(surveyNumber);
      expect(parcel.areaSqM).to.equal(areaSqM);
      expect(parcel.status).to.equal(0); // ACTIVE
    });

    it("Should not allow non-government to register parcel", async function () {
      await expect(
        landRegistry.connect(landOwner).registerParcel(
          "TL-MH-001",
          "SRV/2024/001",
          "Andheri",
          "Mumbai",
          "Maharashtra",
          5000,
          landOwner.address,
          "QmTestHash"
        )
      ).to.be.revertedWith("Caller is not authorized");
    });

    it("Should not register parcel for non-KYC verified user", async function () {
      await expect(
        landRegistry.connect(government).registerParcel(
          "TL-MH-001",
          "SRV/2024/001",
          "Andheri",
          "Mumbai",
          "Maharashtra",
          5000,
          buyer.address, // Not KYC verified
          "QmTestHash"
        )
      ).to.be.revertedWith("Owner not KYC verified");
    });

    it("Should not register duplicate parcel ID", async function () {
      await landRegistry.connect(government).registerParcel(
        "TL-MH-001",
        "SRV/2024/001",
        "Andheri",
        "Mumbai",
        "Maharashtra",
        5000,
        landOwner.address,
        "QmTestHash"
      );

      await expect(
        landRegistry.connect(government).registerParcel(
          "TL-MH-001", // Same parcel ID
          "SRV/2024/002",
          "Bandra",
          "Mumbai",
          "Maharashtra",
          3000,
          landOwner.address,
          "QmTestHash2"
        )
      ).to.be.revertedWith("Parcel already exists");
    });
  });

  describe("Sale Listing", function () {
    beforeEach(async function () {
      await landRegistry.connect(government).registerParcel(
        "TL-MH-001",
        "SRV/2024/001",
        "Andheri",
        "Mumbai",
        "Maharashtra",
        5000,
        landOwner.address,
        "QmTestHash"
      );
    });

    it("Should list parcel for sale", async function () {
      const price = ethers.parseEther("10");

      await expect(
        landRegistry.connect(landOwner).listForSale("TL-MH-001", price)
      )
        .to.emit(landRegistry, "ParcelListed")
        .withArgs("TL-MH-001", price);

      const parcel = await landRegistry.getParcel("TL-MH-001");
      expect(parcel.isForSale).to.be.true;
      expect(parcel.price).to.equal(price);
    });

    it("Should not allow non-owner to list for sale", async function () {
      await expect(
        landRegistry.connect(buyer).listForSale("TL-MH-001", ethers.parseEther("10"))
      ).to.be.revertedWith("Not the owner");
    });

    it("Should unlist parcel from sale", async function () {
      await landRegistry.connect(landOwner).listForSale("TL-MH-001", ethers.parseEther("10"));

      await expect(
        landRegistry.connect(landOwner).unlistFromSale("TL-MH-001")
      )
        .to.emit(landRegistry, "ParcelUnlisted")
        .withArgs("TL-MH-001");

      const parcel = await landRegistry.getParcel("TL-MH-001");
      expect(parcel.isForSale).to.be.false;
    });
  });

  describe("Ownership Transfer", function () {
    beforeEach(async function () {
      await landRegistry.connect(government).registerParcel(
        "TL-MH-001",
        "SRV/2024/001",
        "Andheri",
        "Mumbai",
        "Maharashtra",
        5000,
        landOwner.address,
        "QmTestHash"
      );

      // Verify KYC for buyer
      await accessControl.connect(government).verifyKYC(buyer.address);
    });

    it("Should transfer ownership", async function () {
      await expect(
        landRegistry.connect(government).transferOwnership(
          "TL-MH-001",
          buyer.address,
          "0x1234567890abcdef"
        )
      )
        .to.emit(landRegistry, "OwnershipTransferred")
        .withArgs("TL-MH-001", landOwner.address, buyer.address);

      const parcel = await landRegistry.getParcel("TL-MH-001");
      expect(parcel.owner).to.equal(buyer.address);
    });

    it("Should not transfer to non-KYC verified user", async function () {
      const [, , , , nonKycUser] = await ethers.getSigners();

      await expect(
        landRegistry.connect(government).transferOwnership(
          "TL-MH-001",
          nonKycUser.address,
          "0x1234567890abcdef"
        )
      ).to.be.revertedWith("New owner not KYC verified");
    });

    it("Should add transfer to history", async function () {
      await landRegistry.connect(government).transferOwnership(
        "TL-MH-001",
        buyer.address,
        "0x1234567890abcdef"
      );

      const history = await landRegistry.getOwnershipHistory("TL-MH-001");
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(landOwner.address);
      expect(history[0].to).to.equal(buyer.address);
    });
  });

  describe("Dispute Flagging", function () {
    beforeEach(async function () {
      await landRegistry.connect(government).registerParcel(
        "TL-MH-001",
        "SRV/2024/001",
        "Andheri",
        "Mumbai",
        "Maharashtra",
        5000,
        landOwner.address,
        "QmTestHash"
      );
    });

    it("Should flag parcel as disputed", async function () {
      await expect(
        landRegistry.connect(government).flagDispute("TL-MH-001")
      )
        .to.emit(landRegistry, "ParcelStatusChanged")
        .withArgs("TL-MH-001", 1); // DISPUTED status

      const parcel = await landRegistry.getParcel("TL-MH-001");
      expect(parcel.status).to.equal(1); // DISPUTED
    });

    it("Should resolve dispute", async function () {
      await landRegistry.connect(government).flagDispute("TL-MH-001");
      await landRegistry.connect(government).resolveDispute("TL-MH-001");

      const parcel = await landRegistry.getParcel("TL-MH-001");
      expect(parcel.status).to.equal(0); // ACTIVE
    });
  });
});
