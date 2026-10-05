// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IDisputeResolver
 * @notice Standard interface for external dispute resolution authorities in SettleX.
 * @dev SettleX V2 isolates dispute resolution authority from the core bounty contract.
 *      In V2, this can be an independent designated arbiter address or adapter contract.
 *      In future V3, this will be implemented by a Decentralized Jury contract
 *      coordinating multi-juror voting rounds.
 */
interface IDisputeResolver {
    /**
     * @notice Emitted when a dispute is assigned or initiated in the resolver.
     * @param bountyId Identifier of the bounty in dispute.
     * @param bountyContract Address of the SettleXBounty contract.
     */
    event DisputeAssigned(uint256 indexed bountyId, address indexed bountyContract);

    /**
     * @notice Emitted when a dispute resolution decision is finalized by the resolver.
     * @param bountyId Identifier of the bounty.
     * @param winnerSubmissionId The 1-based submission ID chosen as winner.
     * @param rationaleUri Link or IPFS URI detailing juror votes or evaluation rationale.
     */
    event DisputeFinalized(uint256 indexed bountyId, uint256 indexed winnerSubmissionId, string rationaleUri);

    /**
     * @notice Checks whether an account is authorized to act on behalf of the resolver for a given bounty.
     * @param bountyId The identifier of the bounty.
     * @param account The address to check.
     * @return isAuthorized True if authorized.
     */
    function isAuthorizedResolver(uint256 bountyId, address account) external view returns (bool isAuthorized);

    /**
     * @notice Returns the status or metadata of the dispute review for a given bounty.
     * @param bountyId The identifier of the bounty.
     * @return status A status identifier (e.g. "Pending", "InVoting", "Resolved").
     * @return detailsUri Reference to dispute evidence, juror votes, or rationale.
     */
    function getDisputeStatus(uint256 bountyId) external view returns (string memory status, string memory detailsUri);
}
