// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title PredictionRegistry
/// @notice Commit-reveal registry for an accountable forecasting agent.
///         The agent commits a *hash* of its probability forecast before a match
///         starts (anti-backdating), reveals it after the match, and records the
///         realized outcome + Brier score. Calibration reputation is aggregated
///         on-chain. This contract never holds funds and never places bets.
/// @dev    Phase 0: access control is a single owner (the agent address). Do not
///         over-engineer — multi-agent / staking / slashing is Phase 1+.
contract PredictionRegistry {
    /// @dev Probabilities and Brier scores are stored in basis points (0..10000).
    uint256 public constant BPS_DENOMINATOR = 10_000;

    enum Status {
        None, // 0 — never committed
        Committed, // 1 — hash on-chain, not yet revealed
        Revealed, // 2 — probability revealed, awaiting outcome
        Resolved // 3 — outcome + Brier recorded
    }

    struct Prediction {
        bytes32 predictionHash; // keccak256(abi.encode(probBps, salt))
        uint64 committedAt; // block.timestamp at commit (anti-backdating proof)
        uint32 probBps; // revealed forecast P(home win), 0..10000
        uint32 brierBps; // recorded Brier score, 0..10000
        bool outcome; // realized outcome (true = home win)
        Status status;
    }

    address public immutable owner;

    /// @notice marketId => prediction record
    mapping(bytes32 => Prediction) public predictions;

    /// @notice number of resolved predictions (denominator for avg Brier)
    uint256 public resolvedCount;
    /// @notice running sum of recorded Brier scores in bps
    uint256 public sumBrierBps;

    event Committed(
        bytes32 indexed marketId, address indexed agent, bytes32 predictionHash, uint256 timestamp
    );
    event Revealed(bytes32 indexed marketId, uint256 probBps);
    event Resolved(bytes32 indexed marketId, bool outcome, uint256 brierScoreBps);

    error NotOwner();
    error ZeroHash();
    error AlreadyCommitted();
    error NotCommitted();
    error AlreadyRevealed();
    error NotRevealed();
    error AlreadyResolved();
    error HashMismatch();
    error ProbOutOfRange();
    error BrierOutOfRange();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Commit a hashed forecast for a market before it resolves.
    /// @param marketId        Opaque market identifier (e.g. keccak of the venue's market id).
    /// @param predictionHash  keccak256(abi.encode(probBps, salt)).
    function commitPrediction(bytes32 marketId, bytes32 predictionHash) external onlyOwner {
        if (predictionHash == bytes32(0)) revert ZeroHash();
        Prediction storage p = predictions[marketId];
        if (p.status != Status.None) revert AlreadyCommitted();

        p.predictionHash = predictionHash;
        p.committedAt = uint64(block.timestamp);
        p.status = Status.Committed;

        emit Committed(marketId, msg.sender, predictionHash, block.timestamp);
    }

    /// @notice Reveal the forecast; the salted hash must match the prior commit.
    /// @param probBps  Forecast P(home win) in basis points, 0..10000.
    /// @param salt     The random salt used at commit time.
    function revealPrediction(bytes32 marketId, uint256 probBps, bytes32 salt) external onlyOwner {
        Prediction storage p = predictions[marketId];
        if (p.status == Status.None) revert NotCommitted();
        if (p.status != Status.Committed) revert AlreadyRevealed();
        if (probBps > BPS_DENOMINATOR) revert ProbOutOfRange();
        if (keccak256(abi.encode(probBps, salt)) != p.predictionHash) revert HashMismatch();

        p.probBps = uint32(probBps);
        p.status = Status.Revealed;

        emit Revealed(marketId, probBps);
    }

    /// @notice Record the realized outcome and Brier score; updates reputation.
    /// @param outcome         Realized result (true = home win).
    /// @param brierScoreBps   Brier score in basis points, 0..10000 (0 = perfect).
    function recordOutcome(bytes32 marketId, bool outcome, uint256 brierScoreBps)
        external
        onlyOwner
    {
        Prediction storage p = predictions[marketId];
        if (p.status == Status.None || p.status == Status.Committed) revert NotRevealed();
        if (p.status == Status.Resolved) revert AlreadyResolved();
        if (brierScoreBps > BPS_DENOMINATOR) revert BrierOutOfRange();

        p.outcome = outcome;
        p.brierBps = uint32(brierScoreBps);
        p.status = Status.Resolved;

        unchecked {
            resolvedCount += 1;
            sumBrierBps += brierScoreBps;
        }

        emit Resolved(marketId, outcome, brierScoreBps);
    }

    /// @notice Aggregate calibration reputation.
    /// @return count        number of resolved predictions
    /// @return avgBrierBps  mean Brier score in bps (0 when no resolutions yet)
    function getReputation() external view returns (uint256 count, uint256 avgBrierBps) {
        count = resolvedCount;
        avgBrierBps = count == 0 ? 0 : sumBrierBps / count;
    }

    /// @notice Convenience getter returning the full prediction record.
    function getPrediction(bytes32 marketId) external view returns (Prediction memory) {
        return predictions[marketId];
    }
}
