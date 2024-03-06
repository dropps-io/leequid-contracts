// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

// libraries
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { LSP1Utils } from "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Utils.sol";
import { OwnablePausableUpgradeable } from "../presets/OwnablePausableUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ERC725YCore } from "@erc725/smart-contracts/contracts/ERC725YCore.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

// interfaces
import { ILSP7DigitalAsset } from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/ILSP7DigitalAsset.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IStakedLyxToken } from "../interfaces/IStakedLyxToken.sol";
import { IRewards } from "../interfaces/IRewards.sol";
import { IPool } from "../interfaces/IPool.sol";

// errors
import {LSP7AmountExceedsAuthorizedAmount,
LSP7CannotSendToSelf,
LSP7InvalidTransferBatch,
LSP7CannotUseAddressZeroAsOperator,
LSP7TokenOwnerCannotBeOperator,
LSP7CannotSendWithAddressZero,
LSP7AmountExceedsBalance
} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Errors.sol";

// constants
import { LSP4DigitalAssetMetadataInitAbstract } from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4DigitalAssetMetadataInitAbstract.sol";
import { _INTERFACEID_LSP7,_TYPEID_LSP7_TOKENOPERATOR} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Constants.sol";


/**
 * @title StakedLyxToken
 *
 * @dev StakedLyxToken contract stores pool staked tokens.
 */
/// #invariant {:msg "unstakeRequestCurrentIndex <= unstakeRequestCount"} unstakeRequestCurrentIndex <= unstakeRequestCount;
/// #invariant {:msg "unstake request at index 0 is never used"} _unstakeRequests[0].amount == 0;
/// #invariant {:msg "all unstake requests have a positive amount and all requests with an index greater than unstakeRequestCurrentIndex must be unclaimed"} forall(uint256 i in 1...unstakeRequestCount) (let rqst := _unstakeRequests[i] in 0 < rqst.amount && (unstakeRequestCurrentIndex < i ==> !rqst.claimed));
contract StakedLyxToken is OwnablePausableUpgradeable, LSP4DigitalAssetMetadataInitAbstract, IStakedLyxToken, ReentrancyGuardUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    // --- Storage

    // @dev Validator deposit amount.
    uint256 public constant override VALIDATOR_TOTAL_DEPOSIT = 32 ether;

    // @dev Total deposits - total amount of tokens deposited (the amount of tokens unstaked is not deducted from this amount).
    uint256 internal _totalDeposits;

    // @dev Total Unstaked - total amount of tokens that were unstaked from the staking node and submitted for claiming.
    /// #if_updated {:msg "totalUnstaked does not decrease"} old(totalUnstaked) <= totalUnstaked;
    uint256 public override totalUnstaked;

    // @dev Total Pending Unstake - total amount of tokens pending to be unstaked. When unstaked, the amount unstaked is deducted
    uint256 public override totalPendingUnstake;

    // @dev Unstake Request Count - Used as an index to keep track of unstake requests.
    /// #if_updated {:msg "unstakeRequestCount increases"} old(unstakeRequestCount) < unstakeRequestCount;
    uint256 public unstakeRequestCount;

    // @dev Unstake Request Current Index - Used as an index to keep track of the current unstake request being processed. The previous indexes were all processed.
    /// #if_updated {:msg "unstakeRequestCurrentIndex does not decrease"} old(unstakeRequestCurrentIndex) <= unstakeRequestCurrentIndex;
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
    /// #if_updated {:msg "pool does not change after initialization"} msg.sig == StakedLyxToken.initialize.selector;
    IPool internal pool;

    // @dev Address of the Oracles contract.
    /// #if_updated {:msg "oracles does not change after initialization"} msg.sig == StakedLyxToken.initialize.selector;
    address internal oracles;

    // @dev Address of the Rewards contract.
    /// #if_updated {:msg "rewards does not change after initialization"} msg.sig == StakedLyxToken.initialize.selector;
    IRewards internal rewards;

    // @dev The principal amount of the distributor.
    uint256 public override distributorPrincipal;

    // @dev Validators Exited Threshold - The number of validators that need to exit before we can set unstake processing to true.
    uint256 internal validatorsExitedThreshold;

    // Mapping an `address` to its authorized operator addresses.
    mapping(address => EnumerableSet.AddressSet) internal _operators;


    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        IPool _pool,
        address _oracles,
        IRewards _rewards
    ) external initializer {
        require(address(_pool) != address(0), "StakedLyxToken: pool address cannot be zero");
        require(_oracles != address(0), "StakedLyxToken: oracles address cannot be zero");
        require(_admin != address(0), "StakedLyxToken: admin address cannot be zero");
        require(address(_rewards) != address(0), "StakedLyxToken: rewards address cannot be zero");

        LSP4DigitalAssetMetadataInitAbstract._initialize("StakedLyxToken", "sLYX", _admin, 0);
        __OwnablePausableUpgradeable_init_unchained(_admin);
        pool = _pool;
        oracles = _oracles;
        rewards = _rewards;
    }

    // --- Token queries

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable, IERC165, ERC725YCore) returns (bool) {
        return
            interfaceId == _INTERFACEID_LSP7 ||
            super.supportsInterface(interfaceId);
    }

    function decimals() public pure override returns (uint8) {
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
        rewards.setRewardsDisabled(tokenOwner, isDisabled);

        // update distributor principal
        uint256 tokenOwnerBalance = _deposits[tokenOwner];
        if (isDisabled) {
            distributorPrincipal = distributorPrincipal + tokenOwnerBalance;
        } else {
            distributorPrincipal = distributorPrincipal - tokenOwnerBalance;
        }
    }

    // --- Operator functionality

    function authorizeOperator(
        address operator,
        uint256 amount,
        bytes memory operatorNotificationData
    ) public virtual override {
        _updateOperator(
            msg.sender,
            operator,
            amount,
            true,
            operatorNotificationData
        );

        bytes memory lsp1Data = abi.encode(
            msg.sender,
            amount,
            operatorNotificationData
        );

        _notifyTokenOperator(operator, lsp1Data);
    }

    function revokeOperator(
        address operator,
        bool notify,
        bytes memory operatorNotificationData
    ) public virtual override {
        _updateOperator(
            msg.sender,
            operator,
            0,
            notify,
            operatorNotificationData
        );

        if (notify) {
            bytes memory lsp1Data = abi.encode(
                msg.sender,
                0,
                operatorNotificationData
            );

            _notifyTokenOperator(operator, lsp1Data);
        }
    }

    function authorizedAmountFor(address operator, address tokenOwner) public view override returns (uint256)
    {
        if (tokenOwner == operator) {
            return _deposits[tokenOwner];
        } else {
            return _operatorAuthorizedAmount[tokenOwner][operator];
        }
    }

    function getOperatorsOf(
        address tokenOwner
    ) public view virtual override returns (address[] memory) {
        return _operators[tokenOwner].values();
    }

    // --- Transfer functionality

    /// #if_succeeds {:msg "sender and recipient are not the same"} old(from != to);
    /// #if_succeeds {:msg "balance of the sender is decreased by amount"} _deposits[from] == old(_deposits[from] - amount);
    /// #if_succeeds {:msg "balance of the recipient is increased by amount"} _deposits[to] == old(_deposits[to] + amount);
    function transfer(
        address from,
        address to,
        uint256 amount,
        bool force,
        bytes memory data
    ) public virtual override {
        if (from == to) revert LSP7CannotSendToSelf();

        if (msg.sender != from) {
            _spendAllowance({
                operator: msg.sender,
                tokenOwner: from,
                amountToSpend: amount
            });
        }

        _transfer(from, to, amount, force, data);
    }

    function transferBatch(
        address[] memory from,
        address[] memory to,
        uint256[] memory amount,
        bool[] memory force,
        bytes[] memory data
    ) public virtual override {
        uint256 fromLength = from.length;
        if (
            fromLength != to.length ||
            fromLength != amount.length ||
            fromLength != force.length ||
            fromLength != data.length
        ) {
            revert LSP7InvalidTransferBatch();
        }

        for (uint256 i; i < fromLength; ) {
            // using the public transfer function to handle updates to operator authorized amounts
            transfer(from[i], to[i], amount[i], force[i], data[i]);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Changes token `amount` the `operator` has access to from `tokenOwner` tokens.
     * If the amount is zero the operator is removed from the list of operators, otherwise he is added to the list of operators.
     * If the amount is zero then the operator is being revoked, otherwise the operator amount is being modified.
     *
     * @param tokenOwner The address that will give `operator` an allowance for on its balance.
     * @param operator The address to grant an allowance to spend.
     * @param allowance The maximum amount of token that `operator` can spend from the `tokenOwner`'s balance.
     * @param notified Boolean indicating whether the operator has been notified about the change of allowance
     * @param operatorNotificationData The data to send to the universalReceiver function of the operator in case of notifying
     *
     * @custom:events
     * - {OperatorRevoked} event when operator's allowance is set to `0`.
     * - {OperatorAuthorizationChanged} event when operator's allowance is set to any other amount.
     *
     * @custom:requirements
     * - `operator` cannot be the zero address.
     * - `operator` cannot be the same address as `tokenOwner`.
     */
    function _updateOperator(
        address tokenOwner,
        address operator,
        uint256 allowance,
        bool notified,
        bytes memory operatorNotificationData
    ) internal virtual {
        if (operator == address(0)) {
            revert LSP7CannotUseAddressZeroAsOperator();
        }

        if (operator == tokenOwner) {
            revert LSP7TokenOwnerCannotBeOperator();
        }

        _operatorAuthorizedAmount[tokenOwner][operator] = allowance;

        if (allowance != 0) {
            _operators[tokenOwner].add(operator);
            emit OperatorAuthorizationChanged(
                operator,
                tokenOwner,
                allowance,
                operatorNotificationData
            );
        } else {
            _operators[tokenOwner].remove(operator);
            emit OperatorRevoked(
                operator,
                tokenOwner,
                notified,
                operatorNotificationData
            );
        }
    }

    /**
     * @dev See {IStakedLyxToken-unstake}.
     */
    function unstake(
        uint256 amount
    ) external override nonReentrant whenNotPaused {
        address account = msg.sender;
        require(amount > 0, "StakedLyxToken: amount must be greater than zero");
        require(_deposits[account] >= amount, "StakedLyxToken: insufficient balance");

        // start calculating account rewards with updated deposit amount
        bool rewardsDisabled = rewards.updateRewardCheckpoint(account);
        if (rewardsDisabled) {
            // update merkle distributor principal if account has disabled rewards
            distributorPrincipal = distributorPrincipal - amount;
        }

        _deposits[account] -= amount;
        _totalDeposits -= amount;
        totalPendingUnstake = totalPendingUnstake + amount;

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
        require(msg.sender == address(pool), "StakedLyxToken: access denied");
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

        emit UnstakeMatched(amountMatched, totalPendingUnstake);
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
        uint256 validatorsToUnstake = (totalPendingUnstake - (totalPendingUnstake % VALIDATOR_TOTAL_DEPOSIT)) / VALIDATOR_TOTAL_DEPOSIT;
        validatorsExitedThreshold = pool.exitedValidators() + validatorsToUnstake;
        emit UnstakeReady(validatorsToUnstake);
    }

    /**
     * @dev See {IStakedLyxToken-unstakeProcessed}.
     */
    function unstakeProcessed(uint256 exitedValidators) external override {
        require(msg.sender == oracles, "StakedLyxToken: access denied");
        require(unstakeProcessing, "StakedLyxToken: unstaking not in process");

        uint256 unstakeAmount = exitedValidators * VALIDATOR_TOTAL_DEPOSIT;

        if (unstakeAmount > totalPendingUnstake) {
            rewards.sendToPoolWithoutActivation(unstakeAmount - totalPendingUnstake);
            unstakeAmount = totalPendingUnstake;
            totalPendingUnstake = 0;
            unstakeRequestCurrentIndex = unstakeRequestCount;
            _unstakeRequests[unstakeRequestCount].amountFilled = _unstakeRequests[unstakeRequestCount].amount;
        }
        else {
            totalPendingUnstake -= unstakeAmount;
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
        }

        totalUnstaked += unstakeAmount;

        // If less pending unstake under VALIDATOR_TOTAL_DEPOSIT, it means the unstake is completed
        if (pool.exitedValidators() + exitedValidators >= validatorsExitedThreshold) {
            unstakeProcessing = false;
        }

        emit UnstakeProcessed(unstakeAmount, totalPendingUnstake);
    }

    /**
     * @dev See {IStakedLyxToken-claimUnstake}.
     */
    function claimUnstake(address account, uint256[] calldata unstakeRequestIndexes) external override returns (uint256) {
        require(msg.sender == address(rewards), "StakedLyxToken: access denied");
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
    /// #if_succeeds {:msg "sender must be the pool"} old(msg.sender == address(pool));
    /// #if_succeeds {:msg "recipient cannot be 0x0"} old(to != address(0x0));
    /// #if_succeeds {:msg "amount is added to deposits"} _deposits[to] == old(_deposits[to] + amount);
    /// #if_succeeds {:msg "amount is added to the total deposits"} _totalDeposits == old(_totalDeposits + amount);
    function mint(address to,
        uint256 amount,
        bool force,
        bytes memory data) external override {
        require(msg.sender == address(pool), "StakedLyxToken: access denied");

        // start calculating account rewards with updated deposit amount
        bool rewardsDisabled = rewards.updateRewardCheckpoint(to);
        if (rewardsDisabled) {
            // update merkle distributor principal if account has disabled rewards
            distributorPrincipal = distributorPrincipal + amount;
        }

        _mint(to, amount, force, data);
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
        bool force,
        bytes memory data
    ) internal virtual {
        if (to == address(0)) {
            revert LSP7CannotSendWithAddressZero();
        }

        address operator = msg.sender;

        // tokens being minted
        _totalDeposits += amount;

        _deposits[to] += amount;

        emit Transfer({
            operator: msg.sender,
            from: address(0),
            to: to,
            amount: amount,
            force: force,
            data: data
        });
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
        bool force,
        bytes memory data
    ) internal virtual whenNotPaused {
        require(block.number > rewards.lastUpdateBlockNumber(), "StakedLyxToken: cannot transfer during rewards update");
        if (from == address(0) || to == address(0)) {
            revert LSP7CannotSendWithAddressZero();
        }

        uint256 balance = _deposits[from];
        if (amount > balance) {
            revert LSP7AmountExceedsBalance(balance, from, amount);
        }

        (bool senderRewardsDisabled, bool recipientRewardsDisabled) = rewards.updateRewardCheckpoints(from, to);
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

        _deposits[from] -= amount;
        _deposits[to] += amount;

        emit Transfer(operator, from, to, amount, force, data);
    }

    /**
     * @dev Spend `amountToSpend` from the `operator`'s authorized on behalf of the `tokenOwner`.
     *
     * @param operator The address of the operator to decrease the allowance of.
     * @param tokenOwner The address that granted an allowance on its balance to `operator`.
     * @param amountToSpend The amount of tokens to substract in allowance of `operator`.
     *
     * @custom:events
     * - {OperatorRevoked} event when operator's allowance is set to `0`.
     * - {OperatorAuthorizationChanged} event when operator's allowance is set to any other amount.
     *
     * @custom:requirements
     * - The `amountToSpend` MUST be at least the allowance granted to `operator` (accessible via {`authorizedAmountFor}`)
     * - `operator` cannot be the zero address.
     * - `operator` cannot be the same address as `tokenOwner`.
     */
    function _spendAllowance(
        address operator,
        address tokenOwner,
        uint256 amountToSpend
    ) internal virtual {
        uint256 authorizedAmount = _operatorAuthorizedAmount[tokenOwner][
                    operator
            ];

        if (amountToSpend > authorizedAmount) {
            revert LSP7AmountExceedsAuthorizedAmount(
                tokenOwner,
                authorizedAmount,
                operator,
                amountToSpend
            );
        }

        _updateOperator({
            tokenOwner: tokenOwner,
            operator: operator,
            allowance: authorizedAmount - amountToSpend,
            notified: false,
            operatorNotificationData: ""
        });
    }

    /**
     * @dev Attempt to notify the operator `operator` about the `amount` tokens being authorized with.
     * This is done by calling its {universalReceiver} function with the `_TYPEID_LSP7_TOKENOPERATOR` as typeId, if `operator` is a contract that supports the LSP1 interface.
     * If `operator` is an EOA or a contract that does not support the LSP1 interface, nothing will happen and no notification will be sent.

     * @param operator The address to call the {universalReceiver} function on.
     * @param lsp1Data the data to be sent to the `operator` address in the `universalReceiver` call.
     */
    function _notifyTokenOperator(
        address operator,
        bytes memory lsp1Data
    ) internal virtual {
        LSP1Utils.notifyUniversalReceiver(
            operator,
            _TYPEID_LSP7_TOKENOPERATOR,
            lsp1Data
        );
    }

    // --- Methods for ERC20 compatibility ---

    function allowance(address tokenOwner, address operator) public view virtual returns (uint256) {
        return authorizedAmountFor(operator, tokenOwner);
    }

    function approve(address operator, uint256 amount) public virtual returns (bool) {
        _updateOperator(msg.sender, operator, amount, false, "");
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
