# Audit Scoping

Link: https://github.com/dropps-io/leequid-contracts
Stakewise doc: https://docs.stakewise.io/smart-contracts
Docs: https://github.com/dropps-io/leequid-contracts/tree/master/docs

The LEEQUID smart contracts are forked from [StakeWise V2 smart contracts](https://github.com/stakewise/contracts) (already audited multiple time) and adapted to use [LSP7](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-7-DigitalAsset.md) instead of ERC20.

## Notes

As the StakeWise protocol V2 was deployed 2 years ago, rewards withdrawals were not yet possible, 
so the rewards were not going back to the protocol, explaining the utility of a dual token system.  
As now, rewards withdrawals are possible, the dual token system is not needed anymore, 
and that's why we only used the sLYX token in our fork (Rewards contract is not a token anymore).
The Rewards contract is now used to receive the rewards (it is the withdrawal credential of the validators), 
to keep track of the rewards, and allow the stakers to claim their rewards (cash out or compound) directly in LYX.

A unstake mechanism (validator exiting) was also added to the protocol.

## Dependencies

- [OpenZeppelin Contracts](https://www.npmjs.com/package/@openzeppelin/contracts)
- [LUKSO contracts](https://www.npmjs.com/package/@lukso/lsp-smart-contracts) - For the usage of LSP7 token (already audited multiple times), an ERC20 like standard for LUKSO blockchain

## Scope

- [x] [Oracles.sol](./contracts/Oracles.sol)
- [x] [AdminUpgradeabilityProxy.sol](./contracts/AdminUpgradeableProxy.sol)
- [x] [StakedLyxToken.sol](./contracts/tokens/StakedLyxToken.sol)
- [x] [Rewards.sol](./contracts/tokens/Rewards.sol)
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

![contracts_infra.png](docs%2Fdiagrams%2Fcontracts_infra.png)

### Oracles 

The [Oracles](./contracts/Oracles.sol) contract stores the accounts responsible for submitting or updating values based on the off-chain data.
The Oracles.sol contract act as an interface and between our backend (oracles) and the protocol 
-> It is used for submitting the rewards, registering new validators, starting an unstake process, & submitting merkle tree for token distribution
The threshold of inputs from different oracles is required to submit the data.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- Addition of the `setUnstakeProcessing` method
- Modification of the `submitRewards` method so it also takes the exited validators amount in parameter

### AdminUpgradeabilityProxy

The [AdminUpgradeabilityProxy](./contracts/AdminUpgradeableProxy.sol) contract is used to deploy our protocol in an upgradeable way.
This contract is not forked from StakeWise V2.

### StakedLyxToken

The [StakedLyxToken](./contracts/tokens/StakedLyxToken.sol) contract is used to represent the pool staked LYX as tokens.
1 LYX = 1 sLYX. This contract is also responsible to receive unstake requests from stakers.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- Migration from ERC20 to LSP7
- Addition of an unstake mechanism (`unstake`, `matchUnstake`, `setUnstakeProcessing`, `unstakeProcessed`, `claimUnstake` methods)

### Rewards

The [Rewards](./contracts/tokens/Rewards.sol) contract is used to handle and keep track of the rewards of each staker, as well as the unstaked LYX.
The address of the contract is being used for the withdrawalCredentials of the protocol validators.
Stakers can claim their rewards (cash out or compound) directly in LYX on this contract, and claim their unstaked LYX (once ready).

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- Removed the ERC20 interface (the contract is not a token anymore)
- Addition of the `cashOutRewards`, `compoundRewards`, and `claimUnstake` methods

### Pool

The [Pool](./contracts/pool/Pool.sol) contract is used to receive LYX from stakers and manage the staking pool.
An activation period can be set to avoid having a rewards dilution being too high (when new entrants).
This contract receiving the stakes, it is this contract that register the validators to the Beacon Deposit Contract.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- Addition of the `setExitedValidators` method

### PoolValidators

The [PoolValidators](./contracts/pool/PoolValidators.sol) contract is used to manage the operators and validators of the pool.
In our case, we will (at least at the beginning) be the only operator.
This contract hold the merkle root of our validators, so the protocol can verify that validators we register are part of the merkle.
This contract also ensure that we don't register twice the same validator, by keeping track of the registered validators.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library

### FeesEscrow

The [FeesEscrow](./contracts/pool/FeesEscrow.sol) contract is used to manage the consensus fees received by the nodes.
So the address of this contract is used for the fee recipient address, and when updating the protocol rewards, the fees are transferred to the Rewards contract. 

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Fees being sent the `Rewards` contract instead of the `Pool` contract

### MerkleDistributor

The [MerkleDistributor](./contracts/merkles/MerkleDistributor.sol) contract is used to manage the merkle distribution of the rewards 
(for stakers adding their sLYX to liquidity pools). 
The calculation of the rewards is done off-chain, and the merkle tree is submitted by the oracles.

Fork modifications:
- Solidity version from 0.7.5 to 0.8.20
- Removed usage of SafeMath library
- ERC20 usages changed to LSP7

![infra.png](docs%2Fdiagrams%2Finfra.png)

![stake_happy_path.png](docs%2Fdiagrams%2Fstake_happy_path.png)

![submit_rewards_happy_path.png](docs%2Fdiagrams%2Fsubmit_rewards_happy_path.png)

![unstake_happy_path.png](docs%2Fdiagrams%2Funstake_happy_path.png)
