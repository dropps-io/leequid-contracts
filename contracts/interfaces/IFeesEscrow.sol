// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;

/**
 * @dev Interface of the FeesEscrow contract.
 */
interface IFeesEscrow {
    /**
    * @dev Event for tracking fees withdrawals to Rewards contract.
    * @param amount - the number of fees.
    */
    event FeesTransferred(uint256 amount);

    /**
    * @dev Function is used to transfer accumulated rewards to Rewards contract.
    * Can only be executed by the Rewards contract.
    */
    function transferToRewards() external returns (uint256);
}
