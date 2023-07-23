## Fuzz Testing

To run fuzz testing on the contracts, you need to install the following dependencies:
[Foundry](https://book.getfoundry.sh/getting-started/installation)

Install the project dependencies:

```
npm install
```

Then you can run the following commands to start fuzz testing:

First we deploy a local testnet node:

```bash
anvil
```

Deploy locally to our anvil node(RPC_URL=http://localhost:8545):

```bash
# Run the hardhat deploy script to deploy the contracts to the local node
npm run deploy-locally
```

Then run the backend services to support the fuzzing:

```bash
npm run orchestrator:dev
npm run oracle:dev
```

You might need to generate remappings for the contracts, you can do this by running:

```bash
forge remappings > remappings.txt
```

Then to run the fuzzing and invariant tests run:

There may be some configuration required, be sure to check your anvil node logs to see any error messages that might be triggered by the orchestrator. For example you will need to give grant permission to the orchestrator and to the operators/signing keys of the validator nodes.

For these steps, you will need to use Foundry's`cast` command.

You can use `cast call`to simulate a call without actually sending it to the Anvil node.

You will use `cast send` to actually send your commands to the anvil node once you are sure you'd like to execute them.

```bash
forge test -vvvvvv --rpc-url http://localhost:8545
```
