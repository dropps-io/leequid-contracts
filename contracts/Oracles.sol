// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.20;
pragma abicoder v2;

import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {OwnablePausableUpgradeable} from "./presets/OwnablePausableUpgradeable.sol";
import {IRewards} from "./interfaces/IRewards.sol";
import {IPool} from "./interfaces/IPool.sol";
import {IOracles} from "./interfaces/IOracles.sol";
import {IMerkleDistributor} from "./interfaces/IMerkleDistributor.sol";
import {IPoolValidators} from "./interfaces/IPoolValidators.sol";
import {IStakedLyxToken} from "./interfaces/IStakedLyxToken.sol";

/**
 * @title Oracles
 *
 * @dev Oracles contract stores accounts responsible for submitting or update values based on the off-chain data.
 * The threshold of inputs from different oracles is required to submit the data.
 */
contract Oracles is IOracles, OwnablePausableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    // @dev Validator deposit amount.
    uint256 public constant override VALIDATOR_TOTAL_DEPOSIT = 32 ether;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    bytes32 public constant ORCHESTRATOR_ROLE = keccak256("ORCHESTRATOR_ROLE");

    // @dev Oracle count - used to verify number of signatures.
    uint256 public oracleCount;

    // @dev Rewards nonce is used to protect from submitting the same rewards vote several times.
    CountersUpgradeable.Counter private rewardsNonce;

    // @dev Validators nonce is used to protect from submitting the same validator vote several times.
    CountersUpgradeable.Counter private validatorsNonce;

    // @dev Unstake nonce is used to protect from requesting to unstake from previous signatures.
    CountersUpgradeable.Counter private unstakeNonce;

    // @dev Address of the Rewards & StakedLyxToken contracts.
    IRewards private rewards;
    IStakedLyxToken private stakedLyxToken;

    // @dev Address of the Pool contract.
    IPool private pool;

    // @dev Address of the PoolValidators contract.
    IPoolValidators private poolValidators;

    // @dev Address of the MerkleDistributor contract.
    IMerkleDistributor private merkleDistributor;

    /**
     * @dev Modifier for checking whether the caller is an oracle.
     */
    modifier onlyOracle() {
        require(hasRole(ORACLE_ROLE, msg.sender), "Oracles: access denied");
        _;
    }
    /**
     * @dev Modifier for checking whether the caller is an orchestrator.
     */
    modifier onlyOrchestrator() {
        require(hasRole(ORCHESTRATOR_ROLE, msg.sender), "Orchestrators: access denied");
        _;
    }

    function initialize(
        address _admin,
        address _rewards,
        address _stakedLyxToken,
        address _pool,
        address _poolValidators,
        address _merkleDistributor
    ) external initializer {
        require(_rewards != address(0), "Oracles: invalid rewards address");
        require(_stakedLyxToken != address(0), "Oracles: invalid stakedLyxToken address");
        require(_pool != address(0), "Oracles: invalid pool address");
        require(_poolValidators != address(0), "Oracles: invalid poolValidators address");
        require(_merkleDistributor != address(0), "Oracles: invalid merkleDistributor address");

        oracleCount = 0;
        __OwnablePausableUpgradeable_init_unchained(_admin);
        rewards = IRewards(_rewards);
        stakedLyxToken = IStakedLyxToken(_stakedLyxToken);
        pool = IPool(_pool);
        poolValidators = IPoolValidators(_poolValidators);
        merkleDistributor = IMerkleDistributor(_merkleDistributor);
    }

    /**
     * @dev See {IOracles-currentRewardsNonce}.
     */
    function currentRewardsNonce() external view override returns (uint256) {
        return rewardsNonce.current();
    }

    /**
     * @dev See {IOracles-currentValidatorsNonce}.
     */
    function currentValidatorsNonce() external view override returns (uint256) {
        return validatorsNonce.current();
    }

    /**
     * @dev See {IOracles-currentValidatorsNonce}.
     */
    function currentUnstakeNonce() external view override returns (uint256) {
        return unstakeNonce.current();
    }

    function isOrchestrator(address account) external view returns (bool) {
        return hasRole(ORCHESTRATOR_ROLE, account);
    }

    function addOrchestrator(address account) external onlyAdmin {
        require(account != address(0), "Orchestrators: invalid orchestrator address");
        require(!hasRole(ORCHESTRATOR_ROLE, account), "Oracles: orchestrator already exists");
        grantRole(ORCHESTRATOR_ROLE, account);
        emit OrchestratorAdded(account);
    }

    /**
     * @dev See {IOracles-removeOrchestator}.
     */
    function removeOrchestrator(address account) external onlyAdmin {
        require(
            hasRole(ORCHESTRATOR_ROLE, account),
            "Orchestrators: Account isn't an orchestrator"
        );
        revokeRole(ORCHESTRATOR_ROLE, account);
        emit OrchestratorRemoved(account);
    }

    /**
     * @dev See {IOracles-isOracle}.
     */
    function isOracle(address account) external view override returns (bool) {
        return hasRole(ORACLE_ROLE, account);
    }

    /**
     * @dev See {IOracles-addOracle}.
     */
    function addOracle(address account) external override onlyAdmin {
        require(account != address(0), "Oracles: invalid oracle address");
        require(!hasRole(ORACLE_ROLE, account), "Oracles: oracle already exists");
        grantRole(ORACLE_ROLE, account);
        oracleCount++;
        emit OracleAdded(account);
    }

    /**
     * @dev See {IOracles-removeOracle}.
     */
    function removeOracle(address account) external override onlyAdmin {
        require(hasRole(ORACLE_ROLE, account), "Oracles: oracle do not exists");
        revokeRole(ORACLE_ROLE, account);
        oracleCount--;
        emit OracleRemoved(account);
    }

    /**
     * @dev See {IOracles-isMerkleRootVoting}.
     */
    function isMerkleRootVoting() public view override returns (bool) {
        uint256 lastRewardBlockNumber = rewards.lastUpdateBlockNumber();
        return
            merkleDistributor.lastUpdateBlockNumber() < lastRewardBlockNumber &&
            lastRewardBlockNumber != block.number;
    }

    /**
     * @dev Function for checking whether the number of signatures is enough to update the value.
     * @param signaturesCount - number of signatures.
     */
    function isEnoughSignatures(uint256 signaturesCount) internal view returns (bool) {
        return oracleCount >= signaturesCount && signaturesCount * 3 > oracleCount * 2;
    }

    /**
     * @dev See {IOracles-submitRewards}.
     */
    function submitRewards(
        uint256 totalRewards,
        uint256 activatedValidators,
        uint256 exitedValidators,
        bytes[] calldata signatures
    ) external override onlyOrchestrator whenNotPaused {
        require(isEnoughSignatures(signatures.length), "Oracles: invalid number of signatures");

        // calculate candidate ID hash
        uint256 nonce = rewardsNonce.current();
        bytes32 candidateId = ECDSAUpgradeable.toEthSignedMessageHash(
            keccak256(abi.encode(nonce, activatedValidators, exitedValidators, totalRewards))
        );

        // check signatures and calculate number of submitted oracle votes
        address[] memory signedOracles = _verifySignatures(candidateId, signatures);

        // increment nonce for future signatures
        rewardsNonce.increment();

        emit RewardsVoteSubmitted(
            msg.sender,
            signedOracles,
            nonce,
            totalRewards,
            activatedValidators,
            exitedValidators
        );

        // update total rewards
        rewards.updateTotalRewards(totalRewards);

        // update activated validators
        if (activatedValidators != pool.activatedValidators()) {
            pool.setActivatedValidators(activatedValidators);
        }

        uint256 newExitedValidators = exitedValidators - pool.exitedValidators();

        if (newExitedValidators > 0) {
            pool.setExitedValidators(exitedValidators);
            stakedLyxToken.unstakeProcessed(newExitedValidators);
        }
    }

    /**
     * @dev See {IOracles-submitMerkleRoot}.
     */
    function submitMerkleRoot(
        bytes32 merkleRoot,
        string calldata merkleProofs,
        bytes[] calldata signatures
    ) external override onlyOrchestrator whenNotPaused {
        require(isMerkleRootVoting(), "Oracles: too early");
        require(isEnoughSignatures(signatures.length), "Oracles: invalid number of signatures");

        // calculate candidate ID hash
        uint256 nonce = rewardsNonce.current();
        bytes32 candidateId = ECDSAUpgradeable.toEthSignedMessageHash(
            keccak256(abi.encode(nonce, merkleProofs, merkleRoot))
        );

        // check signatures and calculate number of submitted oracle votes
        address[] memory signedOracles = _verifySignatures(candidateId, signatures);

        // increment nonce for future signatures
        rewardsNonce.increment();

        emit MerkleRootVoteSubmitted(msg.sender, signedOracles, nonce, merkleRoot, merkleProofs);

        // update merkle root
        merkleDistributor.setMerkleRoot(merkleRoot, merkleProofs);
    }

    /**
     * @dev See {IOracles-registerValidators}.
     */
    function registerValidators(
        IPoolValidators.DepositData[] calldata depositData,
        bytes32[][] calldata merkleProofs,
        bytes32 validatorsDepositRoot,
        bytes[] calldata signatures
    ) external override onlyOrchestrator whenNotPaused {
        require(
            pool.validatorRegistration().get_deposit_root() == validatorsDepositRoot,
            "Oracles: invalid validators deposit root"
        );
        require(isEnoughSignatures(signatures.length), "Oracles: invalid number of signatures");

        // calculate candidate ID hash
        uint256 nonce = validatorsNonce.current();
        bytes32 candidateId = ECDSAUpgradeable.toEthSignedMessageHash(
            keccak256(abi.encode(nonce, depositData, validatorsDepositRoot))
        );

        // check signatures and calculate number of submitted oracle votes
        address[] memory signedOracles = _verifySignatures(candidateId, signatures);

        uint256 depositDataLength = depositData.length;
        require(merkleProofs.length == depositDataLength, "Oracles: invalid merkle proofs length");

        // submit deposit data
        for (uint256 i = 0; i < depositDataLength; i++) {
            // register validator
            poolValidators.registerValidator(depositData[i], merkleProofs[i]);
        }
        // increment nonce for future registrations
        validatorsNonce.increment();

        emit RegisterValidatorsVoteSubmitted(msg.sender, signedOracles, nonce);
    }

    /**
     * @dev See {IOracles-setUnstakeProcessing}.
     */
    function setUnstakeProcessing(
        bytes[] calldata signatures
    ) external override onlyOrchestrator whenNotPaused {
        require(isEnoughSignatures(signatures.length), "Oracles: invalid number of signatures");

        // calculate candidate ID hash
        uint256 nonce = unstakeNonce.current();
        bytes32 candidateId = ECDSAUpgradeable.toEthSignedMessageHash(
            keccak256(abi.encode(nonce, "setUnstakeProcessing"))
        );

        // check signatures and calculate number of submitted oracle votes
        address[] memory signedOracles = _verifySignatures(candidateId, signatures);

        // Set unstake as processing
        stakedLyxToken.setUnstakeProcessing();

        unstakeNonce.increment();

        emit UnstakeProcessingVoteSubmitted(msg.sender, signedOracles, nonce);
    }

    /**
     * @dev verifySignatures
     *
     * @param candidateId - The hashed value signed by the oracles
     * @param signatures - The array of signatures
     * @return An array of addresses representing the signed oracles
     *
     * @dev Verifies the signatures provided by the oracles and returns an array of addresses
     * that represent the oracles who signed the candidateId.
     */
    function _verifySignatures(
        bytes32 candidateId,
        bytes[] calldata signatures
    ) internal returns (address[] memory) {
        address[] memory signedOracles = new address[](signatures.length);
        for (uint256 i = 0; i < signatures.length; i++) {
            bytes memory signature = signatures[i];
            address signer = ECDSAUpgradeable.recover(candidateId, signature);
            require(hasRole(ORACLE_ROLE, signer), "Oracles: invalid signer");

            for (uint256 j = 0; j < i; j++) {
                require(signedOracles[j] != signer, "Oracles: repeated signature");
            }
            signedOracles[i] = signer;
        }
        return signedOracles;
    }
}
