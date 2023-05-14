// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.20;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./presets/OwnablePausableUpgradeable.sol";
import "./interfaces/IRewardLyxToken.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IOracles.sol";
import "./interfaces/IMerkleDistributor.sol";
import "./interfaces/IPoolValidators.sol";
import "./interfaces/IStakedLyxToken.sol";

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
    uint256 public oracleCount;

    // @dev Rewards nonce is used to protect from submitting the same rewards vote several times.
    CountersUpgradeable.Counter private rewardsNonce;

    // @dev Validators nonce is used to protect from submitting the same validator vote several times.
    CountersUpgradeable.Counter private validatorsNonce;

    // @dev Unstake nonce is used to protect from requesting to start .
    CountersUpgradeable.Counter private unstakeNonce;

    // @dev Address of the RewardLyxToken contract.
    IRewardLyxToken private rewardLyxToken;
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

    function initialize(
        address _admin,
        address _rewardLyxToken,
        address _stakedLyxToken,
        address _pool,
        address _poolValidators,
        address _merkleDistributor
    ) external initializer {
        require(_rewardLyxToken != address(0), "Oracles: invalid rewardLyxToken address");
        require(_stakedLyxToken != address(0), "Oracles: invalid stakedLyxToken address");
        require(_pool != address(0), "Oracles: invalid pool address");
        require(_poolValidators != address(0), "Oracles: invalid poolValidators address");
        require(_merkleDistributor != address(0), "Oracles: invalid merkleDistributor address");

        oracleCount = 0;
        __OwnablePausableUpgradeable_init_unchained(_admin);
        rewardLyxToken = IRewardLyxToken(_rewardLyxToken);
        stakedLyxToken = IStakedLyxToken(_stakedLyxToken);
        pool = IPool(_pool);
        poolValidators = IPoolValidators(_poolValidators);
        merkleDistributor = IMerkleDistributor(_merkleDistributor);
    }

    /**
     * @dev See {IOracles-currentRewardsNonce}.
     */
    function currentRewardsNonce() external override view returns (uint256) {
        return rewardsNonce.current();
    }

    /**
     * @dev See {IOracles-currentValidatorsNonce}.
     */
    function currentValidatorsNonce() external override view returns (uint256) {
        return validatorsNonce.current();
    }

    /**
     * @dev See {IOracles-currentValidatorsNonce}.
     */
    function currentUnstakeNonce() external override view returns (uint256) {
        return unstakeNonce.current();
    }

    /**
     * @dev See {IOracles-isOracle}.
     */
    function isOracle(address account) external override view returns (bool) {
        return hasRole(ORACLE_ROLE, account);
    }

    /**
     * @dev See {IOracles-addOracle}.
     */
    function addOracle(address account) external override {
        require(account != address(0), "Oracles: invalid oracle address");
        grantRole(ORACLE_ROLE, account);
        oracleCount++;
        emit OracleAdded(account);
    }

    /**
     * @dev See {IOracles-removeOracle}.
     */
    function removeOracle(address account) external override {
        revokeRole(ORACLE_ROLE, account);
        oracleCount--;
        emit OracleRemoved(account);
    }

    /**
     * @dev See {IOracles-isMerkleRootVoting}.
     */
    function isMerkleRootVoting() public override view returns (bool) {
        uint256 lastRewardBlockNumber = rewardLyxToken.lastUpdateBlockNumber();
        return merkleDistributor.lastUpdateBlockNumber() < lastRewardBlockNumber && lastRewardBlockNumber != block.number;
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
        bytes[] calldata signatures
    ) external override onlyOracle whenNotPaused {
        require(isEnoughSignatures(signatures.length), "Oracles: invalid number of signatures");

        // calculate candidate ID hash
        uint256 nonce = rewardsNonce.current();
        bytes32 candidateId = ECDSAUpgradeable.toEthSignedMessageHash(
            keccak256(abi.encode(nonce, activatedValidators, totalRewards))
        );

        // check signatures and calculate number of submitted oracle votes
        address[] memory signedOracles = _verifySignatures(candidateId, signatures);

        // increment nonce for future signatures
        rewardsNonce.increment();

        emit RewardsVoteSubmitted(msg.sender, signedOracles, nonce, totalRewards, activatedValidators);

        // update total rewards
        rewardLyxToken.updateTotalRewards(totalRewards);

        // update activated validators
        if (activatedValidators != pool.activatedValidators()) {
            pool.setActivatedValidators(activatedValidators);
        }
    }

    /**
     * @dev See {IOracles-submitMerkleRoot}.
    */
    function submitMerkleRoot(
        bytes32 merkleRoot,
        string calldata merkleProofs,
        bytes[] calldata signatures
    ) external override onlyOracle whenNotPaused {
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
    )
    external override onlyOracle whenNotPaused
    {
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
     * @dev See {IOracles-submitRewards}.
    */
    function setUnstakeProcessing(bytes[] calldata signatures) external override onlyOracle whenNotPaused {
        require(isEnoughSignatures(signatures.length), "Oracles: invalid number of signatures");

        // calculate candidate ID hash
        uint256 nonce = unstakeNonce.current();
        bytes32 candidateId = ECDSAUpgradeable.toEthSignedMessageHash(
            keccak256(abi.encode(nonce, "setUnstakeProcessing"))
        );

        // check signatures and calculate number of submitted oracle votes
        address[] memory signedOracles = _verifySignatures(candidateId, signatures);

        // update total rewards
        bool processing = stakedLyxToken.setUnstakeProcessing(nonce);

        if (!processing) unstakeNonce.increment();

        emit UnstakeProcessingVoteSubmitted(msg.sender, signedOracles, nonce);
    }

    function submitUnstakeAmount(uint256 unstakeAmount, bytes[] calldata signatures) external override onlyOracle whenNotPaused {
        require(isEnoughSignatures(signatures.length), "Oracles: invalid number of signatures");
        require(unstakeAmount > 0 &&  (unstakeAmount % VALIDATOR_TOTAL_DEPOSIT) == 0, "Oracles: unstake amount must be non null and a multiple of VALIDATOR_TOTAL_DEPOSIT LYX");

        // calculate candidate ID hash
        uint256 nonce = unstakeNonce.current();
        bytes32 candidateId = ECDSAUpgradeable.toEthSignedMessageHash(
            keccak256(abi.encode(nonce, unstakeAmount, "submitUnstakeAmount"))
        );

        // check signatures and calculate number of submitted oracle votes
        address[] memory signedOracles = _verifySignatures(candidateId, signatures);

        // update total rewards
        stakedLyxToken.unstakeProcessed(nonce, unstakeAmount);
        pool.addRemovedValidators(unstakeAmount / VALIDATOR_TOTAL_DEPOSIT);

        unstakeNonce.increment();

        emit SubmitUnstakeAmountVoteSubmitted(msg.sender, signedOracles, nonce, unstakeAmount);
    }

    function _verifySignatures(bytes32 candidateId, bytes[] calldata signatures) internal returns (address[] memory) {
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