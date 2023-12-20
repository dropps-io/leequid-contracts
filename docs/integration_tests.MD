# Running Integration Tests

Follow this guide to set up and run specific integration tests for the leequid_contracts and leequid_backend projects.

## Setup in leequid_contracts

1. Install the required dependencies by running the following commands in your leequid_contracts directory:
```bash
yarn install
```
2. Start a local Ethereum node:
```bash
npm run node
```
3. Compile the contracts with the optimizer:
```bash
npx hardhat compile --optimizer
```

4. Deploy locally to get the addresses for your backend:
```bash
node scripts/local/deploy-contracts.js
```

5. After deploying, you will find a local_addresses.json file in your project's root folder. Extract the addresses from this file and use them to fill in your backend's .env file.

## Setup in leequid_backend

1. Create a .env file in your leequid_backend project by copying the contents of .env.example and filling in all the required information.

2. Install the necessary dependencies:

```bash
yarn install
```

3. Set the environment to "integration" and start the Docker containers:

```bash
NODE_ENV="integration"; docker-compose up --build
```


## Execution

- To run specific integration test cases, use the following command:

```bash
npx hardhat run scripts/local/integration/TEST-NAME.js --network local --no-compile
```
Replace TEST-NAME.js with the actual name of the test script you want to run.

- To run all the integration tests you can use this command
```bash
npx hardhat run scripts/local/integration/run-all.js --network local --no-compile
```

These steps should help you set up and run your integration tests smoothly😀.
