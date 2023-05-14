// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;

import "../interfaces/IPool.sol";
import "../interfaces/IFeesEscrow.sol";

/**
 * @title FeesEscrow
 *
 * @dev FeesEscrow contract is used to receive tips from validators and transfer
 * them to the Pool contract via calling transferToPool method by RewardLyxToken contract.
 */
contract FeesEscrow is IFeesEscrow {
    // @dev Pool contract's address.
    IPool private immutable pool;

    // @dev RewardLyxToken contract's address.
    address private immutable rewardLyxToken;

    constructor(IPool _pool, address _rewardLyxToken) {
        pool = _pool;
        rewardLyxToken = _rewardLyxToken;
    }

    /**
     * @dev See {IFeesEscrow-transferToPool}.
     */
    function transferToPool() external override returns (uint256) {
        require(msg.sender == rewardLyxToken, "FeesEscrow: invalid caller");

        uint256 balance = address(this).balance;

        if (balance == 0) {
            return balance;
        }

        pool.receiveFees{value: balance}();

        emit FeesTransferred(balance);

        return balance;
    }

    /**
     * @dev Allows FeesEscrow contract to receive MEV rewards and priority fees. Later these rewards will be transferred
     * to the `Pool` contract by `FeesEscrow.transferToPool` method which is called by the `RewardLyxToken` contract.
     */
    receive() external payable {}
}
