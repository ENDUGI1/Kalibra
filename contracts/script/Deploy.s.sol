// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PredictionRegistry} from "../src/PredictionRegistry.sol";

/// @notice Deploys PredictionRegistry. The deployer becomes the owner (agent).
/// @dev    Usage (Amoy):
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
contract Deploy is Script {
    function run() external returns (PredictionRegistry registry) {
        vm.startBroadcast();
        registry = new PredictionRegistry();
        console.log("PredictionRegistry deployed at:", address(registry));
        console.log("Owner (agent):", registry.owner());
        vm.stopBroadcast();
    }
}
