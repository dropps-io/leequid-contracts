// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.4;

/**
 * @dev Interface of the StakedEthToken contract.
 */
interface IStakedLyxToken {
    /**
    * @dev Function for retrieving the total deposits amount.
    */
    function totalDeposits() external view returns (uint256);

    /**
    * @dev Function for retrieving the principal amount of the distributor.
    */
    function distributorPrincipal() external view returns (uint256);

    /**
    * @dev Function for toggling rewards for the account.
    * @param account - address of the account.
    * @param isDisabled - whether to disable account's rewards distribution.
    */
    function toggleRewards(address account, bool isDisabled) external;

    /**
    * @dev Function for creating `amount` tokens and assigning them to `account`.
    * Can only be called by Pool contract.
    * @param to - address of the account to assign tokens to.
    * @param amount - amount of tokens to assign.
    */
    function mint(address to,
        uint256 amount,
        bool allowNonLSP1Recipient,
        bytes memory data) external;
}
