const { hexlify, keccak256, defaultAbiCoder } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { generateDepositDataMerkle } = require("../utils/generate-merkle");

async function registerValidators(
  depositData,
  oracles,
  poolValidators,
  beaconDepositMock,
  oracleAccounts,
  admin,
  operator,
  orchestrator
) {
  const validatorsDepositRoot = await beaconDepositMock.get_deposit_root();
  const merkle = generateDepositDataMerkle(depositData);

  await poolValidators
    .connect(admin)
    .addOperator(
      operator.address,
      merkle.depositDataMerkleRoot,
      merkle.depositDataMerkleProofsString
    );

  await poolValidators.connect(operator).commitOperator();

  // Calculate the nonce and the message to sign
  const nonce = await oracles.currentValidatorsNonce();
  const signatures = await generateSignaturesForRegisterValidators(
    oracleAccounts,
    nonce.toString(),
    depositData,
    validatorsDepositRoot
  );

  // Call registerValidators with the signatures
  return oracles
    .connect(orchestrator)
    .registerValidators(
      depositData,
      merkle.depositDataMerkleProofNodes,
      validatorsDepositRoot,
      signatures
    );
}

const generateSignaturesForRegisterValidators = async function (
  signers,
  nonce,
  depositData,
  validatorsDepositRoot
) {
  let encoded = defaultAbiCoder.encode(
    [
      "uint256",
      "tuple(address operator,bytes32 withdrawalCredentials,bytes32 depositDataRoot,bytes publicKey,bytes signature)[]",
      "bytes32",
    ],
    [nonce, depositData, validatorsDepositRoot]
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(await signers[i].signMessage(ethers.utils.arrayify(candidateId)));
  }
  return signatures;
};

const generateSignaturesForSubmitRewards = async function (
  signers,
  nonce,
  totalRewards,
  activatedValidators,
  exitedValidators
) {
  let encoded = defaultAbiCoder.encode(
    ["uint256", "uint256", "uint256", "uint256"],
    [nonce, activatedValidators, exitedValidators, totalRewards]
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(await signers[i].signMessage(ethers.utils.arrayify(candidateId)));
  }
  return signatures;
};

const generateSignaturesForSetUnstakeProcessing = async function (signers, nonce) {
  let encoded = defaultAbiCoder.encode(["uint256", "string"], [nonce, "setUnstakeProcessing"]);
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(await signers[i].signMessage(ethers.utils.arrayify(candidateId)));
  }
  return signatures;
};

const generateSignaturesForSubmitUnstakeAmount = async function (signers, nonce, unstakeAmount) {
  let encoded = defaultAbiCoder.encode(
    ["uint256", "uint256", "string"],
    [nonce, unstakeAmount, "submitUnstakeAmount"]
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(await signers[i].signMessage(ethers.utils.arrayify(candidateId)));
  }
  return signatures;
};

const generateSignaturesForSubmitMerkleRoot = async function (
  signers,
  nonce,
  merkleRoot,
  merkleProofs
) {
  let encoded = defaultAbiCoder.encode(
    ["uint256", "string", "bytes32"],
    [nonce, merkleProofs, merkleRoot]
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(await signers[i].signMessage(ethers.utils.arrayify(candidateId)));
  }
  return signatures;
};

const getTestDepositData = function (operatorAddress) {
  return [
    {
      operator: operatorAddress,
      publicKey:
        "0xb793d99ecfa2d9161ba94297085f09beb9f3bbebea65a7d02bc3cc9777a7c3822947369cb441c90181657c2e37d10568",
      withdrawalCredentials: "0x010000000000000000000000d692ba892a902810a2ee3fa41c1d8dcd652d47ab",
      signature:
        "0x9719cd1253fefa8665a8d5ce19d010991c0799536029f0b6e51fc4c9c73f9c12c9c0f354e30f19d5639af65db053e0c50eead303fcf63f985e7eaaa8aeb524638ebfe407de4b331793086c4efe9f108ce6b6a138dca87ae146d7acce3b561c21",
      depositDataRoot: "0xe852d0f1aaa289f8b9334e2c4a69c84bf0ede128b2a536611c12f72667e1194b",
    },
    {
      operator: operatorAddress,
      publicKey:
        "0x89c76fb58cf17cb012ec7ea3879707d5040e73fa9d16132ce075152f305406b9db80a833b742258c027816381d5b6f28",
      withdrawalCredentials: "0x010000000000000000000000d692ba892a902810a2ee3fa41c1d8dcd652d47ab",
      signature:
        "0xa8a6b651824d26a75aa0211bbf51a49d6d287e8b4a482726e9a7e28f7e746c457e336e743b469b70ecd8cfc7f48e7dfc0930d674205efb3bda1e08313c1e100f24cf00d6ec38e2666c8da2103aea815590dc2b8835dc5182e7ced2df9f73c72b",
      depositDataRoot: "0x99ae12c6380e6c65894b0e36cb42104bdf90c9fb7c307d47cb13a926e517247c",
    },
    {
      operator: operatorAddress,
      publicKey:
        "0xa171371afb5f93c8572064815414d227d7392fe31ca8b426e2cc50bbe36e76159590662e0b6fbc0af6d85cc60e45963d",
      withdrawalCredentials: "0x010000000000000000000000d692ba892a902810a2ee3fa41c1d8dcd652d47ab",
      signature:
        "0xa5556d309a4fdf673585ba1fa649003d266f9f75daa7a6caa975448a4ffbdda64da7f2ad5189e6afef9b49ba7b8cf031067a0f127707bb1706852084d6e919502094a6e43c214ce65b37637911b759ae0ff32559010dcfc8ef35eaae5462094c",
      depositDataRoot: "0x207952471f66fb731a31f70f2b923fd07802fde7914c56f65cb64ab046cf980d",
    },
  ];
};

module.exports = {
  registerValidators,
  getTestDepositData,
  generateSignaturesForRegisterValidators,
  generateSignaturesForSubmitRewards,
  generateSignaturesForSubmitUnstakeAmount,
  generateSignaturesForSetUnstakeProcessing,
  generateSignaturesForSubmitMerkleRoot,
};
