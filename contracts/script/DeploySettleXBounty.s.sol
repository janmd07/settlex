// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SettleXBounty} from "../src/SettleXBounty.sol";

/**
 * @title DeploySettleXBounty
 * @notice Standalone Foundry deployment script for the SettleXBounty smart contract on Monad Testnet.
 * @dev Deploys SettleXBounty only. Does not hardcode private keys or accounts.
 *      Uses environment variables or CLI wallet broadcast (--account, --interactive, or DEPLOYER_PRIVATE_KEY).
 */
contract DeploySettleXBounty is Script {
    function run() external returns (SettleXBounty bountyHub) {
        // Read optional private key from environment; if not set, fallback to standard CLI broadcast sender
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        // Deploy SettleXBounty (no constructor arguments required)
        bountyHub = new SettleXBounty();

        vm.stopBroadcast();

        console2.log("=========================================");
        console2.log("SettleXBounty successfully deployed to:");
        console2.log(address(bountyHub));
        console2.log("=========================================");
    }
}
