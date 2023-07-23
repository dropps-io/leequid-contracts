# Unstaking Process Documentation

## Overview
Unstaking in our Liquid Staking application, LEEQUID, involves a series of interactions between multiple components, 
including smart contracts, Oracles, and the Orchestrator. This document provides a detailed guide to the unstaking 
process, including the steps taken from the initial request to the final claim of unstaked LYX tokens.

## Process Flow

![unstake_happy_path.png](diagrams%2Funstake_happy_path.png)

### 1. Unstake Request

The user initiates an unstake request through the `StakedLyxToken` contract. The request should involve more than 32 LYX
tokens for the unstake process to start.

### 2. Oracle Check

After 24 hours, if more than 32 LYX tokens are still pending unstaking, the Orchestrator app sends a request to the 
Oracle app to check if unstaking is necessary.

### 3. Oracle Response

The Oracle app fetches data from the blockchain and, upon confirming the necessity for unstaking, signs a message and 
sends it back to the Orchestrator app.

### 4. Transaction Submission

The Orchestrator app aggregates all the signatures from the Oracle apps and sends a transaction to the `Oracles` smart contract.

### 5. Unstake Processing

The `Oracles` smart contract verifies the signatures and calls the `StakedLyxToken` contract, setting it to unstake 
processing status and blocking any new unstake requests. The `StakedLyxToken` contract triggers an `UnstakeReady` event
with the number of validators to exit as a parameter. LEEQUID manually unstakes the required number of validators after 
receiving this event.

### 6. Exit Check

After approximately 16 hours of unstaking processing, the Orchestrator app asks the Oracle app to check the rewards and 
the status of the validators. The Oracle app sends back signed messages, which include information about new rewards and 
exited validators.

### 7. Reward and Validator Status Update

The Orchestrator app again aggregates the signatures and sends them to the `Oracles` contract. If the `Oracles` contract
detects new exited validators, it will call the `Pool` contract to update the number of exited validators and the 
`StakedLyxToken` contract to process the unstakes, using the number of new unstaked validators as a parameter.

### 8. Unstake Request Status Update

The `StakedLyxToken` contract updates the status of the unstake requests according to the amount of LYX unstaked 
(exited validators * 32 LYX). If after updating the statuses, the total pending unstake is below 32 LYX, it sets the
unstake processing status as false again, which allows people to request unstakes once more.

### 9. Unstake Claim

After the unstake requests are processed, the user can claim their unstake on the `Rewards` contract.

## Key Points to Note
1. The Orchestrator app plays a critical role in controlling the actions of the Oracle apps and aggregating their votes.
2. The Oracle apps act as a bridge between the blockchain and the backend, fetching necessary data and voting for actions accordingly.
3. The `Oracles` smart contract works as an interface between the backend and the protocol. It submits the rewards, 
registers new validators, initiates an unstake process, and submits merkle trees for token distribution.
4. The user needs to wait for around 24 + 16 hours after making an unstake request for the process to be completed 
(considering the unstake was not matched with stake requests).
5. Any unstaked tokens can be claimed from the `Rewards` contract.

This documentation should provide a clear understanding of the unstaking process in LEEQUID. For any further 
clarification, please refer to the codebase or ask questions to our developer team.