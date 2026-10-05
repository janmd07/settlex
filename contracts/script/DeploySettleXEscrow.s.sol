// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SettleXEscrow} from "../src/SettleXEscrow.sol";

/**
 * @title DeploySettleXEscrow
 * @notice Standalone Foundry deployment script for the SettleXEscrow smart contract on Monad Testnet.
 * @dev Deploys SettleXEscrow only. Does not hardcode private keys or accounts.
 *      Uses environment variables or CLI wallet broadcast (--account, --interactive, or DEPLOYER_PRIVATE_KEY).
 */
contract DeploySettleXEscrow is Script {
    function run() external returns (SettleXEscrow escrow) {
        // Read optional private key from environment; if not set, fallback to standard CLI broadcast sender
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        // Deploy SettleXEscrow (no constructor arguments required)
        escrow = new SettleXEscrow();

        vm.stopBroadcast();

        console2.log("=========================================");
        console2.log("SettleXEscrow successfully deployed to:");
        console2.log(address(escrow));
        console2.log("=========================================");
    }
}
