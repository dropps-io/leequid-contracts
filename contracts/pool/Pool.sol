// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;
pragma abicoder v2;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {OwnablePausableUpgradeable} from "../presets/OwnablePausableUpgradeable.sol";
import {IStakedLyxToken} from "../interfaces/IStakedLyxToken.sol";
import {IRewards} from "../interfaces/IRewards.sol";
import {IDepositContract} from "../interfaces/IDepositContract.sol";
import {IPoolValidators} from "../interfaces/IPoolValidators.sol";
import {IPool} from "../interfaces/IPool.sol";

/**

@title Pool

@dev Pool contract accumulates deposits from the users, mints tokens and registers validators.
*/
contract Pool is IPool, OwnablePausableUpgradeable, ReentrancyGuardUpgradeable {
    // @dev Validator deposit amount.
    uint256 public constant override VALIDATOR_TOTAL_DEPOSIT = 32 ether;

    // @dev Total activated validators.
    uint256 public override activatedValidators;

    // @dev Total exited validators.
    uint256 public override exitedValidators;

    // @dev Pool validator withdrawal credentials.
    bytes32 public override withdrawalCredentials;

    // @dev Address of the ETH2 Deposit Contract (deployed by Lukso).
    IDepositContract public override validatorRegistration;

    // @dev Address of the StakedLyxToken contract.
    IStakedLyxToken private stakedLyxToken;

    IRewards private rewards;

    // @dev Address of the PoolValidators contract.
    IPoolValidators private validators;

    // @dev Address of the Oracles contract.
    address private oracles;

    // @dev Maps senders to the validator index that it will be activated in.
    mapping(address => mapping(uint256 => uint256)) public override activations;

    // @dev Total pending validators.
    uint256 public override pendingValidators;

    // @dev Amount of deposited ETH that is not considered for the activation period.
    uint256 public override minActivatingDeposit;

    // @dev Pending validators percent limit. If it's not exceeded tokens can be minted immediately.
    uint256 public override pendingValidatorsLimit;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _stakedLyxToken,
        address _rewards,
        address _validators,
        address _oracles,
        bytes32 _withdrawalCredentials,
        address _validatorRegistration,
        uint256 _minActivatingDeposit,
        uint256 _pendingValidatorsLimit
    ) public initializer {
        require(_stakedLyxToken != address(0), "Pool: stakedLyxToken address cannot be zero");
        require(_rewards != address(0), "Pool: rewards address cannot be zero");
        require(_admin != address(0), "Pool: admin address cannot be zero");
        require(_oracles != address(0), "Pool: oracles address cannot be zero");
        require(_validatorRegistration != address(0), "Pool: validatorRegistration address cannot be zero");
        require(_validators != address(0), "Pool: validators address cannot be zero");
        require(_withdrawalCredentials != bytes32(0), "Pool: withdrawalCredentials cannot be zero");

        __OwnablePausableUpgradeable_init(_admin);

        stakedLyxToken = IStakedLyxToken(_stakedLyxToken);
        rewards = IRewards(_rewards);
        validators = IPoolValidators(_validators);
        oracles = _oracles;
        withdrawalCredentials = _withdrawalCredentials;
        validatorRegistration = IDepositContract(_validatorRegistration);
        minActivatingDeposit = _minActivatingDeposit;
        pendingValidatorsLimit = _pendingValidatorsLimit;
    }

    function effectiveValidators() public view override returns (uint256) {
        return activatedValidators - exitedValidators;
    }

    /**
    * @dev See {IPool-setMinActivatingDeposit}.
    */
    function setMinActivatingDeposit(uint256 newMinActivatingDeposit) external override onlyAdmin {
        minActivatingDeposit = newMinActivatingDeposit;
        emit MinActivatingDepositUpdated(newMinActivatingDeposit, msg.sender);
    }
    /**
    * @dev See {IPool-setPendingValidatorsLimit}.
    */
    function setPendingValidatorsLimit(uint256 newPendingValidatorsLimit) external override onlyAdmin {
        require(newPendingValidatorsLimit < 1e4, "Pool: invalid limit");
        pendingValidatorsLimit = newPendingValidatorsLimit;
        emit PendingValidatorsLimitUpdated(newPendingValidatorsLimit, msg.sender);
    }

    /**
    * @dev See {IPool-setActivatedValidators}.
    */
    function setActivatedValidators(uint256 newActivatedValidators) external override {
        require(msg.sender == oracles || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Pool: access denied");

        // subtract activated validators from pending validators
        pendingValidators = pendingValidators - (newActivatedValidators - activatedValidators);
        activatedValidators = newActivatedValidators;
        emit ActivatedValidatorsUpdated(newActivatedValidators, msg.sender);
    }

    /**
    * @dev See {IPool-setActivatedValidators}.
    */
    function setExitedValidators(uint256 newExitedValidators) external override {
        require(msg.sender == oracles || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Pool: access denied");

        exitedValidators = newExitedValidators;
        emit ExitedValidatorsUpdated(exitedValidators, msg.sender);
    }

    /**
    * @dev See {IPool-receiveWithoutActivation}.
    */
    function receiveWithoutActivation() external payable override {
        require(msg.sender == address(rewards) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Pool: access denied");
    }

    /**
    * @dev See {IPool-stake}.
    */
    function stake() external payable override nonReentrant {
        _stake(msg.sender, msg.value);
    }

    /**
    * @dev See {IPool-stakeOnBehalf}.
    */
    function stakeOnBehalf(address recipient) external payable override nonReentrant {
        _stake(recipient, msg.value);
    }

    /**
    * @dev Function for staking ETH using transfer.
    */
    receive() external payable {
        _stake(msg.sender, msg.value);
    }

    /**
    * @dev See {IPool-stakeWithPartner}.
    */
    function stakeWithPartner(address partner) external payable override nonReentrant {
        // stake amount
        _stake(msg.sender, msg.value);
        emit StakedWithPartner(partner, msg.value);
    }

    /**
     * @dev See {IPool-stakeWithPartnerOnBehalf}.
    */
    function stakeWithPartnerOnBehalf(address partner, address recipient) external payable override nonReentrant {
        // stake amount
        _stake(recipient, msg.value);
        emit StakedWithPartner(partner, msg.value);
    }

    /**
     * @dev See {IPool-stakeWithReferrer}.
    */
    function stakeWithReferrer(address referrer) external payable override nonReentrant {
        // stake amount
        _stake(msg.sender, msg.value);
        emit StakedWithReferrer(referrer, msg.value);
    }

    /**
     * @dev See {IPool-stakeWithReferrerOnBehalf}.
    */
    function stakeWithReferrerOnBehalf(address referrer, address recipient) external payable override nonReentrant {
        // stake amount
        _stake(recipient, msg.value);
        emit StakedWithReferrer(referrer, msg.value);
    }

    function _stake(address recipient, uint256 value) internal whenNotPaused {
        require(recipient != address(0), "Pool: invalid recipient");
        require(value > 0, "Pool: invalid deposit amount");

        uint256 unstakeMatchedAmount = 0;

        if (!stakedLyxToken.unstakeProcessing()) {
            // try to match unstake request
            unstakeMatchedAmount = stakedLyxToken.matchUnstake(value);
        }
        if (unstakeMatchedAmount > 0) {
            address(rewards).call{value: unstakeMatchedAmount}("");
        }

        uint256 _valueToDeposit = value - unstakeMatchedAmount;

        // mint tokens for small deposits immediately
        if (_valueToDeposit <= minActivatingDeposit) {
            stakedLyxToken.mint(recipient, value, true, "");
            return;
        }

        // mint tokens if current pending validators limit is not exceeded
        uint256 _pendingValidators = pendingValidators + (address(this).balance / VALIDATOR_TOTAL_DEPOSIT);
        uint256 _activatedValidators = activatedValidators; // gas savings
        uint256 validatorIndex = _activatedValidators + _pendingValidators;
        if (validatorIndex * 1e4 <= _activatedValidators * 1e4 + effectiveValidators() * pendingValidatorsLimit) {
            stakedLyxToken.mint(recipient, value, true, "");
        } else {
            // lock deposit amount until validator activated
            if (unstakeMatchedAmount > 0) stakedLyxToken.mint(recipient, unstakeMatchedAmount, true, "");
            activations[recipient][validatorIndex] = activations[recipient][validatorIndex] + _valueToDeposit;
            emit ActivationScheduled(recipient, validatorIndex, _valueToDeposit);
        }
    }

    /**
     * @dev See {IPool-canActivate}.
     */
    function canActivate(uint256 validatorIndex) external view override returns (bool) {
        return validatorIndex * 1e4 <= activatedValidators * 1e4 + effectiveValidators() * pendingValidatorsLimit;
    }

    /**
     * @dev See {IPool-activate}.
    */
    function activate(address account, uint256 validatorIndex) external override whenNotPaused {
        uint256 activatedAmount = _activateAmount(
            account,
            validatorIndex,
            activatedValidators * 1e4 + effectiveValidators() * pendingValidatorsLimit
        );
        stakedLyxToken.mint(account, activatedAmount, true, "");
    }

    /**
     * @dev See {IPool-activateMultiple}.
    */
    function activateMultiple(address account, uint256[] calldata validatorIndexes) external override whenNotPaused {
        uint256 toMint;
        uint256 maxValidatorIndex = activatedValidators * 1e4 + effectiveValidators() * pendingValidatorsLimit;
        for (uint256 i = 0; i < validatorIndexes.length; i++) {
            uint256 activatedAmount = _activateAmount(account, validatorIndexes[i], maxValidatorIndex);
            toMint = toMint + activatedAmount;
        }
        stakedLyxToken.mint(account, toMint, true, "");
    }

    function _activateAmount(
        address account,
        uint256 validatorIndex,
        uint256 maxValidatorIndex
    ) internal returns (uint256 amount)
    {
        require(validatorIndex * 1e4 <= maxValidatorIndex, "Pool: validator is not active yet");

        amount = activations[account][validatorIndex];
        require(amount > 0, "Pool: invalid validator index");

        delete activations[account][validatorIndex];
        emit Activated(account, validatorIndex, amount, msg.sender);
    }

    /**
     * @dev See {IPool-registerValidator}.
     */
    function registerValidator(IPoolValidators.DepositData calldata depositData) external override whenNotPaused {
        require(msg.sender == address(validators), "Pool: access denied");
        require(depositData.withdrawalCredentials == withdrawalCredentials, "Pool: invalid withdrawal credentials");

        // update number of pending validators
        pendingValidators = pendingValidators + 1;
        emit ValidatorRegistered(depositData.publicKey, depositData.operator);

        // register validator
        validatorRegistration.deposit{value : VALIDATOR_TOTAL_DEPOSIT}(
            depositData.publicKey,
            abi.encodePacked(depositData.withdrawalCredentials),
            depositData.signature,
            depositData.depositDataRoot
        );
    }
}