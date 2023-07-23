# StakedLyxToken Smart Contract Documentation

**StakedLyxToken** is a smart contract designed to facilitate staking and unstaking operations on the LyxToken. 
The contract follows the LSP7 token standard (Lukso Standard Proposal number 7) and is built with Solidity, 
making it compatible with the Ethereum blockchain.

## Key features

### Staking

The contract enables users to keep track of their staked tokens by minting 1 sLYX token for each LYX token staked on the `Pool` contract.

### Unstaking

The contract includes a comprehensive unstaking mechanism, allowing users to request unstaking of their tokens. 
Unstaking requests are stored in the `_unstakeRequests` mapping and can be retrieved using the `unstakeRequest` function. 
The `unstake` function can be used to initiate an unstake request, 
which will subtract the unstaked amount from the user's deposit and increase the total pending unstake.

### Token Transfer

The contract allows for the transfer of staked tokens between addresses. 
When transferring sLYX tokens, checkpoints are created for both addresses on the `Rewards` contract, to save the current rewards states. 
Indeed, when transferring sLYX, it's the new owner of the tokens that will get the next associated rewards.

### Authorization

The contract includes a functionality for authorizing operators to manage token operations on behalf of the token owner. 
The `authorizeOperator` and `revokeOperator` functions allow token owners to respectively grant and revoke operator rights.

### Rewards

The `toggleRewards` function allows the admin to enable or disable rewards for a specific user.

### Pausable and Ownable

The contract follows the Ownable and Pausable patterns,
providing security mechanisms to pause contract functionalities and restrict contract management to authorized addresses.

### Upgradable

The contract can be upgraded, ensuring that it can be improved and expanded upon 
in the future without affecting the current state and functionality.
