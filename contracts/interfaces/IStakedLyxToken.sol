// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;

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
        uint256 validatorsToExit
    );

    event UnstakeProcessed(
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

    function totalUnstaked() external view returns (uint256);

    function totalPendingUnstake() external view returns (uint256);

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

    /**
     * @dev Request to unstake the specified amount of tokens from the user's account.
     * Requires the unstaking not to be in progress, and the amount to be greater than zero.
     * The amount to unstake is deducted from the user's balance, he won't receive rewards from it anymore.
     *
     * Emits a {NewUnstakeRequest} event.
     * @param amount The amount of tokens to unstake.
     */
    function unstake(uint256 amount) external;

    /**
     * @dev Fill unstake requests by matching stake requests to unstake requests, and return the amount matched.
     * Only callable by the pool. Requires unstaking not to be in progress.
     * @param amount The amount to match.
     * @return amountMatched The amount matched.
     */
    function matchUnstake(uint256 amount) external returns (uint256);

    /**
     * @dev Set unstake processing status to true. Block any new unstake request and stakes/unstakes matching.
     * The ensure the pending unstake value doesn't change while being processed.
     * Only callable by the oracles contract. Requires unstaking not to be in progress.
     * Emits either an {UnstakeReady} or {UnstakeCancelled} event.
     */
    function setUnstakeProcessing() external;

    /**
     * @dev Submit the unstake amount so users can claim their unstakes.
     * Only callable by the oracles contract. Requires unstaking to be in progress.
     * Requires the unstake amount to be a multiple of VALIDATOR_TOTAL_DEPOSIT LYX.
     * Emits an {UnstakeProcessed} event.
     * @param exitedValidators - The number of new exited validators.
     */
    function unstakeProcessed(uint256 exitedValidators) external;

    /**
     * @dev Claim unstake for the specified account and unstake request indexes.
     * Only callable by the rewardLyxToken contract that will transfer the claimed amount.
     * @param account - The account to claim unstake for.
     * @param unstakeRequestIndexes - Array of indexes corresponding to the unstake requests to be claimed.
     * @return totalClaimedAmount - The total amount claimed.
     */
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
