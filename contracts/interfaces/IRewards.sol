// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;

import {IFeesEscrow} from "./IFeesEscrow.sol";

/**
 * @dev Interface of the RewardEthToken contract.
 */
interface IRewards {
    /**
    * @dev Structure for storing information about user reward checkpoint.
    * @param rewardPerToken - user reward per token.
    * @param reward - user reward checkpoint.
    */
    struct Checkpoint {
        uint128 reward;
        uint128 rewardPerToken;
    }

    /**
    * @dev Event for tracking updated protocol fee recipient.
    * @param recipient - address of the new fee recipient.
    */
    event ProtocolFeeRecipientUpdated(address recipient);

    /**
    * @dev Event for tracking updated protocol fee.
    * @param protocolFee - new protocol fee.
    */
    event ProtocolFeeUpdated(uint256 protocolFee);

    /**
    * @dev Event for tracking whether rewards distribution through merkle distributor is enabled/disabled.
    * @param account - address of the account.
    * @param isDisabled - whether rewards distribution is disabled.
    */
    event RewardsToggled(address indexed account, bool isDisabled);

    /**
    * @dev Event for tracking rewards update by oracles.
    * @param periodRewards - rewards since the last update.
    * @param totalRewards - total amount of rewards.
    * @param rewardPerToken - calculated reward per token for account reward calculation.
    * @param distributorReward - distributor reward.
    * @param protocolReward - protocol reward.
    */
    event RewardsUpdated(
        uint256 periodRewards,
        uint256 totalRewards,
        uint256 feesCollected,
        uint256 rewardPerToken,
        uint256 distributorReward,
        uint256 protocolReward
    );

    event UnstakeClaimed (
        address indexed account,
        uint256 totalAmount,
        uint256[] unstakeRequestsIndexes
    );

    event RewardsCashedOut(address indexed account, uint256 amount);

    event RewardsCompounded(address indexed account, uint256 amount);

    event AutoCompoundingToggled(address indexed account, bool isAutoCompounding);

    /**
    * @dev Function for getting the address of the merkle distributor.
    */
    function merkleDistributor() external view returns (address);

    /**
    * @dev Function for getting the address of the protocol fee recipient.
    */
    function protocolFeeRecipient() external view returns (address);

    /**
    * @dev Function for changing the protocol fee recipient's address.
    * @param recipient - new protocol fee recipient's address.
    */
    function setProtocolFeeRecipient(address recipient) external;

    /**
    * @dev Function for getting protocol fee. The percentage fee users pay from their reward for using the pool service.
    */
    function protocolFee() external view returns (uint256);

    /**
    * @dev Function for changing the protocol fee.
    * @param _protocolFee - new protocol fee. Must be less than 10000 (100.00%).
    */
    function setProtocolFee(uint256 _protocolFee) external;

    /**
    * @dev Function for retrieving the total amount of rewards rewards collected by the staking node
    * Cashed out and compound rewards are not deducted.
    */
    function totalRewards() external view returns (uint128);

    /**
    * @dev Function for retrieving the total collected fees amount (lyx sent to the FeesEscrow contract).
    */
    function totalFeesCollected() external view returns (uint128);

    /**
    * @dev Function for retrieving the total cashed out amount (including compound).
    */
    function totalCashedOut() external view returns (uint128);

    /**
    * @dev Function for retrieving the total available rewards amount (totalRewards - totalCashedOut).
    */
    function totalAvailableRewards() external view returns (uint128);

    /**
    * @dev Function for retrieving the total available rewards amount of an address
    */
    function balanceOf(address account) external view returns (uint256);

    /**
    * @dev Function for retrieving the last total rewards update block number.
    */
    function lastUpdateBlockNumber() external view returns (uint256);

    /**
    * @dev Function for retrieving current reward per token used for account reward calculation.
    */
    function rewardPerToken() external view returns (uint128);

    /**
    * @dev Function for setting whether rewards are disabled for the account.
    * Can only be called by the `StakedEthToken` contract.
    * @param account - address of the account to disable rewards for.
    * @param isDisabled - whether the rewards will be disabled.
    */
    function setRewardsDisabled(address account, bool isDisabled) external;

    /**
    * @dev Function to send LYX to the pool contract without activating it.
    * Can only be called by the `StakedEthToken` contract.
    * @param amount - amount of LYX to send to the pool without activation
    */
    function sendToPoolWithoutActivation(uint256 amount) external;

    /**
    * @dev Function for retrieving account's current checkpoint.
    * @param account - address of the account to retrieve the checkpoint for.
    */
    function checkpoints(address account) external view returns (uint128, uint128);

    /**
    * @dev Function for checking whether account's reward will be distributed through the merkle distributor.
    * @param account - address of the account.
    */
    function rewardsDisabled(address account) external view returns (bool);

    /**
    * @dev Function for updating account's reward checkpoint.
    * @param account - address of the account to update the reward checkpoint for.
    */
    function updateRewardCheckpoint(address account) external returns (bool);

    /**
    * @dev Function for updating reward checkpoints for two accounts simultaneously (for gas savings).
    * @param account1 - address of the first account to update the reward checkpoint for.
    * @param account2 - address of the second account to update the reward checkpoint for.
    */
    function updateRewardCheckpoints(address account1, address account2) external returns (bool, bool);

    /**
    * @dev Function for updating validators total rewards.
    * Can only be called by Oracles contract.
    * @param newTotalRewards - new total rewards.
    */
    function updateTotalRewards(uint256 newTotalRewards) external;

    /**
    * @dev Function for claiming rETH2 from the merkle distribution.
    * Can only be called by MerkleDistributor contract.
    * @param account - address of the account the tokens will be assigned to.
    * @param amount - amount of tokens to assign to the account.
    */
    function claim(address account, uint256 amount) external;

    /**
     * @dev Cash out accumulated rewards for the specified amount.
     * Requires account balance and contract balance to be sufficient. Transfers Lyx to the user.
     * Emits a {RewardsCashedOut} event.
     * @param amount The amount of rewards to cash out.
     */
    function cashOutRewards(uint256 amount) external;

    /**
     * @dev Toggle auto-compounding of rewards.
     * If auto-compounding is enabled, the protocol has the permission to compound rewards on behalf of the user.
     * emits a {AutoCompoundingToggled} event.
     */
    function toggleAutoCompounding() external;

    /**
     * @dev Compound in behalf of accounts accumulated rewards for the specified amount: transfer them to the pool as a stake on the behalf of the msg.sender.
     * Requires account balance and contract balance to be sufficient. Stakes the rewards to the pool.
     * @param accounts - The accounts to compound for.
     */
    function compoundOnBehalf(address[] calldata accounts) external;

    /**
     * @dev Compound accumulated rewards for the specified amount: transfer them to the pool as a stake on the behalf of the msg.sender.
     * Requires account balance and contract balance to be sufficient. Stakes the rewards to the pool.
     * @param amount - The amount of rewards to compound.
     */
    function compoundRewards(uint256 amount) external;

    /**
     * @dev Claim unstake for the specified request indexes.
     * Emits an {UnstakeClaimed} event. Transfers the total unstake amount to the user.
     * @param unstakeRequestIndexes - Array of indexes corresponding to the unstake requests to be claimed.
     */
    function claimUnstake(uint256[] calldata unstakeRequestIndexes) external;
}
