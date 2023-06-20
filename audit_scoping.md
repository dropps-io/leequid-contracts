# Audit Scoping

Link: https://github.com/dropps-io/leequid-contracts

The LEEQUID smart contracts are forked from [StakeWise V2 smart contracts](https://github.com/stakewise/contracts) (already audited multiple time) and adapted to use [LSP7](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-7-DigitalAsset.md) instead of ERC20.

## Notes

As the StakeWise protocol V2 was deployed 2 years ago, rewards withdrawals were not yet possible, 
so the rewards were not going back to the protocol, explaining the utility of a dual token system.  
As now, rewards withdrawals are possible, the dual token system is not needed anymore, 
and that's why we only used the sLYX token in our fork (RewardLyxToken contract is not a token anymore).
The RewardLyxToken contract is now used to receive the rewards (it is the withdrawal credential of the validators), 
to keep track of the rewards, and allow the stakers to claim their rewards (cash out or compound) directly in LYX.

A unstake mechanism (validator exiting) was also added to the protocol.
For the reason that validators withdrawals are not possible yet, the feature will be activated later.

## Scope

- [x] [Oracles.sol](./contracts/Oracles.sol)
- [x] [AdminUpgradeabilityProxy.sol](./contracts/AdminUpgradeableProxy.sol)
- [x] [StakedLyxToken.sol](./contracts/tokens/StakedLyxToken.sol)
- [x] [RewardLyxToken.sol](./contracts/tokens/RewardLyxToken.sol)
- [x] [Pool.sol](./contracts/pool/Pool.sol)
- [x] [PoolValidators.sol](./contracts/pool/PoolValidators.sol)
- [x] [FeesEscrow.sol](./contracts/pool/FeesEscrow.sol)
- [x] [MerkleDistributor.sol](./contracts/merkles/MerkleDistributor.sol)
- [ ] [Roles.sol](./contracts/Roles.sol)
- [ ] [ContractChecker.sol](./contracts/ContractChecker.sol)
- [ ] [OwnablePausableUpgradeable.sol](./contracts/presets/OwnablePausableUpgradeable.sol)
- [ ] [OwnablePausable.sol](./contracts/presets/OwnablePausable.sol)
- [ ] [MerkleDrop.sol](./contracts/merkles/MerkleDrop.sol)

## Contracts

### Oracles 

The [Oracles](./contracts/Oracles.sol) contract stores the accounts responsible for submitting or updating values based on the off-chain data.
The threshold of inputs from different oracles is required to submit the data.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- Addition of the `setUnstakeProcessing` method
- Modification of the `submitRewards` method so it also takes the exited validators amount in parameter

### AdminUpgradeabilityProxy

The [AdminUpgradeabilityProxy](./contracts/AdminUpgradeableProxy.sol) contract is used to upgrade the implementation of the proxy contract.
This contract is not forked from StakeWise V2.

### StakedLyxToken

The [StakedLyxToken](./contracts/tokens/StakedLyxToken.sol) contract is used to represent the pool staked LYX tokens.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- Migration from ERC20 to LSP7
- Addition of an unstake mechanism (`unstake`, `matchUnstake`, `setUnstakeProcessing`, `unstakeProcessed`, `claimUnstake` methods)

### RewardLyxToken

The [RewardLyxToken](./contracts/tokens/RewardLyxToken.sol) contract is used to keep track of the rewards of each staker.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- Removed the ERC20 interface (the contract is not a token anymore)
- Addition of the `cashOutRewards`, `compoundRewards`, and `claimUnstake` methods

### Pool

The [Pool](./contracts/pool/Pool.sol) contract is used to manage the staking pool.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- Addition of the `setExitedValidators` method

### PoolValidators

The [PoolValidators](./contracts/pool/PoolValidators.sol) contract is used to manage the validators of the pool.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library

### FeesEscrow

The [FeesEscrow](./contracts/pool/FeesEscrow.sol) contract is used to manage the consensus fees received by the nodes.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Fees being sent the `RewardLyxToken` contract instead of the `Pool` contract

### MerkleDistributor

The [MerkleDistributor](./contracts/merkles/MerkleDistributor.sol) contract is used to manage the merkle distribution of the rewards 
(for stakers adding their sLYX to liquidity pools).

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- ERC20 usages changed to LSP7