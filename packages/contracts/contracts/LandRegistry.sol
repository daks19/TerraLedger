// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AccessControl.sol";

/**
 * @title LandRegistry
 * @dev Main contract for land parcel registration and management
 * Implements REQ-005 through REQ-009: Land Record Management
 */
contract LandRegistry is AccessControl, Pausable, ReentrancyGuard {
    // Reference to access control contract
    TerraLedgerAccessControl public accessControl;

    // Land parcel status
    enum ParcelStatus { ACTIVE, TRANSFERRED, DISPUTED, INACTIVE }

    // Land parcel structure (REQ-006)
    struct LandParcel {
        string parcelId;           // Unique PID (e.g., "MH-PN-1234-567")
        address owner;             // Current owner wallet
        uint256 areaSqM;           // Area in square meters
        string surveyNumber;       // Survey number
        string village;            // Village name
        string district;           // District name
        string state;              // State name
        string boundaryHash;       // IPFS hash of GeoJSON boundaries
        string ipfsDocHash;        // IPFS hash of all documents
        uint256 price;             // Listing price in wei (0 if not for sale)
        ParcelStatus status;       // Current status
        uint256 registeredAt;      // Registration timestamp
        uint256 lastUpdatedAt;     // Last update timestamp
        bool isForSale;            // Listed for sale flag
    }

    // Transaction structure (REQ-008, REQ-009)
    struct TransactionRecord {
        bytes32 txHash;            // Blockchain transaction hash
        address seller;            // Previous owner
        address buyer;             // New owner
        uint256 amount;            // Transaction amount
        uint8 status;              // 0=Pending, 1=Escrow, 2=Completed, 3=Failed
        uint256 timestamp;         // Transaction timestamp
        string ipfsProofHash;      // IPFS hash of transaction documents
    }

    // Audit trail entry (REQ-008)
    struct AuditEntry {
        uint256 timestamp;
        address actor;
        string action;
        string details;
        bytes32 txHash;
    }

    // Mappings
    mapping(string => LandParcel) public parcels;
    mapping(string => bool) public parcelExists;
    mapping(string => TransactionRecord[]) public parcelTransactions;
    mapping(string => AuditEntry[]) public parcelAuditTrail;
    mapping(address => string[]) public ownerParcels;
    mapping(string => address[]) public parcelPreviousOwners;
    
    // Survey number to parcel ID mapping for quick lookups
    mapping(string => string) public surveyToParcelId;
    
    // All parcel IDs for enumeration
    string[] public allParcelIds;

    // Events
    event ParcelRegistered(
        string indexed parcelId,
        address indexed owner,
        uint256 areaSqM,
        string surveyNumber,
        uint256 timestamp
    );
    event ParcelUpdated(
        string indexed parcelId,
        address indexed updater,
        string field,
        uint256 timestamp
    );
    event ParcelListedForSale(
        string indexed parcelId,
        address indexed owner,
        uint256 price,
        uint256 timestamp
    );
    event ParcelUnlisted(
        string indexed parcelId,
        address indexed owner,
        uint256 timestamp
    );
    event OwnershipTransferred(
        string indexed parcelId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 amount,
        uint256 timestamp
    );
    event ParcelDisputed(
        string indexed parcelId,
        address indexed disputer,
        string reason,
        uint256 timestamp
    );
    event DisputeResolved(
        string indexed parcelId,
        address indexed resolver,
        string resolution,
        uint256 timestamp
    );
    event DocumentsUpdated(
        string indexed parcelId,
        string ipfsHash,
        uint256 timestamp
    );
    event AuditEntryAdded(
        string indexed parcelId,
        address indexed actor,
        string action,
        uint256 timestamp
    );

    // Custom errors
    error ParcelAlreadyExists(string parcelId);
    error ParcelNotFound(string parcelId);
    error NotParcelOwner(string parcelId, address caller);
    error ParcelNotForSale(string parcelId);
    error ParcelIsDisputed(string parcelId);
    error InvalidPrice();
    error InvalidArea();
    error UnauthorizedAccess();
    error SurveyNumberExists(string surveyNumber);

    // Roles
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant SURVEYOR_ROLE = keccak256("SURVEYOR_ROLE");
    bytes32 public constant GOVERNMENT_ROLE = keccak256("GOVERNMENT_ROLE");

    /**
     * @dev Constructor
     * @param _accessControl Address of the access control contract
     */
    constructor(address _accessControl) {
        accessControl = TerraLedgerAccessControl(_accessControl);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(GOVERNMENT_ROLE, msg.sender);
    }

    /**
     * @dev Modifier to check parcel exists
     */
    modifier parcelMustExist(string calldata _parcelId) {
        if (!parcelExists[_parcelId]) revert ParcelNotFound(_parcelId);
        _;
    }

    /**
     * @dev Modifier to check caller is parcel owner
     */
    modifier onlyParcelOwner(string calldata _parcelId) {
        if (parcels[_parcelId].owner != msg.sender) {
            revert NotParcelOwner(_parcelId, msg.sender);
        }
        _;
    }

    /**
     * @dev Register a new land parcel (REQ-005)
     * @param _parcelId Unique parcel identifier
     * @param _owner Owner's wallet address
     * @param _areaSqM Area in square meters
     * @param _surveyNumber Survey number
     * @param _village Village name
     * @param _district District name
     * @param _state State name
     * @param _boundaryHash IPFS hash of GeoJSON boundaries
     * @param _ipfsDocHash IPFS hash of documents
     */
    function registerParcel(
        string calldata _parcelId,
        address _owner,
        uint256 _areaSqM,
        string calldata _surveyNumber,
        string calldata _village,
        string calldata _district,
        string calldata _state,
        string calldata _boundaryHash,
        string calldata _ipfsDocHash
    ) external onlyRole(REGISTRAR_ROLE) whenNotPaused {
        if (parcelExists[_parcelId]) revert ParcelAlreadyExists(_parcelId);
        if (_areaSqM == 0) revert InvalidArea();
        if (bytes(surveyToParcelId[_surveyNumber]).length > 0) {
            revert SurveyNumberExists(_surveyNumber);
        }

        LandParcel storage newParcel = parcels[_parcelId];
        newParcel.parcelId = _parcelId;
        newParcel.owner = _owner;
        newParcel.areaSqM = _areaSqM;
        newParcel.surveyNumber = _surveyNumber;
        newParcel.village = _village;
        newParcel.district = _district;
        newParcel.state = _state;
        newParcel.boundaryHash = _boundaryHash;
        newParcel.ipfsDocHash = _ipfsDocHash;
        newParcel.status = ParcelStatus.ACTIVE;
        newParcel.registeredAt = block.timestamp;
        newParcel.lastUpdatedAt = block.timestamp;
        newParcel.isForSale = false;

        parcelExists[_parcelId] = true;
        allParcelIds.push(_parcelId);
        ownerParcels[_owner].push(_parcelId);
        surveyToParcelId[_surveyNumber] = _parcelId;
        parcelPreviousOwners[_parcelId].push(_owner);

        // Add audit entry
        _addAuditEntry(
            _parcelId,
            msg.sender,
            "REGISTERED",
            "Initial registration"
        );

        emit ParcelRegistered(
            _parcelId,
            _owner,
            _areaSqM,
            _surveyNumber,
            block.timestamp
        );
    }

    /**
     * @dev Update parcel documents (REQ-007)
     * @param _parcelId Parcel identifier
     * @param _ipfsDocHash New IPFS hash of documents
     */
    function updateDocuments(
        string calldata _parcelId,
        string calldata _ipfsDocHash
    ) external parcelMustExist(_parcelId) whenNotPaused {
        LandParcel storage parcel = parcels[_parcelId];
        
        // Only owner or government can update documents
        require(
            parcel.owner == msg.sender || hasRole(GOVERNMENT_ROLE, msg.sender),
            "Unauthorized"
        );

        parcel.ipfsDocHash = _ipfsDocHash;
        parcel.lastUpdatedAt = block.timestamp;

        _addAuditEntry(
            _parcelId,
            msg.sender,
            "DOCUMENTS_UPDATED",
            _ipfsDocHash
        );

        emit DocumentsUpdated(_parcelId, _ipfsDocHash, block.timestamp);
    }

    /**
     * @dev Update parcel boundaries (requires surveyor)
     * @param _parcelId Parcel identifier
     * @param _boundaryHash New IPFS hash of GeoJSON boundaries
     */
    function updateBoundaries(
        string calldata _parcelId,
        string calldata _boundaryHash
    ) external onlyRole(SURVEYOR_ROLE) parcelMustExist(_parcelId) whenNotPaused {
        LandParcel storage parcel = parcels[_parcelId];
        
        parcel.boundaryHash = _boundaryHash;
        parcel.lastUpdatedAt = block.timestamp;

        _addAuditEntry(
            _parcelId,
            msg.sender,
            "BOUNDARIES_UPDATED",
            _boundaryHash
        );

        emit ParcelUpdated(_parcelId, msg.sender, "boundaries", block.timestamp);
    }

    /**
     * @dev List parcel for sale
     * @param _parcelId Parcel identifier
     * @param _price Listing price in wei
     */
    function listForSale(
        string calldata _parcelId,
        uint256 _price
    ) external parcelMustExist(_parcelId) onlyParcelOwner(_parcelId) whenNotPaused {
        if (_price == 0) revert InvalidPrice();
        
        LandParcel storage parcel = parcels[_parcelId];
        if (parcel.status == ParcelStatus.DISPUTED) revert ParcelIsDisputed(_parcelId);

        parcel.price = _price;
        parcel.isForSale = true;
        parcel.lastUpdatedAt = block.timestamp;

        _addAuditEntry(
            _parcelId,
            msg.sender,
            "LISTED_FOR_SALE",
            string(abi.encodePacked("Price: ", _uint2str(_price)))
        );

        emit ParcelListedForSale(_parcelId, msg.sender, _price, block.timestamp);
    }

    /**
     * @dev Remove parcel from sale listing
     * @param _parcelId Parcel identifier
     */
    function unlistFromSale(
        string calldata _parcelId
    ) external parcelMustExist(_parcelId) onlyParcelOwner(_parcelId) whenNotPaused {
        LandParcel storage parcel = parcels[_parcelId];
        
        parcel.price = 0;
        parcel.isForSale = false;
        parcel.lastUpdatedAt = block.timestamp;

        _addAuditEntry(_parcelId, msg.sender, "UNLISTED", "");

        emit ParcelUnlisted(_parcelId, msg.sender, block.timestamp);
    }

    /**
     * @dev Flag parcel as disputed
     * @param _parcelId Parcel identifier
     * @param _reason Dispute reason
     */
    function flagDispute(
        string calldata _parcelId,
        string calldata _reason
    ) external parcelMustExist(_parcelId) whenNotPaused {
        LandParcel storage parcel = parcels[_parcelId];
        
        parcel.status = ParcelStatus.DISPUTED;
        parcel.isForSale = false;
        parcel.lastUpdatedAt = block.timestamp;

        _addAuditEntry(_parcelId, msg.sender, "DISPUTE_RAISED", _reason);

        emit ParcelDisputed(_parcelId, msg.sender, _reason, block.timestamp);
    }

    /**
     * @dev Resolve parcel dispute (government only)
     * @param _parcelId Parcel identifier
     * @param _resolution Resolution details
     */
    function resolveDispute(
        string calldata _parcelId,
        string calldata _resolution
    ) external onlyRole(GOVERNMENT_ROLE) parcelMustExist(_parcelId) whenNotPaused {
        LandParcel storage parcel = parcels[_parcelId];
        
        parcel.status = ParcelStatus.ACTIVE;
        parcel.lastUpdatedAt = block.timestamp;

        _addAuditEntry(_parcelId, msg.sender, "DISPUTE_RESOLVED", _resolution);

        emit DisputeResolved(_parcelId, msg.sender, _resolution, block.timestamp);
    }

    /**
     * @dev Transfer ownership (called by escrow contract)
     * @param _parcelId Parcel identifier
     * @param _newOwner New owner address
     * @param _amount Transaction amount
     */
    function transferOwnership(
        string calldata _parcelId,
        address _newOwner,
        uint256 _amount
    ) external parcelMustExist(_parcelId) whenNotPaused nonReentrant {
        LandParcel storage parcel = parcels[_parcelId];
        
        // Only escrow contract or government can transfer
        require(
            hasRole(GOVERNMENT_ROLE, msg.sender),
            "Unauthorized transfer"
        );

        address previousOwner = parcel.owner;
        
        // Update parcel ownership
        parcel.owner = _newOwner;
        parcel.isForSale = false;
        parcel.price = 0;
        parcel.lastUpdatedAt = block.timestamp;

        // Update owner parcels mapping
        _removeFromOwnerParcels(previousOwner, _parcelId);
        ownerParcels[_newOwner].push(_parcelId);
        parcelPreviousOwners[_parcelId].push(_newOwner);

        // Record transaction
        TransactionRecord memory txRecord = TransactionRecord({
            txHash: keccak256(abi.encodePacked(_parcelId, previousOwner, _newOwner, block.timestamp)),
            seller: previousOwner,
            buyer: _newOwner,
            amount: _amount,
            status: 2, // Completed
            timestamp: block.timestamp,
            ipfsProofHash: ""
        });
        parcelTransactions[_parcelId].push(txRecord);

        _addAuditEntry(
            _parcelId,
            msg.sender,
            "OWNERSHIP_TRANSFERRED",
            string(abi.encodePacked("From: ", _addressToString(previousOwner), " To: ", _addressToString(_newOwner)))
        );

        emit OwnershipTransferred(
            _parcelId,
            previousOwner,
            _newOwner,
            _amount,
            block.timestamp
        );
    }

    /**
     * @dev Internal function to add audit entry
     */
    function _addAuditEntry(
        string memory _parcelId,
        address _actor,
        string memory _action,
        string memory _details
    ) internal {
        AuditEntry memory entry = AuditEntry({
            timestamp: block.timestamp,
            actor: _actor,
            action: _action,
            details: _details,
            txHash: bytes32(0)
        });
        parcelAuditTrail[_parcelId].push(entry);

        emit AuditEntryAdded(_parcelId, _actor, _action, block.timestamp);
    }

    /**
     * @dev Internal function to remove parcel from owner's list
     */
    function _removeFromOwnerParcels(address _owner, string memory _parcelId) internal {
        string[] storage parcelsOwned = ownerParcels[_owner];
        for (uint256 i = 0; i < parcelsOwned.length; i++) {
            if (keccak256(bytes(parcelsOwned[i])) == keccak256(bytes(_parcelId))) {
                parcelsOwned[i] = parcelsOwned[parcelsOwned.length - 1];
                parcelsOwned.pop();
                break;
            }
        }
    }

    // View Functions

    /**
     * @dev Get parcel details
     */
    function getParcel(string calldata _parcelId) external view returns (LandParcel memory) {
        if (!parcelExists[_parcelId]) revert ParcelNotFound(_parcelId);
        return parcels[_parcelId];
    }

    /**
     * @dev Get parcels owned by an address
     */
    function getOwnerParcels(address _owner) external view returns (string[] memory) {
        return ownerParcels[_owner];
    }

    /**
     * @dev Get parcel transaction history (REQ-009)
     */
    function getParcelTransactions(string calldata _parcelId) external view returns (TransactionRecord[] memory) {
        return parcelTransactions[_parcelId];
    }

    /**
     * @dev Get parcel audit trail (REQ-008)
     */
    function getParcelAuditTrail(string calldata _parcelId) external view returns (AuditEntry[] memory) {
        return parcelAuditTrail[_parcelId];
    }

    /**
     * @dev Get previous owners of a parcel
     */
    function getParcelPreviousOwners(string calldata _parcelId) external view returns (address[] memory) {
        return parcelPreviousOwners[_parcelId];
    }

    /**
     * @dev Get total parcel count
     */
    function getTotalParcels() external view returns (uint256) {
        return allParcelIds.length;
    }

    /**
     * @dev Get parcel ID by survey number
     */
    function getParcelBySurveyNumber(string calldata _surveyNumber) external view returns (string memory) {
        return surveyToParcelId[_surveyNumber];
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

    // Helper functions

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}
