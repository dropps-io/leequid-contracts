// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

// interfaces
import {ILSP1UniversalReceiver} from "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/ILSP1UniversalReceiver.sol";
import {ILSP7DigitalAsset} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/ILSP7DigitalAsset.sol";

// libraries
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {GasLib} from "@lukso/lsp-smart-contracts/contracts/Utils/GasLib.sol";

// modules
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// errors
import {LSP7AmountExceedsAuthorizedAmount,
        LSP7CannotSendToSelf,
        LSP7InvalidTransferBatch,
        LSP7CannotUseAddressZeroAsOperator,
        LSP7TokenOwnerCannotBeOperator,
        LSP7CannotSendWithAddressZero,
        LSP7AmountExceedsBalance,
        LSP7NotifyTokenReceiverContractMissingLSP1Interface,
        LSP7NotifyTokenReceiverIsEOA
} from  "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Errors.sol";

// constants
import {_INTERFACEID_LSP1} from "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Constants.sol";
import {LSP4DigitalAssetMetadataInitAbstract} from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4DigitalAssetMetadataInitAbstract.sol";
import {_TYPEID_LSP7_TOKENSSENDER, _TYPEID_LSP7_TOKENSRECIPIENT} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Constants.sol";
import {IStakedLyxToken} from "../interfaces/IStakedLyxToken.sol";
import {IRewardLyxToken} from "../interfaces/IRewardLyxToken.sol";
import { OwnablePausableUpgradeable } from "../presets/OwnablePausableUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC725YCore} from "@erc725/smart-contracts/contracts/ERC725YCore.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title LSP7DigitalAsset contract
 * @author Matthew Stevens
 * @dev Core Implementation of a LSP7 compliant contract.
 *
 * This contract implement the core logic of the functions for the {ILSP7DigitalAsset} interface.
 */
contract StakedLyxToken is OwnablePausableUpgradeable, LSP4DigitalAssetMetadataInitAbstract, IStakedLyxToken, ReentrancyGuardUpgradeable {
    // @dev Validator deposit amount.
    uint256 public constant override VALIDATOR_TOTAL_DEPOSIT = 32 ether;

    // @dev Total deposits - total amount of tokens deposited (the amount of tokens unstaked is not deducted from this amount).
    uint256 internal _totalDeposits;

    // @dev Total Unstaked - total amount of tokens that were unstaked from the staking node and submitted for claiming.
    uint256 public override totalUnstaked;

    // @dev Total Pending Unstake - total amount of tokens pending to be unstaked. When unstaked, the amount unstaked is deducted
    uint256 public override totalPendingUnstake;

    // @dev Unstake Request Count - Used as an index to keep track of unstake requests.
    uint256 public unstakeRequestCount;

    // @dev Unstake Request Current Index - Used as an index to keep track of the current unstake request being processed. The previous indexes were all processed.
    uint256 public unstakeRequestCurrentIndex;

    // @dev Unstake Processing - Boolean used to pause unstake requests. When true, no unstake requests can be made, and no unstake requests can be matched.
    // This is used to ensure the amount to unstake doesn t change while the unstake is processing
    bool public override unstakeProcessing;

    // @dev Unstake Request - Mapping containing all the unstake request requests in chronological order, the uint256 key being used as an index.
    mapping(uint256 => UnstakeRequest) internal _unstakeRequests;

    // Mapping from `tokenOwner` to an `amount` of tokens
    mapping(address => uint256) internal _deposits;

    // Mapping a `tokenOwner` to an `operator` to `amount` of tokens.
    mapping(address => mapping(address => uint256)) internal _operatorAuthorizedAmount;

    // @dev Address of the Pool contract.
    address private pool;

    // @dev Address of the Oracles contract.
    address private oracles;

    // @dev Address of the RewardLyxToken contract.
    IRewardLyxToken private rewardLyxToken;

    // @dev The principal amount of the distributor.
    uint256 public override distributorPrincipal;

    function initialize(
        address _admin,
        address _pool,
        address _oracles,
        IRewardLyxToken _rewardLyxToken
    ) external initializer {
        require(_pool != address(0), "StakedLyxToken: pool address cannot be zero");
        require(_oracles != address(0), "StakedLyxToken: oracles address cannot be zero");
        require(_admin != address(0), "StakedLyxToken: admin address cannot be zero");
        require(address(_rewardLyxToken) != address(0), "StakedLyxToken: rewardLyxToken address cannot be zero");

        LSP4DigitalAssetMetadataInitAbstract._initialize("StakedLyxToken", "sLYX", _admin);
        __OwnablePausableUpgradeable_init_unchained(_admin);
        pool = _pool;
        oracles = _oracles;
        rewardLyxToken = _rewardLyxToken;
    }

    // --- Token queries

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable, IERC165, ERC725YCore) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalDeposits;
    }

    /**
     * @dev See {IStakedLyxToken-totalDeposits}.
     */
    function totalDeposits() public view override returns (uint256) {
        return _totalDeposits;
    }

    /**
     * @dev See {IStakedLyxToken-totalClaimableAmount}.
     */
    function totalClaimableUnstakes() public view override returns (uint256) {
        uint256 totalClaimable;
        for (uint256 i = 0; i <= unstakeRequestCurrentIndex; i++) {
            UnstakeRequest memory _request = _unstakeRequests[i];
            if (isUnstakeRequestClaimable(i)) totalClaimable += _request.amount;
        }
        return totalClaimable;
    }

    /**
     * @dev See {IStakedLyxToken-unstakeRequest}.
     */
    function unstakeRequest(uint256 index) public view override returns (UnstakeRequest memory) {
        require(index <= unstakeRequestCount, "StakedLyxToken: invalid index");
        UnstakeRequest memory _unstakeRequest = _unstakeRequests[index];
        if (index < unstakeRequestCurrentIndex) {
            _unstakeRequest.amountFilled = _unstakeRequest.amount;
        }
        return _unstakeRequest;
    }

    /**
     * @dev See {IStakedLyxToken-isUnstakeRequestClaimable}.
     */
    function isUnstakeRequestClaimable(uint256 index) public view override returns (bool) {
        if (index > unstakeRequestCurrentIndex) return false;

        UnstakeRequest memory _request = _unstakeRequests[index];

        if (_request.claimed) return false;
        if (index == unstakeRequestCurrentIndex && _request.amount != _request.amountFilled) return false;

        return true;
    }

    // --- Token owner queries

    function balanceOf(address tokenOwner) public view override returns (uint256) {
        return _deposits[tokenOwner];
    }

    /**
     * @dev See {IStakedLyxToken-toggleRewards}.
     */
    function toggleRewards(address tokenOwner, bool isDisabled) external override onlyAdmin {
        require(tokenOwner != address(0), "StakedLyxToken: invalid tokenOwner");

        // toggle rewards
        rewardLyxToken.setRewardsDisabled(tokenOwner, isDisabled);

        // update distributor principal
        uint256 tokenOwnerBalance = _deposits[tokenOwner];
        if (isDisabled) {
            distributorPrincipal = distributorPrincipal + tokenOwnerBalance;
        } else {
            distributorPrincipal = distributorPrincipal - tokenOwnerBalance;
        }
    }

    // --- Operator functionality

    function authorizeOperator(address operator, uint256 amount) public override {
        _updateOperator(msg.sender, operator, amount);
    }

    function revokeOperator(address operator) public override {
        _updateOperator(msg.sender, operator, 0);
    }

    function authorizedAmountFor(address operator, address tokenOwner) public view override returns (uint256)
    {
        if (tokenOwner == operator) {
            return _deposits[tokenOwner];
        } else {
            return _operatorAuthorizedAmount[tokenOwner][operator];
        }
    }

    // --- Transfer functionality

    function transfer(
        address from,
        address to,
        uint256 amount,
        bool allowNonLSP1Recipient,
        bytes memory data
    ) public override {
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

    function transferBatch(
        address[] memory from,
        address[] memory to,
        uint256[] memory amount,
        bool[] memory allowNonLSP1Recipient,
        bytes[] memory data
    ) public override {
        uint256 fromLength = from.length;
        if (
            fromLength != to.length ||
            fromLength != amount.length ||
            fromLength != allowNonLSP1Recipient.length ||
            fromLength != data.length
        ) {
            revert LSP7InvalidTransferBatch();
        }

        for (uint256 i = 0; i < fromLength; i = GasLib.uncheckedIncrement(i)) {
            // using the public transfer function to handle updates to operator authorized amounts
            transfer(from[i], to[i], amount[i], allowNonLSP1Recipient[i], data[i]);
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
     * @dev See {IStakedLyxToken-unstake}.
     */
    function unstake(
        uint256 amount
    ) external override nonReentrant {
        address account = msg.sender;
        require(!unstakeProcessing, "StakedLyxToken: unstaking in progress");
        require(amount > 0, "StakedLyxToken: amount must be greater than zero");
        require(_deposits[account] >= amount, "StakedLyxToken: insufficient balance");

        // start calculating account rewards with updated deposit amount
        bool rewardsDisabled = rewardLyxToken.updateRewardCheckpoint(account);
        if (rewardsDisabled) {
            // update merkle distributor principal if account has disabled rewards
            distributorPrincipal = distributorPrincipal - amount;
        }

        _deposits[account] -= amount;
        _totalDeposits -= amount;
        totalPendingUnstake = totalPendingUnstake + uint128(amount);

        unstakeRequestCount += 1;
        _unstakeRequests[unstakeRequestCount] = UnstakeRequest({
            account: account,
            amount: uint128(amount),
            amountFilled: 0,
            claimed: false
        });

        emit NewUnstakeRequest(unstakeRequestCount, account, amount, totalPendingUnstake);
    }

    /**
     * @dev See {IStakedLyxToken-matchUnstake}.
     */
    function matchUnstake(uint256 amount) external override returns (uint256) {
        require(msg.sender == pool, "StakedLyxToken: access denied");
        require(!unstakeProcessing, "StakedLyxToken: unstaking in progress");
        uint256 amountMatched = 0;

        if (totalPendingUnstake == 0) {
            return amountMatched;
        }
        else if (amount >= totalPendingUnstake) {
            amountMatched = totalPendingUnstake;
            totalPendingUnstake = 0;
            unstakeRequestCurrentIndex = unstakeRequestCount;
            _unstakeRequests[unstakeRequestCount].amountFilled = _unstakeRequests[unstakeRequestCount].amount;
        } else {
            amountMatched = amount;
            totalPendingUnstake -= amountMatched;
            uint256 amountToFill = amountMatched;

            for (uint256 i = unstakeRequestCurrentIndex; i <= unstakeRequestCount; i++) {
                UnstakeRequest storage request = _unstakeRequests[i];

                if (amountToFill > (request.amount - request.amountFilled)) {
                    amountToFill -= (request.amount - request.amountFilled);
                    continue;
                } else {
                    if (amountToFill == (request.amount - request.amountFilled) && i < unstakeRequestCount) {
                        unstakeRequestCurrentIndex = i + 1;
                    } else {
                        request.amountFilled += uint128(amountToFill);
                        unstakeRequestCurrentIndex = i;
                    }
                    break;
                }
            }
        }

        return amountMatched;
    }

    /**
     * @dev See {IStakedLyxToken-setUnstakeProcessing}.
     */
    function setUnstakeProcessing() external override {
        require(msg.sender == oracles, "StakedLyxToken: access denied");
        require(!unstakeProcessing, "StakedLyxToken: unstaking already in progress");
        require(totalPendingUnstake >= VALIDATOR_TOTAL_DEPOSIT, "StakedLyxToken: insufficient pending unstake");

        unstakeProcessing = true;
        emit UnstakeReady((totalPendingUnstake - (totalPendingUnstake % VALIDATOR_TOTAL_DEPOSIT)) / VALIDATOR_TOTAL_DEPOSIT);
    }

    /**
     * @dev See {IStakedLyxToken-unstakeProcessed}.
     */
    function unstakeProcessed(uint256 exitedValidators) external override {
        require(msg.sender == oracles, "StakedLyxToken: access denied");
        require(unstakeProcessing, "StakedLyxToken: unstaking not in process");

        uint256 unstakeAmount = exitedValidators * VALIDATOR_TOTAL_DEPOSIT;

        require(unstakeAmount <= totalPendingUnstake, "StakedLyxToken: insufficient pending unstake");

        totalPendingUnstake -= unstakeAmount;
        totalUnstaked += unstakeAmount;
        uint256 amountToFill = unstakeAmount;

        for (uint256 i = unstakeRequestCurrentIndex; i <= unstakeRequestCount; i++) {
            UnstakeRequest storage request = _unstakeRequests[i];
            if (amountToFill > (request.amount - request.amountFilled)) {
                amountToFill -= (request.amount - request.amountFilled);
                continue;
            } else {
                if (amountToFill == (request.amount - request.amountFilled) && i < unstakeRequestCount) {
                    unstakeRequestCurrentIndex = i + 1;
                } else {
                    request.amountFilled += uint128(amountToFill);
                    unstakeRequestCurrentIndex = i;
                }
                break;
            }
        }

        // If less pending unstake under VALIDATOR_TOTAL_DEPOSIT, it means the unstake is completed
        if (totalPendingUnstake < VALIDATOR_TOTAL_DEPOSIT) {
            unstakeProcessing = false;
        }

        emit UnstakeProcessed(unstakeAmount, totalPendingUnstake);
    }

    /**
     * @dev See {IStakedLyxToken-claimUnstake}.
     */
    function claimUnstake(address account, uint256[] calldata unstakeRequestIndexes) external override returns (uint256) {
        require(msg.sender == address(rewardLyxToken), "StakedLyxToken: access denied");
        uint256 totalClaimedAmount = 0;
        for (uint256 i = 0; i < unstakeRequestIndexes.length; i++) {
            uint256 unstakeRequestIndex = unstakeRequestIndexes[i];
            require(isUnstakeRequestClaimable(unstakeRequestIndex), "StakedLyxToken: unstake request not claimable");

            UnstakeRequest storage request = _unstakeRequests[unstakeRequestIndex];
            require(request.account == account, "StakedLyxToken: unstake request not from this account");

            totalClaimedAmount += request.amount;
            request.claimed = true;
        }
        return totalClaimedAmount;
    }

    /**
     * @dev See {IStakedLyxToken-mint}.
     */
    function mint(address to,
        uint256 amount,
        bool allowNonLSP1Recipient,
        bytes memory data) external override {
        require(msg.sender == pool, "StakedLyxToken: access denied");

        // start calculating account rewards with updated deposit amount
        bool rewardsDisabled = rewardLyxToken.updateRewardCheckpoint(to);
        if (rewardsDisabled) {
            // update merkle distributor principal if account has disabled rewards
            distributorPrincipal = distributorPrincipal + amount;
        }

        _mint(to, amount, allowNonLSP1Recipient, data);
    }

    /**
     * @dev Mints `amount` tokens and transfers it to `to`.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    function _mint(
        address to,
        uint256 amount,
        bool allowNonLSP1Recipient,
        bytes memory data
    ) internal virtual {
        if (to == address(0)) {
            revert LSP7CannotSendWithAddressZero();
        }

        address operator = msg.sender;

        _beforeTokenTransfer(address(0), to, amount);

        // tokens being minted
        _totalDeposits += amount;

        _deposits[to] += amount;

        emit Transfer(operator, address(0), to, amount, allowNonLSP1Recipient, data);

        _notifyTokenReceiver(address(0), to, amount, allowNonLSP1Recipient, data);
    }

    /**
     * @dev Destroys `amount` tokens.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `from` must have at least `amount` tokens.
     * - If the caller is not `from`, it must be an operator for `from` with access to at least
     * `amount` tokens.
     *
     * Emits a {Transfer} event.
     */
    function _burn(
        address from,
        uint256 amount,
        bytes memory data
    ) internal virtual {
        if (from == address(0)) {
            revert LSP7CannotSendWithAddressZero();
        }

        uint256 balance = _deposits[from];
        if (amount > balance) {
            revert LSP7AmountExceedsBalance(balance, from, amount);
        }

        address operator = msg.sender;
        if (operator != from) {
            uint256 authorizedAmount = _operatorAuthorizedAmount[from][operator];
            if (amount > authorizedAmount) {
                revert LSP7AmountExceedsAuthorizedAmount(from, authorizedAmount, operator, amount);
            }
            _operatorAuthorizedAmount[from][operator] -= amount;
        }

        _beforeTokenTransfer(from, address(0), amount);

        // tokens being burned
        _totalDeposits -= amount;

        _deposits[from] -= amount;

        emit Transfer(operator, from, address(0), amount, false, data);

        _notifyTokenSender(from, address(0), amount, data);
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
        require(block.number > rewardLyxToken.lastUpdateBlockNumber(), "StakedLyxToken: cannot transfer during rewards update");
        if (from == address(0) || to == address(0)) {
            revert LSP7CannotSendWithAddressZero();
        }

        uint256 balance = _deposits[from];
        if (amount > balance) {
            revert LSP7AmountExceedsBalance(balance, from, amount);
        }

        (bool senderRewardsDisabled, bool recipientRewardsDisabled) = rewardLyxToken.updateRewardCheckpoints(from, to);
        if ((senderRewardsDisabled || recipientRewardsDisabled) && !(senderRewardsDisabled && recipientRewardsDisabled)) {
            // update merkle distributor principal if any of the addresses has disabled rewards
            uint256 _distributorPrincipal = distributorPrincipal; // gas savings
            if (senderRewardsDisabled) {
                _distributorPrincipal = _distributorPrincipal - amount;
            } else {
                _distributorPrincipal = _distributorPrincipal + amount;
            }
            distributorPrincipal = _distributorPrincipal;
        }

        address operator = msg.sender;

        _beforeTokenTransfer(from, to, amount);

        _deposits[from] -= amount;
        _deposits[to] += amount;

        emit Transfer(operator, from, to, amount, allowNonLSP1Recipient, data);

        _notifyTokenSender(from, to, amount, data);
        _notifyTokenReceiver(from, to, amount, allowNonLSP1Recipient, data);
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
    function _notifyTokenSender(
        address from,
        address to,
        uint256 amount,
        bytes memory data
    ) internal virtual {
        if (ERC165Checker.supportsERC165InterfaceUnchecked(from, _INTERFACEID_LSP1)) {
            bytes memory packedData = abi.encodePacked(from, to, amount, data);
            ILSP1UniversalReceiver(from).universalReceiver(_TYPEID_LSP7_TOKENSSENDER, packedData);
        }
    }

    /**
     * @dev An attempt is made to notify the token receiver about the `amount` tokens changing owners
     * using LSP1 interface. When allowNonLSP1Recipient is FALSE the token receiver MUST support LSP1.
     *
     * The receiver may revert when the token being sent is not wanted.
     */
    function _notifyTokenReceiver(
        address from,
        address to,
        uint256 amount,
        bool allowNonLSP1Recipient,
        bytes memory data
    ) internal virtual {
        if (ERC165Checker.supportsERC165InterfaceUnchecked(to, _INTERFACEID_LSP1)) {
            bytes memory packedData = abi.encodePacked(from, to, amount, data);
            ILSP1UniversalReceiver(to).universalReceiver(_TYPEID_LSP7_TOKENSRECIPIENT, packedData);
        } else if (!allowNonLSP1Recipient) {
            if (to.code.length > 0) {
                revert LSP7NotifyTokenReceiverContractMissingLSP1Interface(to);
            } else {
                revert LSP7NotifyTokenReceiverIsEOA(to);
            }
        }
    }

    // --- Methods for ERC20 compatibility ---

    function allowance(address tokenOwner, address operator) public view virtual returns (uint256) {
        return authorizedAmountFor(operator, tokenOwner);
    }

    function approve(address operator, uint256 amount) public virtual returns (bool) {
        authorizeOperator(operator, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual returns (bool) {
        transfer(from, to, amount, true, "");
        return true;
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        transfer(msg.sender, to, amount, true, "");
        return true;
    }
}
