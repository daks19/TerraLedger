// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TerraLedgerRegistry
 * @dev Simplified land registry for demo - stores parcel hashes on-chain
 */
contract TerraLedgerRegistry {
    address public owner;
    
    struct ParcelRecord {
        string parcelId;
        bytes32 dataHash;      // Hash of off-chain data
        address registeredBy;
        uint256 timestamp;
        bool exists;
    }
    
    mapping(string => ParcelRecord) public parcels;
    string[] public parcelIds;
    
    event ParcelRegistered(string indexed parcelId, bytes32 dataHash, address indexed registeredBy, uint256 timestamp);
    event ParcelUpdated(string indexed parcelId, bytes32 newDataHash, address indexed updatedBy, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function registerParcel(string calldata _parcelId, bytes32 _dataHash) external onlyOwner {
        require(!parcels[_parcelId].exists, "Parcel already exists");
        
        parcels[_parcelId] = ParcelRecord({
            parcelId: _parcelId,
            dataHash: _dataHash,
            registeredBy: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });
        
        parcelIds.push(_parcelId);
        emit ParcelRegistered(_parcelId, _dataHash, msg.sender, block.timestamp);
    }
    
    function updateParcel(string calldata _parcelId, bytes32 _newDataHash) external onlyOwner {
        require(parcels[_parcelId].exists, "Parcel not found");
        
        parcels[_parcelId].dataHash = _newDataHash;
        parcels[_parcelId].timestamp = block.timestamp;
        
        emit ParcelUpdated(_parcelId, _newDataHash, msg.sender, block.timestamp);
    }
    
    function verifyParcel(string calldata _parcelId, bytes32 _dataHash) external view returns (bool) {
        if (!parcels[_parcelId].exists) return false;
        return parcels[_parcelId].dataHash == _dataHash;
    }
    
    function getParcel(string calldata _parcelId) external view returns (
        string memory parcelId,
        bytes32 dataHash,
        address registeredBy,
        uint256 timestamp,
        bool exists
    ) {
        ParcelRecord memory p = parcels[_parcelId];
        return (p.parcelId, p.dataHash, p.registeredBy, p.timestamp, p.exists);
    }
    
    function getParcelCount() external view returns (uint256) {
        return parcelIds.length;
    }
}
