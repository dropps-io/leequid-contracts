// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

// interfaces
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// libraries
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

// modules
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

// constants
import { IStakedLyxToken } from "../interfaces/IStakedLyxToken.sol";
import { IRewardLyxToken } from "../interfaces/IRewardLyxToken.sol";
import { OwnablePausableUpgradeable } from "../presets/OwnablePausableUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { IRewardLyxToken } from "../interfaces/IRewardLyxToken.sol";
import { IFeesEscrow } from "../interfaces/IFeesEscrow.sol";

import { OwnablePausableUpgradeable } from "../presets/OwnablePausableUpgradeable.sol";


/**
 * @title LSP7DigitalAsset contract
 * @author Matthew Stevens
 * @dev Core Implementation of a LSP7 compliant contract.
 *
 * This contract implement the core logic of the functions for the {ILSP7DigitalAsset} interface.
 */
contract RewardLyxToken is IRewardLyxToken, OwnablePausableUpgradeable {
    using SafeCast for uint256;

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

    // @dev Total amount of cashed out rewards.
    uint128 public override totalCashedOutRewards;

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

    function initialize(
        address _admin,
        address _stakedLyxToken,
        address _oracles,
        address _protocolFeeRecipient,
        uint256 _protocolFee,
        address _merkleDistributor,
        address _feesEscrow
    ) external initializer {
        require(_stakedLyxToken != address(0), "RewardLyxToken: stakedLyxToken address cannot be zero");
        require(_admin != address(0), "RewardLyxToken: admin address cannot be zero");
        require(_oracles != address(0), "RewardLyxToken: oracles address cannot be zero");
        require(_merkleDistributor != address(0), "RewardLyxToken: merkleDistributor address cannot be zero");
        require(_feesEscrow != address(0), "RewardLyxToken: feesEscrow address cannot be zero");

        __OwnablePausableUpgradeable_init_unchained(_admin);
        stakedLyxToken = IStakedLyxToken(_stakedLyxToken);
        oracles = _oracles;
        protocolFeeRecipient = _protocolFeeRecipient;
        protocolFee = _protocolFee;
        merkleDistributor = _merkleDistributor;
        feesEscrow = IFeesEscrow(_feesEscrow);
    }

    receive() external payable {}

    // --- Token owner queries

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

    function totalAvailableRewards() public view virtual override returns (uint128) {
        return totalRewards - totalCashedOutRewards;
    }

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
                reward: _calculateNewReward(cp.reward, stakedLyxAmount, periodRewardPerToken).toUint128(),
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

    function setRewardsDisabled(address account, bool isDisabled) external override {
        require(msg.sender == address(stakedLyxToken), "RewardLyxToken: access denied");
        require(rewardsDisabled[account] != isDisabled, "RewardLyxToken: value did not change");

        uint128 _rewardPerToken = rewardPerToken;
        checkpoints[account] = Checkpoint({
            reward: _balanceOf(account, _rewardPerToken).toUint128(),
            rewardPerToken: _rewardPerToken
        });

        rewardsDisabled[account] = isDisabled;
        emit RewardsToggled(account, isDisabled);
    }

    function setProtocolFeeRecipient(address recipient) external override onlyAdmin {
        // can be address(0) to distribute fee through the Merkle Distributor
        protocolFeeRecipient = recipient;
        emit ProtocolFeeRecipientUpdated(recipient);
    }

    function setProtocolFee(uint256 _protocolFee) external override onlyAdmin {
        require(_protocolFee < 1e4, "RewardEthToken: invalid protocol fee");
        protocolFee = _protocolFee;
        emit ProtocolFeeUpdated(_protocolFee);
    }

    /**
     * @dev See {IRewardLyxToken-updateRewardCheckpoints}.
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
     * @dev See {IRewardLyxToken-updateTotalRewards}.
     */
    function updateTotalRewards(uint256 newTotalRewards) external override {
        require(msg.sender == oracles, "RewardLyxToken: access denied");

        newTotalRewards = newTotalRewards + feesEscrow.transferToPool();
        uint256 periodRewards = newTotalRewards - totalRewards;
        if (periodRewards == 0) {
            lastUpdateBlockNumber = block.number;
            emit RewardsUpdated(0, newTotalRewards, rewardPerToken, 0, 0);
            return;
        }

        // calculate protocol reward and new reward per token amount
        uint256 protocolReward = periodRewards * protocolFee / 1e4;
        uint256 prevRewardPerToken = rewardPerToken;
        uint256 newRewardPerToken = prevRewardPerToken + ((periodRewards - protocolReward) * 1e18) / stakedLyxToken.totalDeposits();
        uint128 newRewardPerToken128 = newRewardPerToken.toUint128();

        // store previous distributor rewards for period reward calculation
        uint256 prevDistributorBalance = _balanceOf(address(0), prevRewardPerToken);

        // update total rewards and new reward per token
        (totalRewards, rewardPerToken) = (newTotalRewards.toUint128(), newRewardPerToken128);

        uint256 newDistributorBalance = _balanceOf(address(0), newRewardPerToken);
        address _protocolFeeRecipient = protocolFeeRecipient;
        if (_protocolFeeRecipient == address(0) && protocolReward > 0) {
            // add protocol reward to the merkle distributor
            newDistributorBalance = newDistributorBalance + protocolReward;
        } else if (protocolReward > 0) {
            // update fee recipient's checkpoint and add its period reward
            checkpoints[_protocolFeeRecipient] = Checkpoint({
                reward: (_balanceOf(_protocolFeeRecipient, newRewardPerToken) + protocolReward).toUint128(),
                rewardPerToken: newRewardPerToken128
            });
        }

        // update distributor's checkpoint
        if (newDistributorBalance != prevDistributorBalance) {
            checkpoints[address(0)] = Checkpoint({
                reward: newDistributorBalance.toUint128(),
                rewardPerToken: newRewardPerToken128
            });
        }

        lastUpdateBlockNumber = block.number;
        emit RewardsUpdated(
            periodRewards,
            newTotalRewards,
            newRewardPerToken,
            newDistributorBalance - prevDistributorBalance,
            _protocolFeeRecipient == address(0) ? protocolReward: 0
        );
    }

    /**
     * @dev See {IRewardLyxToken-claim}.
     */
    function claim(address account, uint256 amount) external override {
        require(msg.sender == merkleDistributor, "RewardLyxToken: access denied");
        require(account != address(0), "RewardLyxToken: invalid account");

        // update checkpoints, transfer amount from distributor to account
        uint128 _rewardPerToken = rewardPerToken;
        checkpoints[address(0)] = Checkpoint({
            reward: (_balanceOf(address(0), _rewardPerToken) - amount).toUint128(),
            rewardPerToken: _rewardPerToken
        });
        checkpoints[account] = Checkpoint({
            reward: (_balanceOf(account, _rewardPerToken) + amount).toUint128(),
            rewardPerToken: _rewardPerToken
        });
    }

    function cashOutRewards(uint256 amount) external override {
        address payable recipient = payable(msg.sender);
        uint256 accountBalance = balanceOf(recipient);
        require(accountBalance >= amount, "RewardLyxToken: insufficient reward balance");
        require(address(this).balance >= amount, "RewardLyxToken: insufficient contract balance");

        uint128 _rewardPerToken = rewardPerToken;
        // Update the state before the transfer
        checkpoints[recipient] = Checkpoint({
            reward: (accountBalance - amount).toUint128(),
            rewardPerToken: _rewardPerToken
        });

        totalCashedOutRewards = (totalCashedOutRewards + amount).toUint128();

        // Transfer Ether after updating the state
        recipient.transfer(amount);
    }
}