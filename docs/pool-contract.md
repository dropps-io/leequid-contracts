# Pool Contract Documentation

## Overview

The Pool contract, which inherits from `IPool`, `OwnablePausableUpgradeable`, and `ReentrancyGuardUpgradeable`, is a 
fundamental part of the Liquid Staking App. The contract's primary purpose is to accumulate deposits from users, 
mint tokens, and register validators. This is done within a secure, non-reentrant and pausable smart contract, 
guaranteeing that the code execution is atomic and can be paused when necessary.

## Key Features

### Stake Management
The Pool contract provides functionality for staking. Users can send LYX to the contract using various methods 
(`stake`, `stakeOnBehalf`, `stakeWithPartner`, `stakeWithPartnerOnBehalf`, `stakeWithReferrer`, `stakeWithReferrerOnBehalf`). 
All these methods are non-reentrant, which means they prevent reentrancy attacks - a common smart contract vulnerability.

### Validator Registration
The contract facilitates registering validators with the ETH2 Deposit Contract deployed by Lukso. It keeps track of the 
total number of activated validators and exited validators. It also manages the scheduling of activation and deactivation 
of validators.

### Deposit Tracking
The Pool contract keeps track of the total pending validators and the minimum amount of LYX deposit that is considered 
for the activation period. It also maintains a limit on the pending validators percentage, and if it's not exceeded, 
tokens can be minted immediately. This promotes efficient use of the staking pool and rewards early stakers.

### Upgradeability and Access Control
The contract uses `OwnablePausableUpgradeable` to provide the ability to pause functions during contract upgrades or in 
case of any suspicious activity. This improves the security of the contract and provides a way to prevent malicious activities.

### Secure Execution
The contract employs OpenZeppelin's `ReentrancyGuardUpgradeable` contract to prevent re-entrancy attacks. This ensures 
that all internal calls are completed before the control flow is returned to the external caller.

### Miscellaneous
It also provides an interface to set and update various parameters like min activating deposit, pending validators limit, 
activated validators, exited validators.

To summarize, the Pool contract acts as the core part of the Liquid Staking app, enabling staking and managing validators 
efficiently and securely.
