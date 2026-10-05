// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ISettleXBounty
 * @notice External interface for SettleXBounty dispute resolution and inspection.
 * @dev Future Decentralized Jury modules and external resolvers interact with SettleXBounty
 *      via this interface.
 */
interface ISettleXBounty {
    /**
     * @notice Resolves a bounty in DisputeReview by selecting exactly ONE Winner.
     * @param bountyId Identifier of the disputed bounty.
     * @param winnerSubmissionId The 1-based submission ID chosen as winner.
     */
    function resolveDispute(uint256 bountyId, uint256 winnerSubmissionId) external;

    /**
     * @notice Permissionlessly transitions a bounty from Reviewing to DisputeReview if 24h passed.
     * @param bountyId Identifier of the bounty.
     */
    function escalateToDispute(uint256 bountyId) external;
}
