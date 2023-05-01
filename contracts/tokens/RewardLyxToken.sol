// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

// interfaces
import {ILSP1UniversalReceiver} from "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/ILSP1UniversalReceiver.sol";
import {ILSP7DigitalAsset} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/ILSP7DigitalAsset.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// libraries
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {GasLib} from "@lukso/lsp-smart-contracts/contracts/Utils/GasLib.sol";

// modules
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// errors
import "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Errors.sol";

// constants
import { _INTERFACEID_LSP1 } from "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Constants.sol";
import { _TYPEID_LSP7_TOKENSSENDER, _TYPEID_LSP7_TOKENSRECIPIENT } from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Constants.sol";
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
abstract contract RewardLyxToken is ILSP7DigitalAsset, IRewardLyxToken, OwnablePausableUpgradeable {
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

    bool internal _isNonDivisible;

    // Mapping from `tokenOwner` to an `amount` of tokens
    mapping(address => uint256) internal _tokenOwnerBalances;

    // Mapping a `tokenOwner` to an `operator` to `amount` of tokens.
    mapping(address => mapping(address => uint256)) internal _operatorAuthorizedAmount;

    function initialize(
        address _admin,
        address _stakedLyxToken,
        address _oracles,
        address _protocolFeeRecipient,
        uint256 _protocolFee,
        address _merkleDistributor,
        address _feesEscrow,
        bool _isNonDivisible
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
        _isNonDivisible = _isNonDivisible;
    }


    // --- Token queries

    /**
     * @inheritdoc ILSP7DigitalAsset
     */
    function decimals() public view virtual override returns (uint8) {
        return _isNonDivisible ? 0 : 18;
    }

    /**
     * @inheritdoc ILSP7DigitalAsset
     */
    function totalSupply() public view virtual override returns (uint256) {
        return totalRewards;
    }

    // --- Token owner queries

    /**
     * @inheritdoc ILSP7DigitalAsset
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
     * @dev See {IRewardLyxToken-updateRewardCheckpoint}.
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

    /**
     * @dev See {IRewardLyxToken-setRewardsDisabled}.
     */
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

    /**
     * @dev See {IRewardLyxToken-setProtocolFeeRecipient}.
     */
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

    // --- Operator functionality

    /**
     * @inheritdoc ILSP7DigitalAsset
     *
     * @dev To avoid front-running and Allowance Double-Spend Exploit when
     * increasing or decreasing the authorized amount of an operator,
     * it is advised to:
     *     1. call {revokeOperator} first, and
     *     2. then re-call {authorizeOperator} with the new amount
     *
     * for more information, see:
     * https://docs.google.com/document/d/1YLPtQxZu1UAvO9cZ1O2RPXBbT0mooh4DYKjA_jp-RLM/
     *
     */
    function authorizeOperator(address operator, uint256 amount) public virtual override {
        _updateOperator(msg.sender, operator, amount);
    }

    /**
     * @inheritdoc ILSP7DigitalAsset
     */
    function revokeOperator(address operator) public virtual override {
        _updateOperator(msg.sender, operator, 0);
    }

    /**
     * @inheritdoc ILSP7DigitalAsset
     */
    function authorizedAmountFor(address operator, address tokenOwner)
    public
    view
    virtual
    override
    returns (uint256)
    {
        if (tokenOwner == operator) {
            return _tokenOwnerBalances[tokenOwner];
        } else {
            return _operatorAuthorizedAmount[tokenOwner][operator];
        }
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
        uint256 newRewardPerToken = prevRewardPerToken + (periodRewards - protocolReward * 1e18 / stakedLyxToken.totalDeposits());
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

        emit Transfer(msg.sender, address(0), account, amount, true, "");
    }

    // --- Transfer functionality

    /**
     * @inheritdoc ILSP7DigitalAsset
     */
    function transfer(
        address from,
        address to,
        uint256 amount,
        bool allowNonLSP1Recipient,
        bytes memory data
    ) public virtual override {
        if (from == to) revert LSP7CannotSendToSelf();

        address operator = msg.sender;
        if (operator != from) {
            uint256 operatorAmount = _operatorAuthorizedAmount[from][operator];
            if (amount > operatorAmount) {
                revert LSP7AmountExceedsAuthorizedAmount(from, operatorAmount, operator, amount);
            }

            _updateOperator(from, operator, operatorAmount - amount);
        }

        _transfer(from, to, amount, allowNonLSP1Recipient, data);
    }

    /**
     * @inheritdoc ILSP7DigitalAsset
     */
    function transferBatch(
        address[] memory from,
        address[] memory to,
        uint256[] memory amount,
        bool[] memory allowNonLSP1Recipient,
        bytes[] memory data
    ) public virtual override {
        uint256 fromLength = from.length;
        if (
            fromLength != to.length ||
            fromLength != amount.length ||
            fromLength != allowNonLSP1Recipient.length ||
            fromLength != data.length
        ) {
            revert LSP7InvalidTransferBatch();
        }

        for (uint256 i = 0; i < fromLength; ) {
            // using the public transfer function to handle updates to operator authorized amounts
            transfer(from[i], to[i], amount[i], allowNonLSP1Recipient[i], data[i]);

        unchecked {
            ++i;
        }
        }
    }

    /**
     * @dev Changes token `amount` the `operator` has access to from `tokenOwner` tokens. If the
     * amount is zero then the operator is being revoked, otherwise the operator amount is being
     * modified.
     *
     * See {authorizedAmountFor}.
     *
     * Emits either {AuthorizedOperator} or {RevokedOperator} event.
     *
     * Requirements
     *
     * - `operator` cannot be the zero address.
     */
    function _updateOperator(
        address tokenOwner,
        address operator,
        uint256 amount
    ) internal virtual {
        if (operator == address(0)) {
            revert LSP7CannotUseAddressZeroAsOperator();
        }

        if (operator == tokenOwner) {
            revert LSP7TokenOwnerCannotBeOperator();
        }

        _operatorAuthorizedAmount[tokenOwner][operator] = amount;

        if (amount != 0) {
            emit AuthorizedOperator(operator, tokenOwner, amount);
        } else {
            emit RevokedOperator(operator, tokenOwner);
        }
    }

    /**
     * @dev Transfers `amount` tokens from `from` to `to`.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `from` cannot be the zero address.
     * - `from` must have at least `amount` tokens.
     * - If the caller is not `from`, it must be an operator for `from` with access to at least
     * `amount` tokens.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(
        address from,
        address to,
        uint256 amount,
        bool allowNonLSP1Recipient,
        bytes memory data
    ) internal virtual {
        require(block.number > lastUpdateBlockNumber, "RewardLyxToken: cannot transfer during rewards update");
        if (from == address(0) || to == address(0)) {
            revert LSP7CannotSendWithAddressZero();
        }

        address operator = msg.sender;

        _beforeTokenTransfer(from, to, amount);

        uint128 _rewardPerToken = rewardPerToken; // gas savings
        checkpoints[from] = Checkpoint({
            reward: (_balanceOf(from, _rewardPerToken) - amount).toUint128(),
            rewardPerToken: _rewardPerToken
        });
        checkpoints[to] = Checkpoint({
            reward: (_balanceOf(to, _rewardPerToken) + amount).toUint128(),
            rewardPerToken: _rewardPerToken
        });

        emit Transfer(operator, from, to, amount, allowNonLSP1Recipient, data);

        bytes memory lsp1Data = abi.encodePacked(from, to, amount, data);

        _notifyTokenSender(from, lsp1Data);
        _notifyTokenReceiver(to, allowNonLSP1Recipient, lsp1Data);
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting
     * and burning.
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, ``from``'s `amount` tokens will be
     * transferred to `to`.
     * - When `from` is zero, `amount` tokens will be minted for `to`.
     * - When `to` is zero, ``from``'s `amount` tokens will be burned.
     * - `from` and `to` are never both zero.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    /**
     * @dev An attempt is made to notify the token sender about the `amount` tokens changing owners using
     * LSP1 interface.
     */
    function _notifyTokenSender(address from, bytes memory lsp1Data) internal virtual {
        if (ERC165Checker.supportsERC165InterfaceUnchecked(from, _INTERFACEID_LSP1)) {
            ILSP1UniversalReceiver(from).universalReceiver(_TYPEID_LSP7_TOKENSSENDER, lsp1Data);
        }
    }

    /**
     * @dev An attempt is made to notify the token receiver about the `amount` tokens changing owners
     * using LSP1 interface. When allowNonLSP1Recipient is FALSE the token receiver MUST support LSP1.
     *
     * The receiver may revert when the token being sent is not wanted.
     */
    function _notifyTokenReceiver(
        address to,
        bool allowNonLSP1Recipient,
        bytes memory lsp1Data
    ) internal virtual {
        if (ERC165Checker.supportsERC165InterfaceUnchecked(to, _INTERFACEID_LSP1)) {
            ILSP1UniversalReceiver(to).universalReceiver(_TYPEID_LSP7_TOKENSRECIPIENT, lsp1Data);
        } else if (!allowNonLSP1Recipient) {
            if (to.code.length > 0) {
                revert LSP7NotifyTokenReceiverContractMissingLSP1Interface(to);
            } else {
                revert LSP7NotifyTokenReceiverIsEOA(to);
            }
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable, IERC165) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

}