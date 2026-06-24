// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PredictionRegistry} from "../src/PredictionRegistry.sol";

contract PredictionRegistryTest is Test {
    PredictionRegistry internal registry;

    address internal agent = address(this); // deployer = owner
    address internal stranger = address(0xBEEF);

    bytes32 internal constant MARKET = keccak256("ARS-CHE-2026-08-15");
    bytes32 internal constant SALT = keccak256("salt-v1");
    uint256 internal constant PROB_BPS = 6900; // P(home win) = 0.69

    function setUp() public {
        registry = new PredictionRegistry();
    }

    function _hash(uint256 probBps, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(probBps, salt));
    }

    // --- happy path: commit -> reveal -> record ---------------------------------

    function test_CommitRevealRecord_HappyPath() public {
        bytes32 h = _hash(PROB_BPS, SALT);

        vm.expectEmit(true, true, false, true);
        emit PredictionRegistry.Committed(MARKET, agent, h, block.timestamp);
        registry.commitPrediction(MARKET, h);

        PredictionRegistry.Prediction memory afterCommit = registry.getPrediction(MARKET);
        assertEq(uint8(afterCommit.status), uint8(PredictionRegistry.Status.Committed));
        assertEq(afterCommit.committedAt, uint64(block.timestamp));

        vm.expectEmit(true, false, false, true);
        emit PredictionRegistry.Revealed(MARKET, PROB_BPS);
        registry.revealPrediction(MARKET, PROB_BPS, SALT);

        PredictionRegistry.Prediction memory afterReveal = registry.getPrediction(MARKET);
        assertEq(uint8(afterReveal.status), uint8(PredictionRegistry.Status.Revealed));
        assertEq(afterReveal.probBps, uint32(PROB_BPS));

        // Brier for outcome=home win (o=1): (0.69 - 1)^2 = 0.0961 -> 961 bps
        uint256 brierBps = 961;
        vm.expectEmit(true, false, false, true);
        emit PredictionRegistry.Resolved(MARKET, true, brierBps);
        registry.recordOutcome(MARKET, true, brierBps);

        PredictionRegistry.Prediction memory afterRecord = registry.getPrediction(MARKET);
        assertEq(uint8(afterRecord.status), uint8(PredictionRegistry.Status.Resolved));
        assertEq(afterRecord.brierBps, uint32(brierBps));
        assertTrue(afterRecord.outcome);

        (uint256 count, uint256 avgBrierBps) = registry.getReputation();
        assertEq(count, 1);
        assertEq(avgBrierBps, brierBps);
    }

    function test_Reputation_AveragesAcrossMarkets() public {
        _commitRevealRecord(keccak256("m1"), 5000, SALT, true, 2500);
        _commitRevealRecord(keccak256("m2"), 5000, SALT, false, 2500);

        (uint256 count, uint256 avgBrierBps) = registry.getReputation();
        assertEq(count, 2);
        assertEq(avgBrierBps, 2500);
    }

    // --- reveal with a non-matching hash must revert ----------------------------

    function test_Reveal_WrongSalt_Reverts() public {
        registry.commitPrediction(MARKET, _hash(PROB_BPS, SALT));

        vm.expectRevert(PredictionRegistry.HashMismatch.selector);
        registry.revealPrediction(MARKET, PROB_BPS, keccak256("wrong-salt"));
    }

    function test_Reveal_WrongProb_Reverts() public {
        registry.commitPrediction(MARKET, _hash(PROB_BPS, SALT));

        vm.expectRevert(PredictionRegistry.HashMismatch.selector);
        registry.revealPrediction(MARKET, 5000, SALT); // committed 6900, revealing 5000
    }

    // --- guard rails ------------------------------------------------------------

    function test_Commit_Twice_Reverts() public {
        bytes32 h = _hash(PROB_BPS, SALT);
        registry.commitPrediction(MARKET, h);
        vm.expectRevert(PredictionRegistry.AlreadyCommitted.selector);
        registry.commitPrediction(MARKET, h);
    }

    function test_Commit_ZeroHash_Reverts() public {
        vm.expectRevert(PredictionRegistry.ZeroHash.selector);
        registry.commitPrediction(MARKET, bytes32(0));
    }

    function test_Reveal_BeforeCommit_Reverts() public {
        vm.expectRevert(PredictionRegistry.NotCommitted.selector);
        registry.revealPrediction(MARKET, PROB_BPS, SALT);
    }

    function test_Reveal_ProbOutOfRange_Reverts() public {
        // hash an out-of-range prob so we get past the hash check to the range guard
        uint256 badProb = 10_001;
        registry.commitPrediction(MARKET, _hash(badProb, SALT));
        vm.expectRevert(PredictionRegistry.ProbOutOfRange.selector);
        registry.revealPrediction(MARKET, badProb, SALT);
    }

    function test_Record_BeforeReveal_Reverts() public {
        registry.commitPrediction(MARKET, _hash(PROB_BPS, SALT));
        vm.expectRevert(PredictionRegistry.NotRevealed.selector);
        registry.recordOutcome(MARKET, true, 961);
    }

    function test_Record_Twice_Reverts() public {
        registry.commitPrediction(MARKET, _hash(PROB_BPS, SALT));
        registry.revealPrediction(MARKET, PROB_BPS, SALT);
        registry.recordOutcome(MARKET, true, 961);
        vm.expectRevert(PredictionRegistry.AlreadyResolved.selector);
        registry.recordOutcome(MARKET, true, 961);
    }

    function test_OnlyOwner_Commit_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(PredictionRegistry.NotOwner.selector);
        registry.commitPrediction(MARKET, _hash(PROB_BPS, SALT));
    }

    // --- helper -----------------------------------------------------------------

    function _commitRevealRecord(
        bytes32 marketId,
        uint256 probBps,
        bytes32 salt,
        bool outcome,
        uint256 brierBps
    ) internal {
        registry.commitPrediction(marketId, _hash(probBps, salt));
        registry.revealPrediction(marketId, probBps, salt);
        registry.recordOutcome(marketId, outcome, brierBps);
    }
}
