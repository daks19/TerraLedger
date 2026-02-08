// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LandRegistry.sol";

/**
 * @title LandBoundary
 * @dev Handles boundary validation and dispute resolution
 * Implements REQ-020 through REQ-023: Boundary Dispute Resolution
 */
contract LandBoundary is AccessControl, Pausable, ReentrancyGuard {
    // Reference to land registry
    LandRegistry public landRegistry;

    // Dispute status
    enum DisputeStatus {
        OPEN,           // Dispute filed
        UNDER_REVIEW,   // Being reviewed by surveyor
        EVIDENCE_PHASE, // Collecting evidence
        RESOLVED,       // Dispute resolved
        REJECTED,       // Dispute rejected
        APPEALED        // Decision appealed
    }

    // Resolution type
    enum ResolutionType {
        BOUNDARY_ADJUSTED,    // Boundaries were modified
        NO_CHANGE,           // Original boundaries confirmed
        SPLIT,               // Parcel was split
        MERGED               // Parcels were merged
    }

    // GPS Coordinate structure
    struct GPSCoordinate {
        int256 latitude;      // Latitude * 1e8 (8 decimal precision)
        int256 longitude;     // Longitude * 1e8 (8 decimal precision)
        uint256 altitude;     // Altitude in centimeters
        uint256 accuracy;     // GPS accuracy in centimeters
        uint256 timestamp;    // When coordinate was recorded
    }

    // Boundary validation request
    struct ValidationRequest {
        uint256 requestId;
        string parcelId;
        address requester;
        string proposedBoundaryHash;  // IPFS hash of proposed GeoJSON
        GPSCoordinate[] coordinates;
        uint256 createdAt;
        bool isValidated;
        address validatedBy;
        uint256 validatedAt;
        string validationNotes;
    }

    // Boundary dispute structure (REQ-022)
    struct BoundaryDispute {
        uint256 disputeId;
        string parcelId;
        string[] affectedParcelIds;    // Other parcels involved
        address disputant;              // Who filed the dispute
        address[] affectedOwners;       // Owners of affected parcels
        DisputeStatus status;
        string description;
        string evidenceHash;            // IPFS hash of evidence documents
        string[] additionalEvidence;    // Additional evidence hashes
        uint256 filedAt;
        uint256 resolvedAt;
        address resolvedBy;
        ResolutionType resolution;
        string resolutionDetails;
        string newBoundaryHash;         // New boundary if adjusted
    }

    // Surveyor verification (REQ-021)
    struct SurveyorVerification {
        address surveyor;
        string licenseNumber;
        bytes signature;
        string reportHash;       // IPFS hash of survey report
        uint256 verifiedAt;
        bool isValid;
    }

    // Boundary overlap detection result (REQ-023)
    struct OverlapResult {
        string parcelId1;
        string parcelId2;
        string overlapGeoHash;   // IPFS hash of overlap area GeoJSON
        uint256 overlapAreaSqM;
        uint256 detectedAt;
        bool isResolved;
    }

    // Mappings
    mapping(uint256 => ValidationRequest) public validationRequests;
    mapping(uint256 => BoundaryDispute) public disputes;
    mapping(string => uint256[]) public parcelDisputes;
    mapping(string => ValidationRequest[]) public parcelValidations;
    mapping(uint256 => SurveyorVerification) public disputeVerifications;
    mapping(uint256 => OverlapResult) public overlaps;
    mapping(string => mapping(string => uint256)) public parcelPairOverlap;

    // Counters
    uint256 public validationCounter;
    uint256 public disputeCounter;
    uint256 public overlapCounter;

    // Authorized surveyors
    mapping(address => bool) public authorizedSurveyors;
    mapping(address => string) public surveyorLicenses;

    // Events
    event ValidationRequested(
        uint256 indexed requestId,
        string parcelId,
        address indexed requester,
        uint256 timestamp
    );
    event ValidationCompleted(
        uint256 indexed requestId,
        address indexed surveyor,
        bool isValid,
        uint256 timestamp
    );
    event DisputeFiled(
        uint256 indexed disputeId,
        string parcelId,
        address indexed disputant,
        string description,
        uint256 timestamp
    );
    event EvidenceSubmitted(
        uint256 indexed disputeId,
        address indexed submitter,
        string evidenceHash,
        uint256 timestamp
    );
    event DisputeStatusUpdated(
        uint256 indexed disputeId,
        DisputeStatus oldStatus,
        DisputeStatus newStatus,
        uint256 timestamp
    );
    event DisputeResolved(
        uint256 indexed disputeId,
        ResolutionType resolution,
        address indexed resolvedBy,
        uint256 timestamp
    );
    event SurveyorVerificationSubmitted(
        uint256 indexed disputeId,
        address indexed surveyor,
        string reportHash,
        uint256 timestamp
    );
    event OverlapDetected(
        uint256 indexed overlapId,
        string parcelId1,
        string parcelId2,
        uint256 overlapAreaSqM,
        uint256 timestamp
    );
    event OverlapResolved(
        uint256 indexed overlapId,
        uint256 timestamp
    );
    event SurveyorAuthorized(address indexed surveyor, string licenseNumber);
    event SurveyorDeauthorized(address indexed surveyor);
    event BoundaryUpdated(
        string indexed parcelId,
        string newBoundaryHash,
        address indexed updatedBy,
        uint256 timestamp
    );

    // Custom errors
    error ValidationNotFound(uint256 requestId);
    error DisputeNotFound(uint256 disputeId);
    error InvalidDisputeStatus();
    error NotAuthorizedSurveyor();
    error NotDisputeParticipant();
    error AlreadyResolved();
    error InvalidCoordinates();
    error OverlapNotFound(uint256 overlapId);

    // Roles
    bytes32 public constant SURVEYOR_ROLE = keccak256("SURVEYOR_ROLE");
    bytes32 public constant GOVERNMENT_ROLE = keccak256("GOVERNMENT_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /**
     * @dev Constructor
     * @param _landRegistry Address of LandRegistry contract
     */
    constructor(address _landRegistry) {
        landRegistry = LandRegistry(_landRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNMENT_ROLE, msg.sender);
    }

    /**
     * @dev Authorize a surveyor (REQ-021)
     * @param _surveyor Surveyor address
     * @param _licenseNumber License number
     */
    function authorizeSurveyor(
        address _surveyor,
        string calldata _licenseNumber
    ) external onlyRole(GOVERNMENT_ROLE) {
        authorizedSurveyors[_surveyor] = true;
        surveyorLicenses[_surveyor] = _licenseNumber;
        _grantRole(SURVEYOR_ROLE, _surveyor);
        
        emit SurveyorAuthorized(_surveyor, _licenseNumber);
    }

    /**
     * @dev Deauthorize a surveyor
     * @param _surveyor Surveyor address
     */
    function deauthorizeSurveyor(address _surveyor) external onlyRole(GOVERNMENT_ROLE) {
        authorizedSurveyors[_surveyor] = false;
        _revokeRole(SURVEYOR_ROLE, _surveyor);
        
        emit SurveyorDeauthorized(_surveyor);
    }

    /**
     * @dev Request boundary validation (REQ-020)
     * @param _parcelId Parcel ID
     * @param _proposedBoundaryHash IPFS hash of proposed boundaries
     * @param _coordinates Array of GPS coordinates
     */
    function requestValidation(
        string calldata _parcelId,
        string calldata _proposedBoundaryHash,
        GPSCoordinate[] calldata _coordinates
    ) external whenNotPaused returns (uint256) {
        // Verify parcel exists
        landRegistry.getParcel(_parcelId);

        validationCounter++;
        uint256 requestId = validationCounter;

        ValidationRequest storage request = validationRequests[requestId];
        request.requestId = requestId;
        request.parcelId = _parcelId;
        request.requester = msg.sender;
        request.proposedBoundaryHash = _proposedBoundaryHash;
        request.createdAt = block.timestamp;

        // Copy coordinates
        for (uint256 i = 0; i < _coordinates.length; i++) {
            request.coordinates.push(_coordinates[i]);
        }

        emit ValidationRequested(requestId, _parcelId, msg.sender, block.timestamp);
        return requestId;
    }

    /**
     * @dev Complete validation request (surveyor only)
     * @param _requestId Validation request ID
     * @param _isValid Whether boundaries are valid
     * @param _notes Validation notes
     */
    function completeValidation(
        uint256 _requestId,
        bool _isValid,
        string calldata _notes
    ) external onlyRole(SURVEYOR_ROLE) whenNotPaused {
        ValidationRequest storage request = validationRequests[_requestId];
        if (request.requestId == 0) revert ValidationNotFound(_requestId);

        request.isValidated = true;
        request.validatedBy = msg.sender;
        request.validatedAt = block.timestamp;
        request.validationNotes = _notes;

        // If valid, update land registry boundaries
        if (_isValid) {
            landRegistry.updateBoundaries(request.parcelId, request.proposedBoundaryHash);
        }

        emit ValidationCompleted(_requestId, msg.sender, _isValid, block.timestamp);
    }

    /**
     * @dev File a boundary dispute (REQ-022)
     * @param _parcelId Primary parcel ID
     * @param _affectedParcelIds Other affected parcel IDs
     * @param _description Dispute description
     * @param _evidenceHash Initial evidence IPFS hash
     */
    function fileDispute(
        string calldata _parcelId,
        string[] calldata _affectedParcelIds,
        string calldata _description,
        string calldata _evidenceHash
    ) external whenNotPaused returns (uint256) {
        // Verify parcels exist
        LandRegistry.LandParcel memory mainParcel = landRegistry.getParcel(_parcelId);
        
        // Collect affected owners
        address[] memory affectedOwners = new address[](_affectedParcelIds.length);
        for (uint256 i = 0; i < _affectedParcelIds.length; i++) {
            LandRegistry.LandParcel memory affected = landRegistry.getParcel(_affectedParcelIds[i]);
            affectedOwners[i] = affected.owner;
        }

        disputeCounter++;
        uint256 disputeId = disputeCounter;

        BoundaryDispute storage dispute = disputes[disputeId];
        dispute.disputeId = disputeId;
        dispute.parcelId = _parcelId;
        dispute.affectedParcelIds = _affectedParcelIds;
        dispute.disputant = msg.sender;
        dispute.affectedOwners = affectedOwners;
        dispute.status = DisputeStatus.OPEN;
        dispute.description = _description;
        dispute.evidenceHash = _evidenceHash;
        dispute.filedAt = block.timestamp;

        parcelDisputes[_parcelId].push(disputeId);
        
        // Flag parcel as disputed in registry
        landRegistry.flagDispute(_parcelId, _description);

        emit DisputeFiled(disputeId, _parcelId, msg.sender, _description, block.timestamp);
        return disputeId;
    }

    /**
     * @dev Submit additional evidence for dispute
     * @param _disputeId Dispute ID
     * @param _evidenceHash IPFS hash of evidence
     */
    function submitEvidence(
        uint256 _disputeId,
        string calldata _evidenceHash
    ) external whenNotPaused {
        BoundaryDispute storage dispute = disputes[_disputeId];
        if (dispute.disputeId == 0) revert DisputeNotFound(_disputeId);
        
        // Only allow participants to submit evidence
        require(
            _isDisputeParticipant(_disputeId, msg.sender),
            "Not a participant"
        );
        require(
            dispute.status == DisputeStatus.OPEN || 
            dispute.status == DisputeStatus.EVIDENCE_PHASE,
            "Cannot submit evidence"
        );

        dispute.additionalEvidence.push(_evidenceHash);
        
        if (dispute.status == DisputeStatus.OPEN) {
            dispute.status = DisputeStatus.EVIDENCE_PHASE;
            emit DisputeStatusUpdated(
                _disputeId,
                DisputeStatus.OPEN,
                DisputeStatus.EVIDENCE_PHASE,
                block.timestamp
            );
        }

        emit EvidenceSubmitted(_disputeId, msg.sender, _evidenceHash, block.timestamp);
    }

    /**
     * @dev Submit surveyor verification for dispute (REQ-021)
     * @param _disputeId Dispute ID
     * @param _signature Digital signature
     * @param _reportHash IPFS hash of survey report
     */
    function submitSurveyorVerification(
        uint256 _disputeId,
        bytes calldata _signature,
        string calldata _reportHash
    ) external onlyRole(SURVEYOR_ROLE) whenNotPaused {
        BoundaryDispute storage dispute = disputes[_disputeId];
        if (dispute.disputeId == 0) revert DisputeNotFound(_disputeId);

        SurveyorVerification storage verification = disputeVerifications[_disputeId];
        verification.surveyor = msg.sender;
        verification.licenseNumber = surveyorLicenses[msg.sender];
        verification.signature = _signature;
        verification.reportHash = _reportHash;
        verification.verifiedAt = block.timestamp;
        verification.isValid = true;

        dispute.status = DisputeStatus.UNDER_REVIEW;
        
        emit SurveyorVerificationSubmitted(_disputeId, msg.sender, _reportHash, block.timestamp);
        emit DisputeStatusUpdated(
            _disputeId,
            DisputeStatus.EVIDENCE_PHASE,
            DisputeStatus.UNDER_REVIEW,
            block.timestamp
        );
    }

    /**
     * @dev Resolve dispute (government only)
     * @param _disputeId Dispute ID
     * @param _resolution Resolution type
     * @param _resolutionDetails Details of resolution
     * @param _newBoundaryHash New boundary hash if adjusted
     */
    function resolveDispute(
        uint256 _disputeId,
        ResolutionType _resolution,
        string calldata _resolutionDetails,
        string calldata _newBoundaryHash
    ) external onlyRole(GOVERNMENT_ROLE) whenNotPaused {
        BoundaryDispute storage dispute = disputes[_disputeId];
        if (dispute.disputeId == 0) revert DisputeNotFound(_disputeId);
        if (dispute.status == DisputeStatus.RESOLVED) revert AlreadyResolved();

        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolvedAt = block.timestamp;
        dispute.resolvedBy = msg.sender;
        dispute.resolution = _resolution;
        dispute.resolutionDetails = _resolutionDetails;

        // Update boundaries if adjusted
        if (_resolution == ResolutionType.BOUNDARY_ADJUSTED && bytes(_newBoundaryHash).length > 0) {
            dispute.newBoundaryHash = _newBoundaryHash;
            landRegistry.updateBoundaries(dispute.parcelId, _newBoundaryHash);
            emit BoundaryUpdated(dispute.parcelId, _newBoundaryHash, msg.sender, block.timestamp);
        }

        // Resolve dispute in registry
        landRegistry.resolveDispute(dispute.parcelId, _resolutionDetails);

        emit DisputeResolved(_disputeId, _resolution, msg.sender, block.timestamp);
    }

    /**
     * @dev Report boundary overlap (REQ-023)
     * Called by oracle or automated detection system
     * @param _parcelId1 First parcel ID
     * @param _parcelId2 Second parcel ID
     * @param _overlapGeoHash IPFS hash of overlap GeoJSON
     * @param _overlapAreaSqM Overlap area in square meters
     */
    function reportOverlap(
        string calldata _parcelId1,
        string calldata _parcelId2,
        string calldata _overlapGeoHash,
        uint256 _overlapAreaSqM
    ) external onlyRole(ORACLE_ROLE) whenNotPaused returns (uint256) {
        // Verify parcels exist
        landRegistry.getParcel(_parcelId1);
        landRegistry.getParcel(_parcelId2);

        overlapCounter++;
        uint256 overlapId = overlapCounter;

        OverlapResult storage overlap = overlaps[overlapId];
        overlap.parcelId1 = _parcelId1;
        overlap.parcelId2 = _parcelId2;
        overlap.overlapGeoHash = _overlapGeoHash;
        overlap.overlapAreaSqM = _overlapAreaSqM;
        overlap.detectedAt = block.timestamp;
        overlap.isResolved = false;

        // Store pair mapping
        parcelPairOverlap[_parcelId1][_parcelId2] = overlapId;
        parcelPairOverlap[_parcelId2][_parcelId1] = overlapId;

        emit OverlapDetected(overlapId, _parcelId1, _parcelId2, _overlapAreaSqM, block.timestamp);
        return overlapId;
    }

    /**
     * @dev Mark overlap as resolved
     * @param _overlapId Overlap ID
     */
    function resolveOverlap(uint256 _overlapId) external onlyRole(GOVERNMENT_ROLE) whenNotPaused {
        OverlapResult storage overlap = overlaps[_overlapId];
        if (bytes(overlap.parcelId1).length == 0) revert OverlapNotFound(_overlapId);

        overlap.isResolved = true;
        emit OverlapResolved(_overlapId, block.timestamp);
    }

    /**
     * @dev Check if address is dispute participant
     */
    function _isDisputeParticipant(uint256 _disputeId, address _addr) internal view returns (bool) {
        BoundaryDispute storage dispute = disputes[_disputeId];
        
        if (dispute.disputant == _addr) return true;
        
        for (uint256 i = 0; i < dispute.affectedOwners.length; i++) {
            if (dispute.affectedOwners[i] == _addr) return true;
        }
        
        return hasRole(SURVEYOR_ROLE, _addr) || hasRole(GOVERNMENT_ROLE, _addr);
    }

    // Admin Functions

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
     * @dev Get validation request details
     */
    function getValidationRequest(uint256 _requestId) external view returns (
        uint256 requestId,
        string memory parcelId,
        address requester,
        string memory proposedBoundaryHash,
        uint256 createdAt,
        bool isValidated,
        address validatedBy,
        string memory validationNotes
    ) {
        ValidationRequest storage request = validationRequests[_requestId];
        if (request.requestId == 0) revert ValidationNotFound(_requestId);
        
        return (
            request.requestId,
            request.parcelId,
            request.requester,
            request.proposedBoundaryHash,
            request.createdAt,
            request.isValidated,
            request.validatedBy,
            request.validationNotes
        );
    }

    /**
     * @dev Get dispute details
     */
    function getDispute(uint256 _disputeId) external view returns (
        uint256 disputeId,
        string memory parcelId,
        address disputant,
        DisputeStatus status,
        string memory description,
        uint256 filedAt,
        uint256 resolvedAt,
        ResolutionType resolution
    ) {
        BoundaryDispute storage dispute = disputes[_disputeId];
        if (dispute.disputeId == 0) revert DisputeNotFound(_disputeId);
        
        return (
            dispute.disputeId,
            dispute.parcelId,
            dispute.disputant,
            dispute.status,
            dispute.description,
            dispute.filedAt,
            dispute.resolvedAt,
            dispute.resolution
        );
    }

    /**
     * @dev Get disputes for a parcel
     */
    function getParcelDisputes(string calldata _parcelId) external view returns (uint256[] memory) {
        return parcelDisputes[_parcelId];
    }

    /**
     * @dev Get surveyor verification for dispute
     */
    function getDisputeVerification(uint256 _disputeId) external view returns (SurveyorVerification memory) {
        return disputeVerifications[_disputeId];
    }

    /**
     * @dev Get overlap details
     */
    function getOverlap(uint256 _overlapId) external view returns (OverlapResult memory) {
        if (bytes(overlaps[_overlapId].parcelId1).length == 0) revert OverlapNotFound(_overlapId);
        return overlaps[_overlapId];
    }

    /**
     * @dev Check if two parcels have overlap
     */
    function hasOverlap(string calldata _parcelId1, string calldata _parcelId2) external view returns (bool, uint256) {
        uint256 overlapId = parcelPairOverlap[_parcelId1][_parcelId2];
        if (overlapId == 0) return (false, 0);
        return (!overlaps[overlapId].isResolved, overlapId);
    }

    /**
     * @dev Get surveyor license
     */
    function getSurveyorLicense(address _surveyor) external view returns (string memory) {
        return surveyorLicenses[_surveyor];
    }

    /**
     * @dev Check if surveyor is authorized
     */
    function isSurveyorAuthorized(address _surveyor) external view returns (bool) {
        return authorizedSurveyors[_surveyor];
    }
}
