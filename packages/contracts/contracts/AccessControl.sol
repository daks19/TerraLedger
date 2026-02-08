// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TerraLedgerAccessControl
 * @dev Role-based access control for the TerraLedger Land Registry System
 * Implements REQ-001, REQ-002: Multi-role user registration and RBAC
 */
contract TerraLedgerAccessControl is AccessControl, Pausable, ReentrancyGuard {
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNMENT_OFFICIAL_ROLE = keccak256("GOVERNMENT_OFFICIAL_ROLE");
    bytes32 public constant LAND_OWNER_ROLE = keccak256("LAND_OWNER_ROLE");
    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");
    bytes32 public constant SURVEYOR_ROLE = keccak256("SURVEYOR_ROLE");
    bytes32 public constant NOTARY_ROLE = keccak256("NOTARY_ROLE");

    // KYC Status enum
    enum KYCStatus { PENDING, VERIFIED, REJECTED }

    // User structure
    struct User {
        address wallet;
        bytes32[] roles;
        KYCStatus kycStatus;
        bytes32 kycDocumentHash;  // Hash of Aadhaar/PAN/DL
        uint256 registeredAt;
        bool isActive;
        string metadataURI;      // IPFS URI for additional user data
    }

    // Mapping from wallet address to User
    mapping(address => User) public users;
    
    // Mapping to track registered users
    mapping(address => bool) public isRegistered;
    
    // Array of all registered addresses for enumeration
    address[] public registeredAddresses;
    
    // Multi-sig requirements for critical operations
    uint256 public requiredSignatures;
    mapping(bytes32 => mapping(address => bool)) public operationApprovals;
    mapping(bytes32 => uint256) public approvalCount;

    // Events
    event UserRegistered(address indexed wallet, bytes32[] roles, uint256 timestamp);
    event UserRoleGranted(address indexed wallet, bytes32 indexed role, address indexed grantor);
    event UserRoleRevoked(address indexed wallet, bytes32 indexed role, address indexed revoker);
    event KYCStatusUpdated(address indexed wallet, KYCStatus newStatus, address indexed updater);
    event KYCDocumentSubmitted(address indexed wallet, bytes32 documentHash);
    event OperationApproved(bytes32 indexed operationId, address indexed approver);
    event OperationExecuted(bytes32 indexed operationId);
    event UserDeactivated(address indexed wallet, address indexed deactivator);
    event UserReactivated(address indexed wallet, address indexed activator);

    // Custom errors
    error UserAlreadyRegistered(address wallet);
    error UserNotRegistered(address wallet);
    error InvalidKYCStatus();
    error UserNotActive(address wallet);
    error InsufficientApprovals(uint256 required, uint256 actual);
    error AlreadyApproved(address approver);
    error InvalidSignatureCount();
    error ZeroAddress();

    /**
     * @dev Constructor sets up initial admin
     * @param _admin Initial admin address
     * @param _requiredSignatures Number of signatures required for multi-sig operations
     */
    constructor(address _admin, uint256 _requiredSignatures) {
        if (_admin == address(0)) revert ZeroAddress();
        if (_requiredSignatures == 0) revert InvalidSignatureCount();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        requiredSignatures = _requiredSignatures;
    }

    /**
     * @dev Modifier to check if user is registered and active
     */
    modifier onlyActiveUser(address _wallet) {
        if (!isRegistered[_wallet]) revert UserNotRegistered(_wallet);
        if (!users[_wallet].isActive) revert UserNotActive(_wallet);
        _;
    }

    /**
     * @dev Modifier to check if user has verified KYC
     */
    modifier onlyVerifiedKYC(address _wallet) {
        if (users[_wallet].kycStatus != KYCStatus.VERIFIED) revert InvalidKYCStatus();
        _;
    }

    /**
     * @dev Register a new user with specified roles
     * @param _wallet User's wallet address
     * @param _roles Array of role identifiers to assign
     * @param _metadataURI IPFS URI for user metadata
     */
    function registerUser(
        address _wallet,
        bytes32[] calldata _roles,
        string calldata _metadataURI
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (_wallet == address(0)) revert ZeroAddress();
        if (isRegistered[_wallet]) revert UserAlreadyRegistered(_wallet);

        User storage newUser = users[_wallet];
        newUser.wallet = _wallet;
        newUser.roles = _roles;
        newUser.kycStatus = KYCStatus.PENDING;
        newUser.registeredAt = block.timestamp;
        newUser.isActive = true;
        newUser.metadataURI = _metadataURI;

        isRegistered[_wallet] = true;
        registeredAddresses.push(_wallet);

        // Grant each role
        for (uint256 i = 0; i < _roles.length; i++) {
            _grantRole(_roles[i], _wallet);
        }

        emit UserRegistered(_wallet, _roles, block.timestamp);
    }

    /**
     * @dev Self-registration for new users (requires KYC verification later)
     * @param _role Initial role requested
     * @param _metadataURI IPFS URI for user metadata
     */
    function selfRegister(
        bytes32 _role,
        string calldata _metadataURI
    ) external whenNotPaused {
        address _wallet = msg.sender;
        if (isRegistered[_wallet]) revert UserAlreadyRegistered(_wallet);

        // Only allow LAND_OWNER_ROLE and BUYER_ROLE for self-registration
        require(
            _role == LAND_OWNER_ROLE || _role == BUYER_ROLE,
            "Invalid role for self-registration"
        );

        bytes32[] memory roles = new bytes32[](1);
        roles[0] = _role;

        User storage newUser = users[_wallet];
        newUser.wallet = _wallet;
        newUser.roles = roles;
        newUser.kycStatus = KYCStatus.PENDING;
        newUser.registeredAt = block.timestamp;
        newUser.isActive = true;
        newUser.metadataURI = _metadataURI;

        isRegistered[_wallet] = true;
        registeredAddresses.push(_wallet);

        // Grant the requested role
        _grantRole(_role, _wallet);

        emit UserRegistered(_wallet, roles, block.timestamp);
    }

    /**
     * @dev Submit KYC document hash for verification
     * @param _documentHash Hash of the KYC document (Aadhaar/PAN/DL)
     */
    function submitKYCDocument(bytes32 _documentHash) external whenNotPaused {
        if (!isRegistered[msg.sender]) revert UserNotRegistered(msg.sender);
        
        users[msg.sender].kycDocumentHash = _documentHash;
        emit KYCDocumentSubmitted(msg.sender, _documentHash);
    }

    /**
     * @dev Update KYC status of a user (Government Official only)
     * @param _wallet User's wallet address
     * @param _status New KYC status
     */
    function updateKYCStatus(
        address _wallet,
        KYCStatus _status
    ) external onlyRole(GOVERNMENT_OFFICIAL_ROLE) whenNotPaused {
        if (!isRegistered[_wallet]) revert UserNotRegistered(_wallet);
        
        users[_wallet].kycStatus = _status;
        emit KYCStatusUpdated(_wallet, _status, msg.sender);
    }

    /**
     * @dev Grant additional role to a user
     * @param _wallet User's wallet address
     * @param _role Role to grant
     */
    function grantUserRole(
        address _wallet,
        bytes32 _role
    ) external onlyRole(ADMIN_ROLE) onlyActiveUser(_wallet) whenNotPaused {
        _grantRole(_role, _wallet);
        users[_wallet].roles.push(_role);
        emit UserRoleGranted(_wallet, _role, msg.sender);
    }

    /**
     * @dev Revoke role from a user
     * @param _wallet User's wallet address
     * @param _role Role to revoke
     */
    function revokeUserRole(
        address _wallet,
        bytes32 _role
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (!isRegistered[_wallet]) revert UserNotRegistered(_wallet);
        
        _revokeRole(_role, _wallet);
        
        // Remove from user's roles array
        bytes32[] storage roles = users[_wallet].roles;
        for (uint256 i = 0; i < roles.length; i++) {
            if (roles[i] == _role) {
                roles[i] = roles[roles.length - 1];
                roles.pop();
                break;
            }
        }
        
        emit UserRoleRevoked(_wallet, _role, msg.sender);
    }

    /**
     * @dev Deactivate a user account
     * @param _wallet User's wallet address
     */
    function deactivateUser(
        address _wallet
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (!isRegistered[_wallet]) revert UserNotRegistered(_wallet);
        
        users[_wallet].isActive = false;
        emit UserDeactivated(_wallet, msg.sender);
    }

    /**
     * @dev Reactivate a user account
     * @param _wallet User's wallet address
     */
    function reactivateUser(
        address _wallet
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (!isRegistered[_wallet]) revert UserNotRegistered(_wallet);
        
        users[_wallet].isActive = true;
        emit UserReactivated(_wallet, msg.sender);
    }

    /**
     * @dev Approve a multi-sig operation
     * @param _operationId Unique identifier for the operation
     */
    function approveOperation(
        bytes32 _operationId
    ) external onlyRole(GOVERNMENT_OFFICIAL_ROLE) whenNotPaused {
        if (operationApprovals[_operationId][msg.sender]) {
            revert AlreadyApproved(msg.sender);
        }
        
        operationApprovals[_operationId][msg.sender] = true;
        approvalCount[_operationId]++;
        
        emit OperationApproved(_operationId, msg.sender);
    }

    /**
     * @dev Check if operation has required approvals
     * @param _operationId Operation identifier
     * @return bool True if operation has enough approvals
     */
    function hasRequiredApprovals(bytes32 _operationId) public view returns (bool) {
        return approvalCount[_operationId] >= requiredSignatures;
    }

    /**
     * @dev Execute operation if it has required approvals
     * @param _operationId Operation identifier
     */
    function executeOperation(bytes32 _operationId) external whenNotPaused {
        if (!hasRequiredApprovals(_operationId)) {
            revert InsufficientApprovals(requiredSignatures, approvalCount[_operationId]);
        }
        
        emit OperationExecuted(_operationId);
    }

    /**
     * @dev Update required signatures count
     * @param _count New required signature count
     */
    function setRequiredSignatures(uint256 _count) external onlyRole(ADMIN_ROLE) {
        if (_count == 0) revert InvalidSignatureCount();
        requiredSignatures = _count;
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // View functions

    /**
     * @dev Get user details
     * @param _wallet User's wallet address
     */
    function getUser(address _wallet) external view returns (
        address wallet,
        bytes32[] memory roles,
        KYCStatus kycStatus,
        bytes32 kycDocumentHash,
        uint256 registeredAt,
        bool isActive,
        string memory metadataURI
    ) {
        User storage user = users[_wallet];
        return (
            user.wallet,
            user.roles,
            user.kycStatus,
            user.kycDocumentHash,
            user.registeredAt,
            user.isActive,
            user.metadataURI
        );
    }

    /**
     * @dev Get total registered users count
     */
    function getTotalUsers() external view returns (uint256) {
        return registeredAddresses.length;
    }

    /**
     * @dev Check if a user has a specific role
     * @param _wallet User's wallet address
     * @param _role Role to check
     */
    function userHasRole(address _wallet, bytes32 _role) external view returns (bool) {
        return hasRole(_role, _wallet);
    }

    /**
     * @dev Get all roles assigned to a user
     * @param _wallet User's wallet address
     */
    function getUserRoles(address _wallet) external view returns (bytes32[] memory) {
        return users[_wallet].roles;
    }
}
