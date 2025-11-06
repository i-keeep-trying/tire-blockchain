// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract TyrePassportV2 {
    enum LifecycleState { MANUFACTURED, IN_MARKET, IN_SERVICE, COLLECTED, RECYCLED }

    struct EventRecord {
        uint256 timestamp;
        string eventType;
        bytes32 offchainHash;
        string offchainURI;
        address actor;
    }

    struct Passport {
        string tireId;
        string batchId;
        address currentOwner;
        LifecycleState state;
        EventRecord[] history;
        bool exists;
    }

    // --- minimal state ---
    mapping(address => string) public roles;          // address -> "Manufacturer"/etc.
    mapping(string => Passport) private passports;    // tireId -> passport
    mapping(string => string[]) private batchToTires; // batchId -> tireIds

    // --- events ---
    event TyreEvent(
        string tireId,
        string batchId,
        string eventType,
        bytes32 offchainHash,
        string offchainURI,
        address actor,
        uint256 timestamp,
        address currentOwner,
        LifecycleState state
    );

    // --- helpers ---
    modifier onlyRole(string memory r) {
        require(keccak256(bytes(roles[msg.sender])) == keccak256(bytes(r)), "bad role");
        _;
    }

    // --- role setup (simple) ---
    function registerRole(address who, string calldata roleName) external {
        roles[who] = roleName;
    }

    // --- minimal mint with batchId (single tyre) ---
    function mintTirePassport(string calldata tireId, string calldata batchId)
        external
        onlyRole("Manufacturer")
    {
        require(!passports[tireId].exists, "exists");

        Passport storage p = passports[tireId];
        p.tireId = tireId;
        p.batchId = batchId;
        p.currentOwner = msg.sender;
        p.state = LifecycleState.MANUFACTURED;
        p.exists = true;

        batchToTires[batchId].push(tireId);

        _pushEvent(p, "MINTED", bytes32(0), "");
    }

    /// @notice Mint multiple tyres under the same batch in one go
    function mintBatch(string calldata batchId, string[] calldata tireIds)
        external
        onlyRole("Manufacturer")
    {
        require(bytes(batchId).length > 0, "batchId empty");
        require(tireIds.length > 0, "no tyres");

        for (uint256 i = 0; i < tireIds.length; i++) {
            // use memory local to ensure smooth keying into mapping
            string memory tireId = tireIds[i];
            require(!passports[tireId].exists, "tire exists");

            Passport storage p = passports[tireId];
            p.tireId = tireId;
            p.batchId = batchId;
            p.currentOwner = msg.sender;
            p.state = LifecycleState.MANUFACTURED;
            p.exists = true;

            batchToTires[batchId].push(tireId);
            _pushEvent(p, "MINTED", bytes32(0), "");
        }
    }

    // --- internal event logger ---
    function _pushEvent(
        Passport storage p,
        string memory eventType,
        bytes32 offchainHash,
        string memory offchainURI
    ) internal {
        p.history.push(EventRecord({
            timestamp: block.timestamp,
            eventType: eventType,
            offchainHash: offchainHash,
            offchainURI: offchainURI,
            actor: msg.sender
        }));

        emit TyreEvent(
            p.tireId,
            p.batchId,
            eventType,
            offchainHash,
            offchainURI,
            msg.sender,
            block.timestamp,
            p.currentOwner,
            p.state
        );
    }

    function transferOwnership(string calldata tireId, address newOwner) external {
        Passport storage p = passports[tireId];
        require(p.exists, "unknown tire");
        require(msg.sender == p.currentOwner, "not owner");
        require(bytes(roles[newOwner]).length > 0, "newOwner unregistered");

        p.currentOwner = newOwner;
        _pushEvent(p, "TRANSFER_OWNERSHIP", bytes32(0), "");
    }

    function getPassport(string calldata tireId) external view returns (
        string memory, string memory, address, LifecycleState, uint256
    ) {
        Passport storage p = passports[tireId];
        require(p.exists, "unknown tire");
        return (p.tireId, p.batchId, p.currentOwner, p.state, p.history.length);
    }

    function recordEvent(
        string calldata tireId,
        string calldata eventType,
        bytes32 offchainHash,
        string calldata offchainURI
    ) external {
        Passport storage p = passports[tireId];
        require(p.exists, "unknown tire");
        // any registered role can add an event; tighten later if needed
        require(bytes(roles[msg.sender]).length > 0, "unregistered actor");

        _pushEvent(p, eventType, offchainHash, offchainURI);
    }

    function updateState(string calldata tireId, LifecycleState newState) external {
        Passport storage p = passports[tireId];
        require(p.exists, "unknown tire");
        require(msg.sender == p.currentOwner, "not owner");

        // Optional role guards for terminal states
        if (newState == LifecycleState.COLLECTED) {
            require(keccak256(bytes(roles[msg.sender])) == keccak256(bytes("Collector")), "only Collector");
        }
        if (newState == LifecycleState.RECYCLED) {
            require(keccak256(bytes(roles[msg.sender])) == keccak256(bytes("Recycler")), "only Recycler");
        }

        p.state = newState;
        _pushEvent(p, "STATE_UPDATE", bytes32(0), "");
    }

    function getBatchTires(string calldata batchId) external view returns (string[] memory) {
        return batchToTires[batchId];
    }
}
