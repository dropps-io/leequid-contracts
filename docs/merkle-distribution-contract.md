# MerkleDistributor Smart Contract

The MerkleDistributor smart contract is part of a Liquid Staking application designed to distribute rewards based on 
off-chain calculations to users who have contributed their sLYX tokens to liquidity pools like Uniswap.

This contract is beneficial for situations where rewards cannot be directly given to liquidity providers since liquidity 
pools are addresses with disabled rewards. Instead, the rewards are calculated off-chain and distributed using a Merkle tree.

This contract plays a crucial role in the rewards distribution system, enabling a secure, transparent, and efficient 
mechanism for distributing rewards to liquidity providers.

## Key Features

### Merkle Root Management

This contract maintains a Merkle Root (`merkleRoot`) that helps in proving rewards ownership. This can be updated by the 
oracle through `setMerkleRoot` function.

### Claim Mechanism 

Users can claim their rewards through the `claim` function by providing the Merkle proof. The function verifies the proof 
and distributes the reward if the proof is valid.

### Periodic Distribution

The contract allows periodic distribution of tokens through the `distributePeriodically` function. The distribution period 
is defined in terms of block numbers.

### One-time Distribution

For one-off distributions, the `distributeOneTime` function is used. It transfers tokens to the contract and triggers a 
one-time distribution event.

### Claim Status

It provides the `isClaimed` function to check if a particular reward has been claimed or not.

### Upgradeability

The contract allows for updating the Oracles address. This operation can be done only when the contract is paused and 
only by the admin, as ensured by the `upgrade` function.

### Pausing

The contract inherits from `OwnablePausableUpgradeable`, which allows the admin to pause the contract in case of any anomalies. Certain functions like `upgrade`, `distributePeriodically`, `distributeOneTime`, and `claim` are affected by the pause status of the contract.

### Auditable Events

The contract emits specific events like `MerkleRootUpdated`, `PeriodicDistributionAdded`, `OneTimeDistributionAdded`, and `Claimed` to keep a transparent and verifiable record of significant actions.

