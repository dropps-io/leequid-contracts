// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;

import "../interfaces/IFeesEscrow.sol";

/**
 * @title FeesEscrow
 *
 * @dev FeesEscrow contract is used to receive tips from validators and transfer
 * them to the RewardLyxToken contract via calling transferToRewards method by RewardLyxToken contract.
 */
contract FeesEscrow is IFeesEscrow {
    // @dev RewardLyxToken contract's address.
    address payable private immutable rewardLyxToken;

    constructor(address _rewardLyxToken) {
        rewardLyxToken = payable(_rewardLyxToken);
    }

    /**
     * @dev See {IFeesEscrow-transferToRewards}.
     */
    function transferToRewards() external override returns (uint256) {
        require(msg.sender == rewardLyxToken, "FeesEscrow: invalid caller");

        uint256 balance = address(this).balance;

        if (balance == 0) {
            return balance;
        }

        rewardLyxToken.transfer(balance);

        emit FeesTransferred(balance);

        return balance;
    }

    /**
     * @dev Allows FeesEscrow contract to receive MEV rewards and priority fees. Later these rewards will be transferred
     * to the `RewardLyxToken` contract by `FeesEscrow.transferToRewards` method which is called by the `RewardLyxToken` contract.
     */
    receive() external payable {}
}
