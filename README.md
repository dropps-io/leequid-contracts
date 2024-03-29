# Leequid smart contracts

[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/dropps_io.svg?style=social&label=Follow%20%40dropps_io)](https://twitter.com/dropps_io)
[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/leequid_io.svg?style=social&label=Follow%20%40leequid_io)](https://twitter.com/leequid_io)
[![Discord](https://user-images.githubusercontent.com/7288322/34471967-1df7808a-efbb-11e7-9088-ed0b04151291.png)](https://discord.com/invite/nzn3BGHyYH)

The [Leequid](https://leequid.io/) smart contracts for liquid non-custodial LUKSO staking.

<b>This repository is a fork from the [StakeWise smart contracts]('https://github.com/stakewise/contracts') for
[LUKSO LSPs]('https://github.com/lukso-network/lsp-smart-contracts) compatibility.</b>

# Audits

All audit reports are presented in the [audits folder](https://github.com/stakewise/contracts/tree/master/audits)

## Documentation

Refer to the [official LEEQUID documentation](https://docs.leequid.io) for a detailed description of the protocol.

![contracts_infra.png](docs%2Fdiagrams%2Fcontracts_infra.png)

#### Pool

The Pool contract is an entry point for deposits into the StakeWise Pool. This contract stores LYX collected from the users before it is sent to the LYXE Validator Registration Contract.

#### StakedLyxToken

The StakedEthToken is a LSP7 contract. It reflects the deposits made by the stakers in the form of sLYX tokens. The tokens are mapped 1 to 1 to LYX.
The total supply of sLYX is the sum of all the Leequid Pool's validators' effective balances, plus an additional amount of up to (32 LYX - 1 Wei) LYX awaiting inclusion into a new validator.


#### Rewards

The Rewards is reflects the rewards accumulated by the stakers. 
It is the contract where user can cash-out/withdraw their rewards, and claim their unstakes.

#### Oracle

Oracles contract stores accounts responsible for submitting or updating values based on the off-chain data.

## Development

**NB!** You would have to define the `initialize` function for the contracts that don't have it when deploying for the first time.

1. Install dependencies:

   ```shell script
   yarn install
   ```

2. Compile optimized contracts:

   ```shell script
   yarn compile --optimizer
   ```

3. Create a `.env` file in your project directory. You can use the provided `.env.template` file as a starting point. Modify the values in the `.env` file, including the private key and any other required variables.
4. (Optional) Update network parameters in `hardhat.config.js` if required. Learn more at [Hardhat config options](https://hardhat.org/config/).
5. Change [settings](./deployments/settings.js) if needed. This contains the proxy contract addresses and other settings.
6. Deploy StakeWise contracts to the selected network:

   ```shell script
   yarn deploy-contracts --network rinkeby
   ```

## Testing locally

See [Local Tests](./docs/local_tests.md) & [Integration Tests](./docs/integration_tests.md) for more information.

## Contributing

Development of the project happens in the open on GitHub, and we are grateful to the community for contributing bug fixes and improvements.

## Contact us

- [Discord](https://discord.com/invite/nzn3BGHyYH)
- [Twitter](https://twitter.com/leequid_io)

### License

The project is [GNU AGPL v3](./LICENSE).
