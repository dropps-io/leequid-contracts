// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

// libraries
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

// constants
import { IStakedLyxToken } from "../interfaces/IStakedLyxToken.sol";
import { OwnablePausableUpgradeable } from "../presets/OwnablePausableUpgradeable.sol";
import { IRewards } from "../interfaces/IRewards.sol";
import { IFeesEscrow } from "../interfaces/IFeesEscrow.sol";

import { IPool } from "../interfaces/IPool.sol";

/**
 * @title LSP7DigitalAsset contract
 * @author Matthew Stevens
 * @dev Core Implementation of a LSP7 compliant contract.
 *
 * This contract implement the core logic of the functions for the {ILSP7DigitalAsset} interface.
 */
contract Rewards is IRewards, OwnablePausableUpgradeable, ReentrancyGuardUpgradeable {
    // @dev Address of the StakedLyxToken contract.
    IStakedLyxToken private stakedLyxToken;

    // @dev Address of the Oracles contract.
    address private oracles;

    // @dev Maps account address to its reward checkpoint.
    mapping(address => Checkpoint) public override checkpoints;

    // @dev Address where protocol fee will be paid.
    address public override protocolFeeRecipient;

    // @dev Protocol percentage fee.
    uint256 public override protocolFee;

    // @dev Total amount of rewards.
    uint128 public override totalRewards;

    // @dev Total amount of rewards.
    uint128 public override totalFeesCollected;

    // @dev Total amount of cashed out rewards.
    uint128 public override totalCashedOut;

    // @dev Reward per token for user reward calculation.
    uint128 public override rewardPerToken;

    // @dev Last rewards update block number by oracles.
    uint256 public override lastUpdateBlockNumber;

    // @dev Address of the MerkleDistributor contract.
    address public override merkleDistributor;

    // @dev Maps account address to whether rewards are distributed through the merkle distributor.
    mapping(address => bool) public override rewardsDisabled;

    // @dev Address of the FeesEscrow contract.
    IFeesEscrow private feesEscrow;

    // @dev Address of the Pool contract.
    IPool private pool;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _stakedLyxToken,
        address _oracles,
        address _protocolFeeRecipient,
        uint256 _protocolFee,
        address _merkleDistributor,
        address _feesEscrow,
        address _pool
    ) external initializer {
        require(_stakedLyxToken != address(0), "Rewards: stakedLyxToken address cannot be zero");
        require(_admin != address(0), "Rewards: admin address cannot be zero");
        require(_oracles != address(0), "Rewards: oracles address cannot be zero");
        require(_merkleDistributor != address(0), "Rewards: merkleDistributor address cannot be zero");
        require(_feesEscrow != address(0), "Rewards: feesEscrow address cannot be zero");
        require(_protocolFee < 1e4, "RewardEthToken: invalid protocol fee");
        require(_pool != address(0), "Rewards: pool address cannot be zero");

        __OwnablePausableUpgradeable_init_unchained(_admin);
        stakedLyxToken = IStakedLyxToken(_stakedLyxToken);
        oracles = _oracles;
        protocolFeeRecipient = _protocolFeeRecipient;
        protocolFee = _protocolFee;
        merkleDistributor = _merkleDistributor;
        feesEscrow = IFeesEscrow(_feesEscrow);
        pool = IPool(_pool);
    }

    receive() external payable {}

    // --- Token owner queries

    /**
     * @dev See {IRewards-balanceOf}.
     */
    function balanceOf(address account) public view virtual override returns (uint256) {
        return _balanceOf(account, rewardPerToken);
    }

    function _balanceOf(address account, uint256 _rewardPerToken) internal view returns (uint256) {
        Checkpoint memory cp = checkpoints[account];

        // skip calculating period reward when it has not changed or when the rewards are disabled
        if (_rewardPerToken == cp.rewardPerToken || rewardsDisabled[account]) return cp.reward;

        uint256 stakedLyxAmount;
        if (account == address(0)) {
            // fetch merkle distributor current principal
            stakedLyxAmount = stakedLyxToken.distributorPrincipal();
        } else {
            stakedLyxAmount = stakedLyxToken.balanceOf(account);
        }
        if (stakedLyxAmount == 0) return cp.reward;

        // return checkpoint reward + current reward
        return _calculateNewReward(cp.reward, stakedLyxAmount, _rewardPerToken - cp.rewardPerToken);
    }

    /**
    * @dev See {IRewards-totalAvailableRewards}.
     */
    function totalAvailableRewards() public view virtual override returns (uint128) {
        return totalRewards + totalFeesCollected - totalCashedOut;
    }

    /**
    * @dev See {IRewards-updateRewardCheckpoint}.
     */
    function updateRewardCheckpoint(address account) public override returns (bool accRewardsDisabled) {
        accRewardsDisabled = rewardsDisabled[account];
        if (!accRewardsDisabled) _updateRewardCheckpoint(account, rewardPerToken);
    }

    function _updateRewardCheckpoint(address account, uint128 newRewardPerToken) internal {
        Checkpoint memory cp = checkpoints[account];
        if (newRewardPerToken == cp.rewardPerToken) return;

        uint256 stakedLyxAmount;
        if (account == address(0)) {
            // fetch merkle distributor current principal
            stakedLyxAmount = stakedLyxToken.distributorPrincipal();
        } else {
            stakedLyxAmount = stakedLyxToken.balanceOf(account);
        }
        if (stakedLyxAmount == 0) {
            checkpoints[account] = Checkpoint({
                reward: cp.reward,
                rewardPerToken: newRewardPerToken
            });
        } else {
            uint256 periodRewardPerToken = uint256(newRewardPerToken) - cp.rewardPerToken;
            checkpoints[account] = Checkpoint({
                reward: uint128(_calculateNewReward(cp.reward, stakedLyxAmount, periodRewardPerToken)),
                rewardPerToken: newRewardPerToken
            });
        }
    }

    function _calculateNewReward(
        uint256 currentReward,
        uint256 stakedLyxAmount,
        uint256 periodRewardPerToken
    )
    internal pure returns (uint256)
    {
        return currentReward + stakedLyxAmount * periodRewardPerToken / 1e18;
    }

    /**
    * @dev See {IRewards-setRewardsDisabled}.
    */
    function setRewardsDisabled(address account, bool isDisabled) external override {
        require(msg.sender == address(stakedLyxToken), "Rewards: access denied");
        require(rewardsDisabled[account] != isDisabled, "Rewards: value did not change");

        uint128 _rewardPerToken = rewardPerToken;
        checkpoints[account] = Checkpoint({
            reward: uint128(_balanceOf(account, _rewardPerToken)),
            rewardPerToken: _rewardPerToken
        });

        rewardsDisabled[account] = isDisabled;
        emit RewardsToggled(account, isDisabled);
    }

    /**
    * @dev See {IRewards-sendToPoolWithoutActivation}.
    */
    function sendToPoolWithoutActivation(uint256 amount) external override {
        require(msg.sender == address(stakedLyxToken), "Rewards: access denied");
        require(address(this).balance >= amount, "Rewards: insufficient contract balance");

        pool.receiveWithoutActivation{value : amount}();
    }

    /**
    * @dev See {IRewards-setProtocolFeeRecipient}.
    */
    function setProtocolFeeRecipient(address recipient) external override onlyAdmin {
        // can be address(0) to distribute fee through the Merkle Distributor
        protocolFeeRecipient = recipient;
        emit ProtocolFeeRecipientUpdated(recipient);
    }

    /**
    * @dev See {IRewards-setProtocolFee}.
    */
    function setProtocolFee(uint256 _protocolFee) external override onlyAdmin {
        require(_protocolFee < 1e4, "RewardEthToken: invalid protocol fee");
        protocolFee = _protocolFee;
        emit ProtocolFeeUpdated(_protocolFee);
    }

    /**
     * @dev See {IRewards-updateRewardCheckpoints}.
     */
    function updateRewardCheckpoints(address account1, address account2) public override returns (bool rewardsDisabled1, bool rewardsDisabled2) {
        rewardsDisabled1 = rewardsDisabled[account1];
        rewardsDisabled2 = rewardsDisabled[account2];
        if (!rewardsDisabled1 || !rewardsDisabled2) {
            uint128 newRewardPerToken = rewardPerToken;
            if (!rewardsDisabled1) _updateRewardCheckpoint(account1, newRewardPerToken);
            if (!rewardsDisabled2) _updateRewardCheckpoint(account2, newRewardPerToken);
        }
    }

    /**
     * @dev See {IRewards-updateTotalRewards}.
     */
    function updateTotalRewards(uint256 newTotalRewards) external override {
        require(msg.sender == oracles, "Rewards: access denied");

        uint256 totalDeposits = stakedLyxToken.totalDeposits();
        if (totalDeposits == 0) return;

        uint256 feesCollected = feesEscrow.transferToRewards();
        uint256 periodRewards = newTotalRewards + uint128(feesCollected) - totalRewards;
        if (periodRewards == 0) {
            lastUpdateBlockNumber = block.number;
            emit RewardsUpdated(0, newTotalRewards, feesCollected, rewardPerToken, 0, 0);
            return;
        }

        // calculate protocol reward and new reward per token amount
        uint256 protocolReward = periodRewards * protocolFee / 1e4;
        uint256 prevRewardPerToken = rewardPerToken;
        uint256 newRewardPerToken = prevRewardPerToken + ((periodRewards - protocolReward) * 1e18) / totalDeposits;
        uint128 newRewardPerToken128 = uint128(newRewardPerToken);

        // store previous distributor rewards for period reward calculation
        uint256 prevDistributorBalance = _balanceOf(address(0), prevRewardPerToken);

        // update total rewards and new reward per token
        (totalRewards, rewardPerToken) = (uint128(newTotalRewards), newRewardPerToken128);
        totalFeesCollected = totalFeesCollected + uint128(feesCollected);

        uint256 newDistributorBalance = _balanceOf(address(0), newRewardPerToken);
        address _protocolFeeRecipient = protocolFeeRecipient;
        if (_protocolFeeRecipient == address(0) && protocolReward > 0) {
            // add protocol reward to the merkle distributor
            newDistributorBalance = newDistributorBalance + protocolReward;
        } else if (protocolReward > 0) {
            // update fee recipient's checkpoint and add its period reward
            checkpoints[_protocolFeeRecipient] = Checkpoint({
                reward: uint128(_balanceOf(_protocolFeeRecipient, newRewardPerToken) + protocolReward),
                rewardPerToken: newRewardPerToken128
            });
        }

        // update distributor's checkpoint
        if (newDistributorBalance != prevDistributorBalance) {
            checkpoints[address(0)] = Checkpoint({
                reward: uint128(newDistributorBalance),
                rewardPerToken: newRewardPerToken128
            });
        }

        lastUpdateBlockNumber = block.number;
        emit RewardsUpdated(
            periodRewards,
            newTotalRewards,
            feesCollected,
            newRewardPerToken,
            newDistributorBalance - prevDistributorBalance,
            _protocolFeeRecipient == address(0) ? protocolReward: 0
        );
    }

    /**
     * @dev See {IRewards-claim}.
     */
    function claim(address account, uint256 amount) external override {
        require(msg.sender == merkleDistributor, "Rewards: access denied");
        require(account != address(0), "Rewards: invalid account");

        // update checkpoints, transfer amount from distributor to account
        uint128 _rewardPerToken = rewardPerToken;
        checkpoints[address(0)] = Checkpoint({
            reward: uint128(_balanceOf(address(0), _rewardPerToken) - amount),
            rewardPerToken: _rewardPerToken
        });
        checkpoints[account] = Checkpoint({
            reward: uint128(_balanceOf(account, _rewardPerToken) + amount),
            rewardPerToken: _rewardPerToken
        });
    }

    /**
     * @dev See {IRewards-claimUnstake}.
     */
    function claimUnstake(uint256[] calldata unstakeRequestIndexes) external override nonReentrant whenNotPaused {
        require(unstakeRequestIndexes.length > 0, "Rewards: no unstake indexes provided");
        address payable account = payable(msg.sender);

        uint256 totalUnstakeAmount = stakedLyxToken.claimUnstake(account, unstakeRequestIndexes);

        emit UnstakeClaimed(account, totalUnstakeAmount, unstakeRequestIndexes);

        account.transfer(totalUnstakeAmount);
    }

    /**
     * @dev See {IRewards-cashOutRewards}.
     */
    function cashOutRewards(uint256 amount) external override nonReentrant {
        address payable recipient = payable(msg.sender);

        _cashOutAccountRewards(recipient, amount);

        // Transfer Ether after updating the state
        recipient.transfer(amount);
        emit RewardsCashedOut(recipient, amount);
    }

    /**
     * @dev See {IRewards-compoundRewards}.
     */
    function compoundRewards(uint256 amount) external override nonReentrant {
        address recipient = msg.sender;

        _cashOutAccountRewards(recipient, amount);

        // Stake the rewards to the pool
        pool.stakeOnBehalf{value : amount}(recipient);
        emit RewardsCompounded(recipient, amount);
    }


    /**
     * @dev Internal function to cash out account rewards for the specified amount.
     * This method updates the state before the transfer and emits a {RewardsCashedOut} event.
     * Requires account balance and contract balance to be sufficient. Updates the state before
     * the transfer and emits a {RewardsCashedOut} event.
     * @param account - The account to cash out rewards for.
     * @param amount - The amount of rewards to cash out.
     */
    function _cashOutAccountRewards(address account, uint256 amount) internal whenNotPaused {
        uint256 accountBalance = balanceOf(account);
        require(accountBalance >= amount, "Rewards: insufficient reward balance");
        require(address(this).balance >= amount, "Rewards: insufficient contract balance");

        uint128 _rewardPerToken = rewardPerToken;
        // Update the state before the transfer
        checkpoints[account] = Checkpoint({
            reward: uint128(accountBalance - amount),
            rewardPerToken: _rewardPerToken
        });

        totalCashedOut = uint128(totalCashedOut + amount);
    }
}