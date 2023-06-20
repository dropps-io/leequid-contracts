# Running local tests 

The best way to efficiently run manual tests on the protocol, is to run it and test it locally.
Follow this guide to learn how to proceed

## Setup

Run the following commands:
  
```bash
npm run node
```

Then, in an other terminal, run this command to deploy all the contracts 
and add the operator with the deposit data merkle root:
```bash
npm run deploy-locally
```

All the deployed addresses are now saved in [local_addresses.json](../local_addresses.json)

Then, you can either write scripts or use the existent ones to perform actions, 
or you can run a console to perform actions manually:
```bash
npm run local-console
```

In the console or in scripts you will write, you'll need those lines 
in order to have all the contracts to interact with, and to add the operator  :

```js
let mockBeacon, rewardLyxToken, stakedLyxToken, pool, poolValidators, feesEscrow, merkleDistributor, oracles, operator, admin, protocolFeeRecipient, operator, user1, user2, user3, oracle1, oracle2;
await (async () => {
  const { ethers } = require('hardhat')
  const fs = require('fs');
  const deployedAddresses = JSON.parse(fs.readFileSync('local_addresses.json', 'utf8'));

  const accounts = await ethers.getSigners();
  [admin, protocolFeeRecipient, operator, user1, user2, user3, oracle1, oracle2] = accounts;

  const MockBeacon = await ethers.getContractFactory('DepositContract');
  mockBeacon = MockBeacon.attach(deployedAddresses.MockBeacon);

  const RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
  rewardLyxToken = RewardLyxToken.attach(deployedAddresses.RewardLyxToken);

  const StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
  stakedLyxToken = StakedLyxToken.attach(deployedAddresses.StakedLyxToken);

  const Pool = await ethers.getContractFactory('Pool');
  pool = Pool.attach(deployedAddresses.Pool);

  const PoolValidators = await ethers.getContractFactory('PoolValidators');
  poolValidators = PoolValidators.attach(deployedAddresses.PoolValidators);

  const MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
  merkleDistributor = MerkleDistributor.attach(deployedAddresses.MerkleDistributor);

  const FeesEscrow = await ethers.getContractFactory('FeesEscrow');
  feesEscrow = FeesEscrow.attach(deployedAddresses.FeesEscrow);

  const Oracles = await ethers.getContractFactory('Oracles');
  oracles = Oracles.attach(deployedAddresses.Oracles);
})();

```

You can now add X oracles with the addresses you want 
(either local addresses or addresses used by a local backend):
```js
// Change the addresses to the ones you want if needed
await oracles.connect(admin).addOracle(oracle1.address);
await oracles.connect(admin).addOracle(oracle2.address);
```

