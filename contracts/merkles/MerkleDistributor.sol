// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "../presets/OwnablePausableUpgradeable.sol";
import "../interfaces/IMerkleDistributor.sol";
import "../interfaces/IOracles.sol";
import "../interfaces/IRewardLyxToken.sol";


/**
 * @title MerkleDistributor
 *
 * @dev MerkleDistributor contract distributes rETH2 and other tokens calculated by oracles.
 */
contract MerkleDistributor is IMerkleDistributor, OwnablePausableUpgradeable {

    // @dev Merkle Root for proving rewards ownership.
    bytes32 public override merkleRoot;

    // @dev Address of the rewardLyxToken contract.
    address public override rewardLyxToken;

    // @dev Address of the Oracles contract.
    IOracles public override oracles;

    // @dev Last merkle root update block number performed by oracles.
    uint256 public override lastUpdateBlockNumber;

    // This is a packed array of booleans.
    mapping (bytes32 => mapping (uint256 => uint256)) private _claimedBitMap;

    function initialize(
        address _admin,
        address _rewardLyxToken,
        address _oracles
    ) external initializer {
        __OwnablePausableUpgradeable_init_unchained(_admin);
        rewardLyxToken = _rewardLyxToken;
        oracles = IOracles(_oracles);
    }

    /**
     * @dev See {IMerkleDistributor-upgrade}.
     */
    function upgrade(address _oracles) external override onlyAdmin whenPaused {
        require(
            _oracles != address(0) && address(oracles) == 0x2f1C5E86B13a74f5A6E7B4b35DD77fe29Aa47514,
            "MerkleDistributor: invalid Oracles address"
        );
        oracles = IOracles(_oracles);
    }

    /**
     * @dev See {IMerkleDistributor-claimedBitMap}.
     */
    function claimedBitMap(bytes32 _merkleRoot, uint256 _wordIndex) external view override returns (uint256) {
        return _claimedBitMap[_merkleRoot][_wordIndex];
    }

    /**
     * @dev See {IMerkleDistributor-setMerkleRoot}.
     */
    function setMerkleRoot(bytes32 newMerkleRoot, string calldata newMerkleProofs) external override {
        require(msg.sender == address(oracles), "MerkleDistributor: access denied");
        merkleRoot = newMerkleRoot;
        lastUpdateBlockNumber = block.number;
        emit MerkleRootUpdated(msg.sender, newMerkleRoot, newMerkleProofs);
    }

    /**
     * @dev See {IMerkleDistributor-distributePeriodically}.
     */
    function distributePeriodically(
        address from,
        address token,
        address beneficiary,
        uint256 amount,
        uint256 durationInBlocks
    )
        external override onlyAdmin whenNotPaused
    {
        require(amount > 0, "MerkleDistributor: invalid amount");

        uint256 startBlock = block.number;
        uint256 endBlock = startBlock + durationInBlocks;
        require(endBlock > startBlock, "MerkleDistributor: invalid blocks duration");

        _transferToken(from, address(this), token, amount);

        emit PeriodicDistributionAdded(from, token, beneficiary, amount, startBlock, endBlock);
    }

    /**
     * @dev See {IMerkleDistributor-distributeOneTime}.
     */
    function distributeOneTime(
        address from,
        address origin,
        address token,
        uint256 amount,
        string calldata rewardsLink
    )
        external override onlyAdmin whenNotPaused
    {
        require(amount > 0, "MerkleDistributor: invalid amount");

        _transferToken(from, address(this), token, amount);
        emit OneTimeDistributionAdded(from, origin, token, amount, rewardsLink);
    }

    /**
     * @dev See {IMerkleDistributor-isClaimed}.
     */
    function isClaimed(uint256 index) external view override returns (bool) {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = _claimedBitMap[merkleRoot][claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        return claimedWord & mask == mask;
    }

    function _setClaimed(uint256 index, bytes32 _merkleRoot) internal {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = _claimedBitMap[_merkleRoot][claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        require(claimedWord & mask != mask, "MerkleDistributor: already claimed");
        _claimedBitMap[_merkleRoot][claimedWordIndex] = claimedWord | mask;
    }

    /**
     * @dev See {IMerkleDistributor-claim}.
     */
    function claim(
        uint256 index,
        address account,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata merkleProof
    )
        external override whenNotPaused
    {
        require(account != address(0), "MerkleDistributor: invalid account");
        address _rewardLyxToken = rewardLyxToken; // gas savings
        require(
            IRewardLyxToken(_rewardLyxToken).lastUpdateBlockNumber() < lastUpdateBlockNumber,
            "MerkleDistributor: merkle root updating"
        );

        // verify the merkle proof
        bytes32 _merkleRoot = merkleRoot; // gas savings
        bytes32 node = keccak256(abi.encode(index, tokens, account, amounts));
        require(MerkleProofUpgradeable.verify(merkleProof, _merkleRoot, node), "MerkleDistributor: invalid proof");

        // mark index claimed
        _setClaimed(index, _merkleRoot);

        // send the tokens
        uint256 tokensCount = tokens.length;
        for (uint256 i = 0; i < tokensCount; i++) {
            address token = tokens[i];
            uint256 amount = amounts[i];
            if (token == _rewardLyxToken) {
                IRewardLyxToken(_rewardLyxToken).claim(account, amount);
            } else {
                _transferToken(address(this), account, token, amount);
            }
        }
        emit Claimed(account, index, tokens, amounts);
    }

    function _transferToken(
        address from,
        address to,
        address token,
        uint256 amount
    ) internal {
        IERC20 erc20Token = IERC20(token);
        SafeERC20.safeTransferFrom(erc20Token, from, to, amount);
    }
}
