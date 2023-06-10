// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;
pragma abicoder v2;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IOracles} from "../interfaces/IOracles.sol";
import {IMerkleDistributor} from "../interfaces/IMerkleDistributor.sol";

contract MulticallMock {
    struct OracleRewards {
        uint256 totalRewards;
        uint256 activatedValidators;
        uint256 exitedValidators;
        bytes[] signatures;
    }

    struct MerkleRoot {
        bytes32 merkleRoot;
        string merkleProofs;
        bytes[] signatures;
    }

    IOracles private oracles;
    IERC20Upgradeable private stakedEthToken;
    IERC20Upgradeable private rewardEthToken;
    IMerkleDistributor private merkleDistributor;

    constructor(address _oracles, address _stakedEthToken, address _rewardEthToken, address _merkleDistributor) {
        oracles = IOracles(_oracles);
        stakedEthToken = IERC20Upgradeable(_stakedEthToken);
        rewardEthToken = IERC20Upgradeable(_rewardEthToken);
        merkleDistributor = IMerkleDistributor(_merkleDistributor);
    }

    function transferRewardsAndUpdateTotalRewards(
        uint256 totalRewards,
        uint256 activatedValidators,
        uint256 exitedValidators,
        address payee,
        bytes[] calldata signatures
    )
    external
    {
        rewardEthToken.transferFrom(msg.sender, payee, rewardEthToken.balanceOf(msg.sender));
        oracles.submitRewards(totalRewards, activatedValidators, exitedValidators, signatures);
    }

    function updateTotalRewardsAndTransferRewards(
        uint256 totalRewards,
        uint256 activatedValidators,
        uint256 exitedValidators,
        address payee,
        bytes[] calldata signatures
    )
    external
    {
        oracles.submitRewards(totalRewards, activatedValidators, exitedValidators, signatures);
        rewardEthToken.transferFrom(msg.sender, payee, rewardEthToken.balanceOf(msg.sender));
    }

    function updateTotalRewardsAndClaim(
        OracleRewards memory oracleRewards,
        uint256 index,
        address account,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata merkleProof
    )
    external
    {
        oracles.submitRewards(oracleRewards.totalRewards, oracleRewards.activatedValidators, oracleRewards.exitedValidators, oracleRewards.signatures);
        merkleDistributor.claim(index, account, tokens, amounts, merkleProof);
    }

    function claimAndUpdateTotalRewards(
        OracleRewards memory oracleRewards,
        uint256 index,
        address account,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata merkleProof
    )
    external
    {
        merkleDistributor.claim(index, account, tokens, amounts, merkleProof);
        oracles.submitRewards(oracleRewards.totalRewards, oracleRewards.activatedValidators, oracleRewards.exitedValidators, oracleRewards.signatures);
    }

    function claimAndUpdateMerkleRoot(
        MerkleRoot memory merkleRoot,
        uint256 index,
        address account,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata merkleProof
    )
    external
    {
        merkleDistributor.claim(index, account, tokens, amounts, merkleProof);
        oracles.submitMerkleRoot(merkleRoot.merkleRoot, merkleRoot.merkleProofs, merkleRoot.signatures);
    }

    function updateMerkleRootAndClaim(
        MerkleRoot memory merkleRoot,
        uint256 index,
        address account,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata merkleProof
    )
    external
    {
        oracles.submitMerkleRoot(merkleRoot.merkleRoot, merkleRoot.merkleProofs, merkleRoot.signatures);
        merkleDistributor.claim(index, account, tokens, amounts, merkleProof);
    }

    function updateTotalRewardsAndTransferStakedEth(
        uint256 totalRewards,
        uint256 activatedValidators,
        uint256 exitedValidators,
        address payee,
        bytes[] calldata signatures
    )
    external
    {
        oracles.submitRewards(totalRewards, activatedValidators, exitedValidators, signatures);
        stakedEthToken.transferFrom(msg.sender, payee, stakedEthToken.balanceOf(msg.sender));
    }

    function transferStakedEthAndUpdateTotalRewards(
        uint256 totalRewards,
        uint256 activatedValidators,
        uint256 exitedValidators,
        address payee,
        bytes[] calldata signatures
    )
    external
    {
        stakedEthToken.transferFrom(msg.sender, payee, stakedEthToken.balanceOf(msg.sender));
        oracles.submitRewards(totalRewards, activatedValidators, exitedValidators, signatures);
    }

    function updateTotalRewardsAndMerkleRoot(
        OracleRewards memory oracleRewards,
        MerkleRoot memory merkleRoot
    )
    external
    {
        oracles.submitRewards(oracleRewards.totalRewards, oracleRewards.activatedValidators, oracleRewards.exitedValidators, oracleRewards.signatures);
        oracles.submitMerkleRoot(merkleRoot.merkleRoot, merkleRoot.merkleProofs, merkleRoot.signatures);
    }
}
