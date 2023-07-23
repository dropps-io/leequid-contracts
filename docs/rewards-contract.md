# Rewards Smart Contract Overview

## General Description

The Rewards contract is a critical part of the liquid staking application.

<b>This contract is the withdrawal address of the procotol validators:</b> 
It's where all the rewards and unstakes from the protocol validators get sent to. 

It is responsible for handling and distributing the received rewards.

The Rewards contract is a key piece in the liquid staking application, providing a way to distribute rewards to protocol 
participants, handling protocol fees, and managing checkpoints for efficient reward calculation.

This contract interacts with various other contracts including:

1. *StakedLyxToken* contract: Tracks the staked tokens.
2. *Oracles* contract: Responsible for updating the total rewards in the Rewards contract.
3. *MerkleDistributor* contract: Distributes the rewards to the protocol's participants.
4. *FeesEscrow* contract: Handles the protocol fees.
5. *Pool* contract: Handles liquidity pools for staking.

## Key Features

### Reward Distribution 

The Rewards contract tracks the total rewards earned by the staking protocol and the amount that has been cashed out. 
It also calculates the reward per token for user reward calculation.

### Checkpointing 

To optimize gas usage and enhance scalability, the contract uses a checkpoint system that keeps track of an account's 
reward at a particular point. The reward per token is stored at each checkpoint, allowing the contract to calculate 
the user's reward.

### Fee Handling 

The contract calculates protocol fees and handles the distribution of these fees. It allows the protocol's admin to set 
the fee recipient address and fee percentage.

### Oracles 

An oracle system is in place that updates the total rewards in the Rewards contract.

### Reward Disabling

The contract provides an option to disable rewards for an account. The state is toggled by calling the 
`setRewardsDisabled` function. The rewards of those disabled addresses goes to the Distributor Principal 
(token distribution calculated off-chain and distributed through the MerkleDistributor contract).
