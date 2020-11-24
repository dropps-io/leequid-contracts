// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.7.5;
pragma abicoder v2;

import "./IValidatorRegistration.sol";

/**
 * @dev Interface of the Solos contract.
 */
interface ISolos {
    /**
    * @dev Structure for storing information about the solo deposits.
    * @param amount - amount deposited.
    * @param withdrawalCredentials - withdrawal credentials of the validators.
    * @param releaseTime - the time when the deposit amount can be canceled.
    */
    struct Solo {
        uint256 amount;
        bytes32 withdrawalCredentials;
        uint256 releaseTime;
    }

    /**
    * @dev Structure for passing information about new Validator.
    * @param publicKey - BLS public key of the validator, generated by the operator.
    * @param signature - BLS signature of the validator, generated by the operator.
    * @param depositDataRoot - hash tree root of the deposit data, generated by the operator.
    * @param soloId - ID of the solo to register validator for.
    */
    struct Validator {
        bytes publicKey;
        bytes signature;
        bytes32 depositDataRoot;
        bytes32 soloId;
    }

    /**
    * @dev Event for tracking added deposits.
    * @param soloId - ID of the solo.
    * @param sender - address of the deposit sender.
    * @param amount - amount added.
    * @param withdrawalCredentials - withdrawal credentials submitted by deposit owner.
    */
    event DepositAdded(
        bytes32 indexed soloId,
        address sender,
        uint256 amount,
        bytes32 withdrawalCredentials
    );

    /**
    * @dev Event for tracking canceled deposits.
    * @param soloId - ID of the solo.
    * @param amount - amount canceled.
    */
    event DepositCanceled(bytes32 indexed soloId, uint256 amount);

    /**
    * @dev Function for getting solo's details.
    * @param _soloId - ID of the solo to retrieve data for.
    */
    function solos(bytes32 _soloId) external view returns (
        uint256 amount,
        bytes32 withdrawalCredentials,
        uint256 releaseTime
    );

    /**
    * @dev Function for retrieving the validator registration contract address.
    */
    function validatorRegistration() external view returns (IValidatorRegistration);

    /**
    * @dev Constructor for initializing the Solos contract.
    * @param _settings - address of the Settings contract.
    * @param _operators - address of the Operators contract.
    * @param _validatorRegistration - address of the VRC (deployed by Ethereum).
    * @param _validators - address of the Validators contract.
    */
    function initialize(
        address _settings,
        address _operators,
        address _validatorRegistration,
        address _validators
    ) external;

    /**
    * @dev Function for adding solo deposits.
    * The deposit amount must be divisible by the validator deposit amount.
    * The depositing will be disallowed in case `Solos` contract is paused in `Settings` contract.
    * @param _withdrawalCredentials - withdrawal credentials for performing validator withdrawal.
    */
    function addDeposit(bytes32 _withdrawalCredentials) external payable;

    /**
    * @dev Function for canceling solo deposits.
    * The deposit amount can only be canceled before it will be registered as a validator.
    * @param _withdrawalCredentials - withdrawal credentials of solo validators.
    * @param _amount - amount to cancel.
    */
    function cancelDeposit(bytes32 _withdrawalCredentials, uint256 _amount) external;

    /**
    * @dev Function for registering new solo validator.
    * @param _validator - validator to register.
    */
    function registerValidator(Validator calldata _validator) external;

    /**
    * @dev Function for registering new solo validators.
    * @param _validators - list of validators to register.
    */
    function registerValidators(Validator[] calldata _validators) external;
}
