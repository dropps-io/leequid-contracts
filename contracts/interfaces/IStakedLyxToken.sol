// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.4;

import {ILSP7DigitalAsset} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/ILSP7DigitalAsset.sol";

interface IStakedLyxToken is ILSP7DigitalAsset {

    struct UnstakeRequest {
        address account;
        uint128 amount;
        uint128 amountFilled;
        bool claimed;
    }

    event NewUnstakeRequest(
        uint256 indexed requestIndex,
        address indexed account,
        uint256 amount,
        uint256 newTotalPendingUnstake
    );

    event UnstakeMatched(
        uint256 amountMatched,
        uint256 newTotalPendingUnstake
    );

    event UnstakeReady(
        uint256 unstakeNonce
    );

    event UnstakeCancelled(
        uint256 unstakeNonce
    );

    event UnstakeProcessed(
        uint256 unstakeNonce,
        uint256 unstakeAmount,
        uint256 newTotalPendingUnstake
    );

    /**
    * @dev Function for getting the total validator deposit.
    */
    // solhint-disable-next-line func-name-mixedcase
    function VALIDATOR_TOTAL_DEPOSIT() external view returns (uint256);

    /**
    * @dev Function for retrieving the total deposits amount.
    */
    function totalDeposits() external view returns (uint256);

    function unstakeProcessing() external view returns (bool);

    function unstakeRequest(uint256 index) external view returns (UnstakeRequest memory);

    function isUnstakeRequestClaimable(uint256 index) external view returns (bool);

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

    function unstake(uint256 amount) external;

    function matchUnstake(uint256 amount) external returns (uint256);

    function setUnstakeProcessing(uint256 unstakeNonce) external returns (bool);

    function unstakeProcessed(uint256 unstakeNonce, uint256 unstakeAmount) external;

    function claimUnstake(address account, uint256[] calldata unstakeRequestIndexes) external returns (uint256);

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
