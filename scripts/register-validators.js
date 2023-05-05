const { defaultAbiCoder, hexlify, keccak256 } = require('ethers/lib/utils');

const ethers = require('ethers');
const oraclesArtifacts = require('../artifacts/contracts/Oracles.sol/Oracles.json');
const Web3 = require('web3');
require('dotenv').config();

async function registerValidators(
  depositData,
  merkleProofs,
  validatorsDepositRoot,
  contractAddress
) {
  // Create a new ethers.js provider using the default network (mainnet)
  const provider = ethers.getDefaultProvider(
    'https://rpc.testnet.lukso.network'
  );

  // Create a new wallet using the specified private key
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Create a new instance of the PoolValidators contract
  const contract = new ethers.Contract(
    contractAddress,
    oraclesArtifacts.abi,
    wallet
  );

  let nonce = await contract.currentValidatorsNonce();
  console.log(nonce);
  let encoded = defaultAbiCoder.encode(
    [
      'uint256',
      'tuple(address operator,bytes32 withdrawalCredentials,bytes32 depositDataRoot,bytes publicKey,bytes signature)[]',
      'bytes32',
    ],
    [nonce.toString(), depositData, validatorsDepositRoot]
  );
  let candidateId = hexlify(keccak256(encoded));

  console.log(`candidateId: ${candidateId}`);

  const web3 = new Web3();
  web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY);
  web3.eth.defaultAccount = web3.eth.accounts.wallet[0].address;

  const signatures = [
    await web3.eth.sign(candidateId, web3.eth.defaultAccount),
  ];

  // Submit the deposit data
  const tx = await contract.registerValidators(
    depositData,
    merkleProofs,
    validatorsDepositRoot,
    signatures,
    { gasLimit: 500000, gasPrice: '0x59682F00' } // set gas limit to 500,000 wei
  );
  await tx.wait();
  console.log('Transaction complete:', tx.hash);
}

module.exports = { registerValidators };
