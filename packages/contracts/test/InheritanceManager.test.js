const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InheritanceManager", function () {
  let inheritanceManager;
  let accessControl;
  let landRegistry;
  let owner;
  let government;
  let landOwner;
  let heir1;
  let heir2;

  const parcelId = "TL-MH-001";

  beforeEach(async function () {
    [owner, government, landOwner, heir1, heir2] = await ethers.getSigners();

    // Deploy AccessControl
    const AccessControl = await ethers.getContractFactory("AccessControl");
    accessControl = await AccessControl.deploy();
    await accessControl.waitForDeployment();

    // Deploy LandRegistry
    const LandRegistry = await ethers.getContractFactory("LandRegistry");
    landRegistry = await LandRegistry.deploy(await accessControl.getAddress());
    await landRegistry.waitForDeployment();

    // Deploy InheritanceManager
    const InheritanceManager = await ethers.getContractFactory("InheritanceManager");
    inheritanceManager = await InheritanceManager.deploy(
      await accessControl.getAddress(),
      await landRegistry.getAddress()
    );
    await inheritanceManager.waitForDeployment();

    // Setup roles
    await accessControl.grantRole(
      await accessControl.GOVERNMENT_ROLE(),
      government.address
    );
    await accessControl.grantRole(
      await accessControl.LAND_OWNER_ROLE(),
      landOwner.address
    );

    // Verify KYC
    await accessControl.connect(government).verifyKYC(landOwner.address);
    await accessControl.connect(government).verifyKYC(heir1.address);
    await accessControl.connect(government).verifyKYC(heir2.address);

    // Register a parcel
    await landRegistry.connect(government).registerParcel(
      parcelId,
      "SRV/2024/001",
      "Andheri",
      "Mumbai",
      "Maharashtra",
      5000,
      landOwner.address,
      "QmTestHash"
    );
  });

  describe("Inheritance Plan Creation", function () {
    it("Should create inheritance plan", async function () {
      await expect(
        inheritanceManager.connect(landOwner).createPlan(parcelId)
      )
        .to.emit(inheritanceManager, "PlanCreated")
        .withArgs(parcelId, landOwner.address);

      const plan = await inheritanceManager.getPlan(parcelId);
      expect(plan.owner).to.equal(landOwner.address);
      expect(plan.isActive).to.be.true;
    });

    it("Should not allow non-owner to create plan", async function () {
      await expect(
        inheritanceManager.connect(heir1).createPlan(parcelId)
      ).to.be.revertedWith("Not the parcel owner");
    });

    it("Should not create duplicate plan", async function () {
      await inheritanceManager.connect(landOwner).createPlan(parcelId);

      await expect(
        inheritanceManager.connect(landOwner).createPlan(parcelId)
      ).to.be.revertedWith("Plan already exists");
    });
  });

  describe("Heir Management", function () {
    beforeEach(async function () {
      await inheritanceManager.connect(landOwner).createPlan(parcelId);
    });

    it("Should add heir with percentage", async function () {
      await expect(
        inheritanceManager.connect(landOwner).addHeir(parcelId, heir1.address, 6000) // 60%
      )
        .to.emit(inheritanceManager, "HeirAdded")
        .withArgs(parcelId, heir1.address, 6000);

      const plan = await inheritanceManager.getPlan(parcelId);
      expect(plan.heirCount).to.equal(1);
    });

    it("Should add multiple heirs", async function () {
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir1.address, 6000);
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir2.address, 4000);

      const plan = await inheritanceManager.getPlan(parcelId);
      expect(plan.heirCount).to.equal(2);
    });

    it("Should not exceed 100% allocation", async function () {
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir1.address, 7000);

      await expect(
        inheritanceManager.connect(landOwner).addHeir(parcelId, heir2.address, 4000) // Would be 110%
      ).to.be.revertedWith("Total percentage exceeds 100%");
    });

    it("Should remove heir", async function () {
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir1.address, 6000);

      await expect(
        inheritanceManager.connect(landOwner).removeHeir(parcelId, heir1.address)
      )
        .to.emit(inheritanceManager, "HeirRemoved")
        .withArgs(parcelId, heir1.address);
    });
  });

  describe("Release Milestones", function () {
    beforeEach(async function () {
      await inheritanceManager.connect(landOwner).createPlan(parcelId);
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir1.address, 10000);
    });

    it("Should add release milestone", async function () {
      const releaseAge = 25;
      const percentage = 5000; // 50%

      await expect(
        inheritanceManager.connect(landOwner).addMilestone(
          parcelId,
          heir1.address,
          releaseAge,
          percentage
        )
      )
        .to.emit(inheritanceManager, "MilestoneAdded")
        .withArgs(parcelId, heir1.address, releaseAge, percentage);
    });

    it("Should not add milestone exceeding heir percentage", async function () {
      await expect(
        inheritanceManager.connect(landOwner).addMilestone(
          parcelId,
          heir1.address,
          25,
          15000 // 150%, exceeds heir's 100%
        )
      ).to.be.revertedWith("Milestone exceeds heir allocation");
    });
  });

  describe("Inheritance Trigger", function () {
    beforeEach(async function () {
      await inheritanceManager.connect(landOwner).createPlan(parcelId);
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir1.address, 6000);
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir2.address, 4000);
    });

    it("Should trigger inheritance by government", async function () {
      const deathCertHash = "QmDeathCertificateHash";

      await expect(
        inheritanceManager.connect(government).triggerInheritance(parcelId, deathCertHash)
      )
        .to.emit(inheritanceManager, "InheritanceTriggered")
        .withArgs(parcelId, deathCertHash);

      const plan = await inheritanceManager.getPlan(parcelId);
      expect(plan.isTriggered).to.be.true;
    });

    it("Should not trigger without death certificate", async function () {
      await expect(
        inheritanceManager.connect(government).triggerInheritance(parcelId, "")
      ).to.be.revertedWith("Death certificate required");
    });

    it("Should not allow non-government to trigger", async function () {
      await expect(
        inheritanceManager.connect(heir1).triggerInheritance(parcelId, "QmDeathCert")
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Inheritance Claim", function () {
    beforeEach(async function () {
      await inheritanceManager.connect(landOwner).createPlan(parcelId);
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir1.address, 10000); // 100%
      await inheritanceManager.connect(government).triggerInheritance(parcelId, "QmDeathCert");
    });

    it("Should allow heir to claim inheritance", async function () {
      await expect(
        inheritanceManager.connect(heir1).claimInheritance(parcelId)
      )
        .to.emit(inheritanceManager, "InheritanceClaimed")
        .withArgs(parcelId, heir1.address);

      // Verify ownership transferred
      const parcel = await landRegistry.getParcel(parcelId);
      expect(parcel.owner).to.equal(heir1.address);
    });

    it("Should not allow claim before trigger", async function () {
      // Create new plan without trigger
      await landRegistry.connect(government).registerParcel(
        "TL-MH-002",
        "SRV/2024/002",
        "Bandra",
        "Mumbai",
        "Maharashtra",
        3000,
        landOwner.address,
        "QmTestHash2"
      );
      await inheritanceManager.connect(landOwner).createPlan("TL-MH-002");
      await inheritanceManager.connect(landOwner).addHeir("TL-MH-002", heir1.address, 10000);

      await expect(
        inheritanceManager.connect(heir1).claimInheritance("TL-MH-002")
      ).to.be.revertedWith("Inheritance not triggered");
    });

    it("Should not allow non-heir to claim", async function () {
      await expect(
        inheritanceManager.connect(heir2).claimInheritance(parcelId)
      ).to.be.revertedWith("Not an heir");
    });
  });

  describe("Plan Cancellation", function () {
    beforeEach(async function () {
      await inheritanceManager.connect(landOwner).createPlan(parcelId);
    });

    it("Should cancel plan by owner", async function () {
      await expect(
        inheritanceManager.connect(landOwner).cancelPlan(parcelId)
      )
        .to.emit(inheritanceManager, "PlanCancelled")
        .withArgs(parcelId);

      const plan = await inheritanceManager.getPlan(parcelId);
      expect(plan.isActive).to.be.false;
    });

    it("Should not cancel triggered plan", async function () {
      await inheritanceManager.connect(landOwner).addHeir(parcelId, heir1.address, 10000);
      await inheritanceManager.connect(government).triggerInheritance(parcelId, "QmDeathCert");

      await expect(
        inheritanceManager.connect(landOwner).cancelPlan(parcelId)
      ).to.be.revertedWith("Inheritance already triggered");
    });
  });
});
