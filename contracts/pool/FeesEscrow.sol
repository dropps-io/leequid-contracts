// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;

import {IFeesEscrow} from '../interfaces/IFeesEscrow.sol';

/**
 * @title FeesEscrow
 *
 * @dev FeesEscrow contract is used to receive tips from validators and transfer
 * them to the Rewards contract via calling transferToRewards method by Rewards contract.
 */
contract FeesEscrow is IFeesEscrow {
  // @dev Rewards contract's address.
  address payable private immutable rewards;

  constructor(address _rewards) {
    rewards = payable(_rewards);
  }

  /**
   * @dev See {IFeesEscrow-transferToRewards}.
   */
  function transferToRewards() external override returns (uint256) {
    require(msg.sender == rewards, 'FeesEscrow: invalid caller');

    uint256 balance = address(this).balance;

    if (balance == 0) {
      return balance;
    }

    rewards.transfer(balance);

    emit FeesTransferred(balance);

    return balance;
  }

  /**
   * @dev Allows FeesEscrow contract to receive MEV rewards and priority fees. Later these rewards will be transferred
   * to the `Rewards` contract by `FeesEscrow.transferToRewards` method which is called by the `Rewards` contract.
   */
  receive() external payable {}
}
