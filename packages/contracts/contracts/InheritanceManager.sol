// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LandRegistry.sol";

/**
 * @title InheritanceManager
 * @dev Manages inheritance distribution for land parcels
 * Implements REQ-015 through REQ-019: Smart Contracts for Inheritance
 */
contract InheritanceManager is AccessControl, Pausable, ReentrancyGuard {
    // Reference to land registry
    LandRegistry public landRegistry;

    // Inheritance plan status
    enum PlanStatus { 
        ACTIVE,       // Plan is active
        TRIGGERED,    // Death certificate verified
        EXECUTING,    // Distribution in progress
        COMPLETED,    // All assets distributed
        CANCELLED     // Plan cancelled
    }

    // Heir structure (REQ-016)
    struct Heir {
        address wallet;
        uint256 percentage;    // Share percentage (total must = 100)
        uint256 releaseAge;    // Age for release (0 = immediate)
        uint256 birthDate;     // Unix timestamp of birth date
        bool hasClaimed;       // Whether heir has claimed their share
        uint256 claimedAt;     // Timestamp of claim
    }

    // Age-based release milestone (REQ-017)
    struct ReleaseMilestone {
        uint256 age;           // Age at which percentage is released
        uint256 percentage;    // Percentage released at this age
    }

    // Inheritance plan structure
    struct InheritancePlan {
        uint256 planId;
        address owner;                    // Property owner
        string[] parcelIds;               // Array of parcel IDs
        Heir[] heirs;                     // Array of heirs
        ReleaseMilestone[] milestones;    // Age-based release schedule
        PlanStatus status;
        string willHash;                  // IPFS hash of will (REQ-019)
        string deathCertHash;             // IPFS hash of death certificate
        uint256 createdAt;
        uint256 triggeredAt;
        uint256 completedAt;
        bool useAgeMilestones;            // Whether to use age-based release
    }

    // Mappings
    mapping(uint256 => InheritancePlan) public plans;
    mapping(address => uint256) public ownerToPlan;
    mapping(string => uint256) public parcelToPlan;
    mapping(address => uint256[]) public heirPlans;
    
    // Plan counter
    uint256 public planCounter;

    // Government verification oracle address
    address public governmentOracle;

    // Claim period (time heirs have to claim after trigger)
    uint256 public claimPeriod;

    // Events
    event PlanCreated(
        uint256 indexed planId,
        address indexed owner,
        string[] parcelIds,
        uint256 timestamp
    );
    event HeirAdded(
        uint256 indexed planId,
        address indexed heirWallet,
        uint256 percentage,
        uint256 timestamp
    );
    event HeirRemoved(
        uint256 indexed planId,
        address indexed heirWallet,
        uint256 timestamp
    );
    event WillUploaded(
        uint256 indexed planId,
        string willHash,
        uint256 timestamp
    );
    event InheritanceTriggered(
        uint256 indexed planId,
        string deathCertHash,
        address indexed triggeredBy,
        uint256 timestamp
    );
    event InheritanceClaimed(
        uint256 indexed planId,
        address indexed heir,
        string[] parcelIds,
        uint256 timestamp
    );
    event PartialClaim(
        uint256 indexed planId,
        address indexed heir,
        uint256 percentageClaimed,
        uint256 timestamp
    );
    event PlanCompleted(
        uint256 indexed planId,
        uint256 timestamp
    );
    event PlanCancelled(
        uint256 indexed planId,
        address indexed canceller,
        uint256 timestamp
    );
    event MilestoneAdded(
        uint256 indexed planId,
        uint256 age,
        uint256 percentage,
        uint256 timestamp
    );

    // Custom errors
    error PlanNotFound(uint256 planId);
    error PlanAlreadyExists(address owner);
    error NotPlanOwner();
    error InvalidPercentageTotal();
    error InvalidMilestones();
    error PlanNotActive();
    error PlanNotTriggered();
    error NotHeir();
    error AlreadyClaimed();
    error NotEligibleForClaim();
    error InvalidHeirData();
    error ClaimPeriodExpired();
    error ZeroAddress();

    // Roles
    bytes32 public constant GOVERNMENT_ROLE = keccak256("GOVERNMENT_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
     * @dev Constructor
     * @param _landRegistry Address of LandRegistry contract
     * @param _governmentOracle Address of government verification oracle
     */
    constructor(
        address _landRegistry,
        address _governmentOracle
    ) {
        if (_landRegistry == address(0)) revert ZeroAddress();
        
        landRegistry = LandRegistry(_landRegistry);
        governmentOracle = _governmentOracle;
        claimPeriod = 365 days; // 1 year claim period
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNMENT_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, _governmentOracle);
    }

    /**
     * @dev Create inheritance plan (REQ-015)
     * @param _parcelIds Array of parcel IDs
     * @param _useAgeMilestones Whether to use age-based release
     */
    function createPlan(
        string[] calldata _parcelIds,
        bool _useAgeMilestones
    ) external whenNotPaused returns (uint256) {
        if (ownerToPlan[msg.sender] != 0) revert PlanAlreadyExists(msg.sender);

        // Verify ownership of all parcels
        for (uint256 i = 0; i < _parcelIds.length; i++) {
            LandRegistry.LandParcel memory parcel = landRegistry.getParcel(_parcelIds[i]);
            require(parcel.owner == msg.sender, "Not owner of parcel");
            require(parcelToPlan[_parcelIds[i]] == 0, "Parcel already in plan");
        }

        planCounter++;
        uint256 planId = planCounter;

        InheritancePlan storage plan = plans[planId];
        plan.planId = planId;
        plan.owner = msg.sender;
        plan.parcelIds = _parcelIds;
        plan.status = PlanStatus.ACTIVE;
        plan.createdAt = block.timestamp;
        plan.useAgeMilestones = _useAgeMilestones;

        ownerToPlan[msg.sender] = planId;
        
        for (uint256 i = 0; i < _parcelIds.length; i++) {
            parcelToPlan[_parcelIds[i]] = planId;
        }

        emit PlanCreated(planId, msg.sender, _parcelIds, block.timestamp);
        return planId;
    }

    /**
     * @dev Add heir to plan (REQ-016)
     * @param _planId Plan ID
     * @param _wallet Heir's wallet address
     * @param _percentage Inheritance percentage
     * @param _releaseAge Age for release (0 for immediate)
     * @param _birthDate Birth date timestamp
     */
    function addHeir(
        uint256 _planId,
        address _wallet,
        uint256 _percentage,
        uint256 _releaseAge,
        uint256 _birthDate
    ) external whenNotPaused {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) revert PlanNotFound(_planId);
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.status != PlanStatus.ACTIVE) revert PlanNotActive();
        if (_wallet == address(0)) revert ZeroAddress();
        if (_percentage == 0 || _percentage > 100) revert InvalidHeirData();

        // Check total percentage doesn't exceed 100
        uint256 totalPercentage = _percentage;
        for (uint256 i = 0; i < plan.heirs.length; i++) {
            totalPercentage += plan.heirs[i].percentage;
        }
        if (totalPercentage > 100) revert InvalidPercentageTotal();

        plan.heirs.push(Heir({
            wallet: _wallet,
            percentage: _percentage,
            releaseAge: _releaseAge,
            birthDate: _birthDate,
            hasClaimed: false,
            claimedAt: 0
        }));

        heirPlans[_wallet].push(_planId);

        emit HeirAdded(_planId, _wallet, _percentage, block.timestamp);
    }

    /**
     * @dev Add release milestone (REQ-017)
     * @param _planId Plan ID
     * @param _age Age milestone
     * @param _percentage Percentage to release at this age
     */
    function addMilestone(
        uint256 _planId,
        uint256 _age,
        uint256 _percentage
    ) external whenNotPaused {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) revert PlanNotFound(_planId);
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.status != PlanStatus.ACTIVE) revert PlanNotActive();

        // Check total milestones don't exceed 100%
        uint256 totalMilestonePercentage = _percentage;
        for (uint256 i = 0; i < plan.milestones.length; i++) {
            totalMilestonePercentage += plan.milestones[i].percentage;
        }
        if (totalMilestonePercentage > 100) revert InvalidMilestones();

        plan.milestones.push(ReleaseMilestone({
            age: _age,
            percentage: _percentage
        }));

        emit MilestoneAdded(_planId, _age, _percentage, block.timestamp);
    }

    /**
     * @dev Upload will to plan (REQ-019)
     * @param _planId Plan ID
     * @param _willHash IPFS hash of will document
     */
    function uploadWill(
        uint256 _planId,
        string calldata _willHash
    ) external whenNotPaused {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) revert PlanNotFound(_planId);
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.status != PlanStatus.ACTIVE) revert PlanNotActive();

        plan.willHash = _willHash;
        emit WillUploaded(_planId, _willHash, block.timestamp);
    }

    /**
     * @dev Trigger inheritance (REQ-015, REQ-018)
     * Called by government oracle after death certificate verification
     * @param _planId Plan ID
     * @param _deathCertHash IPFS hash of death certificate
     */
    function triggerInheritance(
        uint256 _planId,
        string calldata _deathCertHash
    ) external onlyRole(GOVERNMENT_ROLE) whenNotPaused {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) revert PlanNotFound(_planId);
        if (plan.status != PlanStatus.ACTIVE) revert PlanNotActive();

        // Verify heirs total 100%
        uint256 totalPercentage;
        for (uint256 i = 0; i < plan.heirs.length; i++) {
            totalPercentage += plan.heirs[i].percentage;
        }
        if (totalPercentage != 100) revert InvalidPercentageTotal();

        plan.deathCertHash = _deathCertHash;
        plan.status = PlanStatus.TRIGGERED;
        plan.triggeredAt = block.timestamp;

        emit InheritanceTriggered(_planId, _deathCertHash, msg.sender, block.timestamp);
    }

    /**
     * @dev Claim inheritance (REQ-015, REQ-017)
     * @param _planId Plan ID
     */
    function claimInheritance(uint256 _planId) external whenNotPaused nonReentrant {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) revert PlanNotFound(_planId);
        if (plan.status != PlanStatus.TRIGGERED && plan.status != PlanStatus.EXECUTING) {
            revert PlanNotTriggered();
        }

        // Check claim period hasn't expired
        if (block.timestamp > plan.triggeredAt + claimPeriod) {
            revert ClaimPeriodExpired();
        }

        // Find heir
        int256 heirIndex = -1;
        for (uint256 i = 0; i < plan.heirs.length; i++) {
            if (plan.heirs[i].wallet == msg.sender) {
                heirIndex = int256(i);
                break;
            }
        }
        if (heirIndex < 0) revert NotHeir();
        
        Heir storage heir = plan.heirs[uint256(heirIndex)];
        if (heir.hasClaimed) revert AlreadyClaimed();

        // Check age eligibility if milestones are used
        uint256 claimablePercentage = heir.percentage;
        if (plan.useAgeMilestones && heir.releaseAge > 0) {
            uint256 currentAge = _calculateAge(heir.birthDate);
            claimablePercentage = _getClaimablePercentage(plan, currentAge, heir.percentage);
            
            if (claimablePercentage == 0) revert NotEligibleForClaim();
        }

        // Mark as claimed
        heir.hasClaimed = true;
        heir.claimedAt = block.timestamp;

        // Update plan status
        if (_allHeirsClaimed(plan)) {
            plan.status = PlanStatus.COMPLETED;
            plan.completedAt = block.timestamp;
            emit PlanCompleted(_planId, block.timestamp);
        } else {
            plan.status = PlanStatus.EXECUTING;
        }

        // The actual ownership transfer would be handled by the LandRegistry
        // In a real implementation, this would transfer fractional ownership
        // or require all heirs to claim before distributing parcels

        emit InheritanceClaimed(_planId, msg.sender, plan.parcelIds, block.timestamp);
    }

    /**
     * @dev Calculate claimable percentage based on age milestones
     */
    function _getClaimablePercentage(
        InheritancePlan storage _plan,
        uint256 _currentAge,
        uint256 _totalPercentage
    ) internal view returns (uint256) {
        uint256 claimable = 0;
        
        for (uint256 i = 0; i < _plan.milestones.length; i++) {
            if (_currentAge >= _plan.milestones[i].age) {
                claimable += _plan.milestones[i].percentage;
            }
        }
        
        // Return the claimable portion of heir's share
        return (_totalPercentage * claimable) / 100;
    }

    /**
     * @dev Calculate age from birth date
     */
    function _calculateAge(uint256 _birthDate) internal view returns (uint256) {
        if (_birthDate == 0) return 0;
        return (block.timestamp - _birthDate) / 365 days;
    }

    /**
     * @dev Check if all heirs have claimed
     */
    function _allHeirsClaimed(InheritancePlan storage _plan) internal view returns (bool) {
        for (uint256 i = 0; i < _plan.heirs.length; i++) {
            if (!_plan.heirs[i].hasClaimed) return false;
        }
        return true;
    }

    /**
     * @dev Cancel plan (owner only, before triggering)
     * @param _planId Plan ID
     */
    function cancelPlan(uint256 _planId) external whenNotPaused {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) revert PlanNotFound(_planId);
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.status != PlanStatus.ACTIVE) revert PlanNotActive();

        plan.status = PlanStatus.CANCELLED;
        ownerToPlan[msg.sender] = 0;

        // Remove parcel associations
        for (uint256 i = 0; i < plan.parcelIds.length; i++) {
            parcelToPlan[plan.parcelIds[i]] = 0;
        }

        emit PlanCancelled(_planId, msg.sender, block.timestamp);
    }

    /**
     * @dev Remove heir from plan (owner only)
     * @param _planId Plan ID
     * @param _heirIndex Index of heir to remove
     */
    function removeHeir(uint256 _planId, uint256 _heirIndex) external whenNotPaused {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) revert PlanNotFound(_planId);
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.status != PlanStatus.ACTIVE) revert PlanNotActive();
        require(_heirIndex < plan.heirs.length, "Invalid heir index");

        address heirWallet = plan.heirs[_heirIndex].wallet;
        
        // Remove heir from array
        plan.heirs[_heirIndex] = plan.heirs[plan.heirs.length - 1];
        plan.heirs.pop();

        emit HeirRemoved(_planId, heirWallet, block.timestamp);
    }

    // Admin Functions

    /**
     * @dev Update government oracle address
     */
    function updateGovernmentOracle(address _newOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newOracle == address(0)) revert ZeroAddress();
        _revokeRole(ORACLE_ROLE, governmentOracle);
        governmentOracle = _newOracle;
        _grantRole(ORACLE_ROLE, _newOracle);
    }

    /**
     * @dev Update claim period
     */
    function updateClaimPeriod(uint256 _newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newPeriod >= 30 days, "Period too short");
        claimPeriod = _newPeriod;
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // View Functions

    /**
     * @dev Get plan details
     */
    function getPlan(uint256 _planId) external view returns (
        uint256 planId,
        address owner,
        string[] memory parcelIds,
        PlanStatus status,
        string memory willHash,
        string memory deathCertHash,
        uint256 createdAt,
        uint256 triggeredAt,
        bool useAgeMilestones
    ) {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) revert PlanNotFound(_planId);
        
        return (
            plan.planId,
            plan.owner,
            plan.parcelIds,
            plan.status,
            plan.willHash,
            plan.deathCertHash,
            plan.createdAt,
            plan.triggeredAt,
            plan.useAgeMilestones
        );
    }

    /**
     * @dev Get heirs for a plan
     */
    function getPlanHeirs(uint256 _planId) external view returns (Heir[] memory) {
        if (plans[_planId].planId == 0) revert PlanNotFound(_planId);
        return plans[_planId].heirs;
    }

    /**
     * @dev Get milestones for a plan
     */
    function getPlanMilestones(uint256 _planId) external view returns (ReleaseMilestone[] memory) {
        if (plans[_planId].planId == 0) revert PlanNotFound(_planId);
        return plans[_planId].milestones;
    }

    /**
     * @dev Get plan by owner address
     */
    function getPlanByOwner(address _owner) external view returns (uint256) {
        return ownerToPlan[_owner];
    }

    /**
     * @dev Get plans where address is an heir
     */
    function getHeirPlans(address _heir) external view returns (uint256[] memory) {
        return heirPlans[_heir];
    }

    /**
     * @dev Check claim eligibility for an heir
     */
    function checkClaimEligibility(
        uint256 _planId,
        address _heir
    ) external view returns (
        bool isHeir,
        bool hasClaimed,
        uint256 percentage,
        uint256 claimablePercentage
    ) {
        InheritancePlan storage plan = plans[_planId];
        if (plan.planId == 0) return (false, false, 0, 0);

        for (uint256 i = 0; i < plan.heirs.length; i++) {
            if (plan.heirs[i].wallet == _heir) {
                Heir storage heir = plan.heirs[i];
                uint256 claimable = heir.percentage;
                
                if (plan.useAgeMilestones && heir.releaseAge > 0) {
                    uint256 currentAge = _calculateAge(heir.birthDate);
                    claimable = _getClaimablePercentage(plan, currentAge, heir.percentage);
                }
                
                return (true, heir.hasClaimed, heir.percentage, claimable);
            }
        }
        
        return (false, false, 0, 0);
    }
}
