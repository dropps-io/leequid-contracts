# Oracles Smart Contract Documentation

## Overview

The Oracles contract forms an integral part of our Liquid Staking application, 
acting as a bridge between our on-chain protocol and off-chain oracles system. 

It primarily serves as a storage for accounts tasked with submitting or updating values based on off-chain data. 
A minimum threshold of inputs from various oracles is required for data submission.

## Key Features

### On-chain role management 

The contract maintains an on-chain record of accounts with `ORACLE_ROLE` and `ORCHESTRATOR_ROLE`. 
It exposes functionalities to add, remove and check whether an account has a particular role.

### Oracle voting 

Oracles collectively participate in voting for updating reward-related values and validator-related values. 
Only when enough signatures (more than 2/3 of total oracles) are provided, the values are updated. 
This offers a level of protection against malicious data manipulation.

### Stake & Unstake Management 

The contract communicates with other contracts to manage staking and unstaking. 
Particularly, it interacts with the StakedLyxToken contract to manage the unstake requests.

### Merkle root submission 

Oracles vote on submitting a new Merkle root. This submission only happens when enough oracles have signed the data, 
and it's the appropriate time for voting, ensuring transparency and data integrity.

### Validator Registration 

This contract facilitates validator registration by orchestrating collective voting of Oracles.

### Robust Security 

The contract includes protective measures to prevent double voting by the same oracle and any unauthorized access. 
It uses the OpenZeppelin library for secure, tested contract standards.

### Pause functionality 

It incorporates Ownable and Pausable capabilities to provide admin control and emergency stop mechanism.

## Understanding The Workflow

1. Oracles are added to the contract. Their collective vote decides various actions.


2. Rewards are submitted by voting. Each oracle signs off on total rewards and validator counts. 
Only when the sufficient number of signatures is collected, these values are updated.


3. Similarly, a new Merkle root can be submitted through collective voting.


4. For validator registration, collective oracle signatures are required for registering multiple validators at once.


5. The contract collaborates with other contracts (like PoolValidators, StakedLyxToken, etc.) 
to achieve specific tasks like updating validator counts or managing unstake requests.

Remember, an understanding of the broader Liquid Staking ecosystem will provide further context to how the Oracles contract fits in.
