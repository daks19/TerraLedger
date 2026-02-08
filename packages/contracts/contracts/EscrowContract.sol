// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LandRegistry.sol";

/**
 * @title EscrowContract
 * @dev Handles escrow mechanism for property transfers
 * Implements REQ-010 through REQ-014: Ownership Transfer & Transactions
 */
contract EscrowContract is AccessControl, Pausable, ReentrancyGuard {
    // Reference to land registry
    LandRegistry public landRegistry;

    // Transaction status (REQ-014)
    enum TransactionStatus { 
        PENDING,      // 0 - Initial state
        FUNDED,       // 1 - Buyer deposited funds
        VERIFIED,     // 2 - Government verified
        COMPLETED,    // 3 - Transfer complete
        FAILED,       // 4 - Transaction failed
        REFUNDED,     // 5 - Funds returned to buyer
        CANCELLED     // 6 - Cancelled by parties
    }

    // Escrow transaction structure
    struct EscrowTransaction {
        uint256 escrowId;
        string parcelId;
        address seller;
        address buyer;
        uint256 amount;
        uint256 platformFee;      // Platform fee amount
        TransactionStatus status;
        uint256 createdAt;
        uint256 completedAt;
        bool sellerApproved;      // Multi-sig: seller approval
        bool buyerApproved;       // Multi-sig: buyer approval
        bool governmentApproved;  // Multi-sig: government approval (REQ-012)
        string documentsHash;     // IPFS hash of transaction documents
        uint256 deadline;         // Deadline for completion
    }

    // Mappings
    mapping(uint256 => EscrowTransaction) public escrows;
    mapping(string => uint256[]) public parcelEscrows;
    mapping(address => uint256[]) public userEscrows;
    
    // Escrow counter
    uint256 public escrowCounter;

    // Platform fee (basis points, e.g., 50 = 0.5%)
    uint256 public platformFeeBps;
    uint256 public constant MAX_PLATFORM_FEE = 500; // Max 5%
    
    // Treasury address for platform fees
    address public treasury;

    // Timeout for escrow transactions (default 30 days)
    uint256 public escrowTimeout;

    // Events
    event EscrowCreated(
        uint256 indexed escrowId,
        string parcelId,
        address indexed seller,
        address indexed buyer,
        uint256 amount,
        uint256 timestamp
    );
    event EscrowFunded(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 amount,
        uint256 timestamp
    );
    event SellerApproval(
        uint256 indexed escrowId,
        address indexed seller,
        uint256 timestamp
    );
    event BuyerApproval(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 timestamp
    );
    event GovernmentApproval(
        uint256 indexed escrowId,
        address indexed official,
        uint256 timestamp
    );
    event EscrowCompleted(
        uint256 indexed escrowId,
        address indexed seller,
        address indexed buyer,
        uint256 amount,
        uint256 timestamp
    );
    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 amount,
        uint256 timestamp
    );
    event EscrowCancelled(
        uint256 indexed escrowId,
        address indexed canceller,
        string reason,
        uint256 timestamp
    );
    event DocumentsUploaded(
        uint256 indexed escrowId,
        string ipfsHash,
        uint256 timestamp
    );
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // Custom errors
    error InvalidAmount();
    error EscrowNotFound(uint256 escrowId);
    error InvalidStatus(TransactionStatus expected, TransactionStatus actual);
    error UnauthorizedAccess();
    error NotSeller();
    error NotBuyer();
    error AlreadyApproved();
    error InsufficientFunds();
    error DeadlinePassed();
    error TransferFailed();
    error FeeTooHigh();

    // Roles
    bytes32 public constant GOVERNMENT_ROLE = keccak256("GOVERNMENT_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
     * @dev Constructor
     * @param _landRegistry Address of LandRegistry contract
     * @param _treasury Treasury address for fees
     * @param _platformFeeBps Platform fee in basis points
     */
    constructor(
        address _landRegistry,
        address _treasury,
        uint256 _platformFeeBps
    ) {
        if (_platformFeeBps > MAX_PLATFORM_FEE) revert FeeTooHigh();
        
        landRegistry = LandRegistry(_landRegistry);
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
        escrowTimeout = 30 days;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(GOVERNMENT_ROLE, msg.sender);
    }

    /**
     * @dev Create a new escrow for property purchase (REQ-010)
     * @param _parcelId Land parcel ID
     * @param _seller Seller address
     * @param _amount Purchase amount in wei
     */
    function createEscrow(
        string calldata _parcelId,
        address _seller,
        uint256 _amount
    ) external whenNotPaused returns (uint256) {
        if (_amount == 0) revert InvalidAmount();
        
        // Verify parcel exists and is for sale
        LandRegistry.LandParcel memory parcel = landRegistry.getParcel(_parcelId);
        require(parcel.isForSale, "Parcel not for sale");
        require(parcel.owner == _seller, "Seller not owner");
        require(_amount >= parcel.price, "Amount less than listing price");

        escrowCounter++;
        uint256 escrowId = escrowCounter;

        uint256 fee = (_amount * platformFeeBps) / 10000;

        EscrowTransaction storage escrow = escrows[escrowId];
        escrow.escrowId = escrowId;
        escrow.parcelId = _parcelId;
        escrow.seller = _seller;
        escrow.buyer = msg.sender;
        escrow.amount = _amount;
        escrow.platformFee = fee;
        escrow.status = TransactionStatus.PENDING;
        escrow.createdAt = block.timestamp;
        escrow.deadline = block.timestamp + escrowTimeout;

        parcelEscrows[_parcelId].push(escrowId);
        userEscrows[msg.sender].push(escrowId);
        userEscrows[_seller].push(escrowId);

        emit EscrowCreated(
            escrowId,
            _parcelId,
            _seller,
            msg.sender,
            _amount,
            block.timestamp
        );

        return escrowId;
    }

    /**
     * @dev Fund the escrow (buyer deposits funds)
     * @param _escrowId Escrow ID
     */
    function fundEscrow(uint256 _escrowId) external payable whenNotPaused nonReentrant {
        EscrowTransaction storage escrow = escrows[_escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(_escrowId);
        if (escrow.buyer != msg.sender) revert NotBuyer();
        if (escrow.status != TransactionStatus.PENDING) {
            revert InvalidStatus(TransactionStatus.PENDING, escrow.status);
        }
        if (msg.value < escrow.amount + escrow.platformFee) revert InsufficientFunds();
        if (block.timestamp > escrow.deadline) revert DeadlinePassed();

        escrow.status = TransactionStatus.FUNDED;
        escrow.buyerApproved = true;

        emit EscrowFunded(_escrowId, msg.sender, msg.value, block.timestamp);
        emit BuyerApproval(_escrowId, msg.sender, block.timestamp);
    }

    /**
     * @dev Seller approves the transaction (REQ-012)
     * @param _escrowId Escrow ID
     */
    function sellerApprove(uint256 _escrowId) external whenNotPaused {
        EscrowTransaction storage escrow = escrows[_escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(_escrowId);
        if (escrow.seller != msg.sender) revert NotSeller();
        if (escrow.sellerApproved) revert AlreadyApproved();
        if (escrow.status != TransactionStatus.FUNDED) {
            revert InvalidStatus(TransactionStatus.FUNDED, escrow.status);
        }

        escrow.sellerApproved = true;
        emit SellerApproval(_escrowId, msg.sender, block.timestamp);

        // Check if all approvals received
        _checkAndExecuteTransfer(_escrowId);
    }

    /**
     * @dev Government official approves the transaction (REQ-012)
     * @param _escrowId Escrow ID
     */
    function governmentApprove(uint256 _escrowId) external onlyRole(GOVERNMENT_ROLE) whenNotPaused {
        EscrowTransaction storage escrow = escrows[_escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(_escrowId);
        if (escrow.governmentApproved) revert AlreadyApproved();
        if (escrow.status != TransactionStatus.FUNDED) {
            revert InvalidStatus(TransactionStatus.FUNDED, escrow.status);
        }

        escrow.governmentApproved = true;
        escrow.status = TransactionStatus.VERIFIED;
        
        emit GovernmentApproval(_escrowId, msg.sender, block.timestamp);

        // Check if all approvals received
        _checkAndExecuteTransfer(_escrowId);
    }

    /**
     * @dev Upload transaction documents
     * @param _escrowId Escrow ID
     * @param _documentsHash IPFS hash of documents
     */
    function uploadDocuments(
        uint256 _escrowId,
        string calldata _documentsHash
    ) external whenNotPaused {
        EscrowTransaction storage escrow = escrows[_escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(_escrowId);
        require(
            escrow.buyer == msg.sender || 
            escrow.seller == msg.sender ||
            hasRole(GOVERNMENT_ROLE, msg.sender),
            "Unauthorized"
        );

        escrow.documentsHash = _documentsHash;
        emit DocumentsUploaded(_escrowId, _documentsHash, block.timestamp);
    }

    /**
     * @dev Internal function to check approvals and execute transfer
     */
    function _checkAndExecuteTransfer(uint256 _escrowId) internal {
        EscrowTransaction storage escrow = escrows[_escrowId];
        
        // All three parties must approve (REQ-012)
        if (escrow.sellerApproved && escrow.buyerApproved && escrow.governmentApproved) {
            _executeTransfer(_escrowId);
        }
    }

    /**
     * @dev Execute the property transfer (REQ-011)
     */
    function _executeTransfer(uint256 _escrowId) internal nonReentrant {
        EscrowTransaction storage escrow = escrows[_escrowId];
        
        // Update land registry ownership
        landRegistry.transferOwnership(
            escrow.parcelId,
            escrow.buyer,
            escrow.amount
        );

        // Transfer funds to seller
        uint256 sellerAmount = escrow.amount;
        (bool sellerSuccess, ) = payable(escrow.seller).call{value: sellerAmount}("");
        if (!sellerSuccess) revert TransferFailed();

        // Transfer platform fee to treasury
        if (escrow.platformFee > 0) {
            (bool feeSuccess, ) = payable(treasury).call{value: escrow.platformFee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        escrow.status = TransactionStatus.COMPLETED;
        escrow.completedAt = block.timestamp;

        emit EscrowCompleted(
            _escrowId,
            escrow.seller,
            escrow.buyer,
            escrow.amount,
            block.timestamp
        );
    }

    /**
     * @dev Refund buyer if transaction fails or times out
     * @param _escrowId Escrow ID
     */
    function refundBuyer(uint256 _escrowId) external whenNotPaused nonReentrant {
        EscrowTransaction storage escrow = escrows[_escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(_escrowId);
        
        // Can refund if: deadline passed, or government/admin initiated, or seller cancelled
        bool canRefund = block.timestamp > escrow.deadline ||
                        hasRole(GOVERNMENT_ROLE, msg.sender) ||
                        hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                        (escrow.seller == msg.sender && escrow.status == TransactionStatus.FUNDED);
        
        require(canRefund, "Cannot refund");
        require(
            escrow.status == TransactionStatus.FUNDED || 
            escrow.status == TransactionStatus.VERIFIED,
            "Cannot refund"
        );

        uint256 refundAmount = escrow.amount + escrow.platformFee;
        escrow.status = TransactionStatus.REFUNDED;

        (bool success, ) = payable(escrow.buyer).call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit EscrowRefunded(_escrowId, escrow.buyer, refundAmount, block.timestamp);
    }

    /**
     * @dev Cancel escrow (before funding)
     * @param _escrowId Escrow ID
     * @param _reason Cancellation reason
     */
    function cancelEscrow(
        uint256 _escrowId,
        string calldata _reason
    ) external whenNotPaused {
        EscrowTransaction storage escrow = escrows[_escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(_escrowId);
        
        require(
            escrow.buyer == msg.sender || 
            escrow.seller == msg.sender ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Unauthorized"
        );
        require(escrow.status == TransactionStatus.PENDING, "Cannot cancel funded escrow");

        escrow.status = TransactionStatus.CANCELLED;
        emit EscrowCancelled(_escrowId, msg.sender, _reason, block.timestamp);
    }

    // Admin Functions

    /**
     * @dev Update platform fee
     * @param _newFeeBps New fee in basis points
     */
    function updatePlatformFee(uint256 _newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newFeeBps > MAX_PLATFORM_FEE) revert FeeTooHigh();
        emit PlatformFeeUpdated(platformFeeBps, _newFeeBps);
        platformFeeBps = _newFeeBps;
    }

    /**
     * @dev Update treasury address
     * @param _newTreasury New treasury address
     */
    function updateTreasury(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newTreasury != address(0), "Invalid address");
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }

    /**
     * @dev Update escrow timeout
     * @param _timeout New timeout in seconds
     */
    function updateEscrowTimeout(uint256 _timeout) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_timeout >= 1 days, "Timeout too short");
        escrowTimeout = _timeout;
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
     * @dev Get escrow details
     */
    function getEscrow(uint256 _escrowId) external view returns (EscrowTransaction memory) {
        if (escrows[_escrowId].escrowId == 0) revert EscrowNotFound(_escrowId);
        return escrows[_escrowId];
    }

    /**
     * @dev Get escrows for a parcel
     */
    function getParcelEscrows(string calldata _parcelId) external view returns (uint256[] memory) {
        return parcelEscrows[_parcelId];
    }

    /**
     * @dev Get escrows for a user
     */
    function getUserEscrows(address _user) external view returns (uint256[] memory) {
        return userEscrows[_user];
    }

    /**
     * @dev Check if escrow has all approvals
     */
    function hasAllApprovals(uint256 _escrowId) external view returns (bool) {
        EscrowTransaction storage escrow = escrows[_escrowId];
        return escrow.sellerApproved && escrow.buyerApproved && escrow.governmentApproved;
    }

    /**
     * @dev Calculate platform fee for amount
     */
    function calculateFee(uint256 _amount) external view returns (uint256) {
        return (_amount * platformFeeBps) / 10000;
    }

    /**
     * @dev Get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Emergency withdrawal (admin only, for stuck funds)
     */
    function emergencyWithdraw(address _to, uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_to != address(0), "Invalid address");
        (bool success, ) = payable(_to).call{value: _amount}("");
        if (!success) revert TransferFailed();
    }

    receive() external payable {}
}
