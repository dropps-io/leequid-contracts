const { expect } = require('chai');
const hre = require('hardhat');
const { hexlify, keccak256, defaultAbiCoder } = require('ethers/lib/utils');
const {
  BN,
  ether,
  expectEvent,
  balance,
} = require('@openzeppelin/test-helpers');
const { contracts } = require('../deployments/settings');
const { ethers } = require('hardhat');
const { generateDepositDataMerkle } = require('../utils/generate-merkle');

const iDepositContract = artifacts.require('IDepositContract');

function getDepositAmount({ min = new BN('1'), max = ether('1000') } = {}) {
  return ether(Math.random().toFixed(8))
    .mul(max.sub(min))
    .div(ether('1'))
    .add(min);
}

async function checkValidatorRegistered({
  transaction,
  pubKey,
  signature,
  withdrawalCredentials,
  validatorDepositAmount = ether('32'),
}) {
  // Check VRC record created
  await expectEvent.inTransaction(
    transaction,
    iDepositContract,
    'DepositEvent',
    {
      pubkey: pubKey,
      withdrawal_credentials: withdrawalCredentials,
      amount: web3.utils.bytesToHex(
        new BN(web3.utils.fromWei(validatorDepositAmount, 'gwei')).toArray(
          'le',
          8
        )
      ),
      signature: signature,
    }
  );
}

async function checkStakedEthToken({
  stakedEthToken,
  totalSupply,
  account,
  balance,
}) {
  if (totalSupply != null) {
    expect(await stakedEthToken.totalSupply()).to.be.bignumber.equal(
      totalSupply
    );
  }

  if (account != null && balance != null) {
    expect(await stakedEthToken.balanceOf(account)).to.be.bignumber.equal(
      balance
    );
  }
}

async function checkRewardEthToken({
  rewardEthToken,
  totalSupply,
  account,
  balance,
}) {
  if (totalSupply != null) {
    expect(await rewardEthToken.totalSupply()).to.be.bignumber.equal(
      totalSupply
    );
  }

  if (account != null && balance != null) {
    expect(await rewardEthToken.balanceOf(account)).to.be.bignumber.equal(
      balance
    );
  }
}

async function setActivatedValidators({
  rewardEthToken,
  oracles,
  oracleAccounts,
  pool,
  activatedValidators,
}) {
  let prevActivatedValidators = await pool.activatedValidators();
  if (prevActivatedValidators.eq(activatedValidators)) {
    return;
  }

  let totalRewards = await rewardEthToken.totalRewards();
  let nonce = await oracles.currentRewardsNonce();

  let encoded = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256'],
    [nonce.toString(), activatedValidators.toString(), totalRewards.toString()]
  );
  let candidateId = hexlify(keccak256(encoded));

  // prepare signatures
  let signatures = [];
  for (let i = 0; i < oracleAccounts.length; i++) {
    await impersonateAccount(oracleAccounts[i]);
    let signature = await web3.eth.sign(candidateId, oracleAccounts[i]);
    signatures.push(signature);
  }

  // update activated validators
  let receipt = await oracles.submitRewards(
    totalRewards,
    activatedValidators,
    signatures,
    {
      from: oracleAccounts[0],
    }
  );

  expect(await pool.activatedValidators()).to.bignumber.equal(
    activatedValidators
  );

  return receipt;
}

async function setTotalRewards({
  rewardEthToken,
  oracles,
  oracleAccounts,
  pool,
  totalRewards,
}) {
  if ((await rewardEthToken.totalSupply()).eq(totalRewards)) {
    return;
  }
  // calculate candidate ID
  let activatedValidators = await pool.activatedValidators();
  let nonce = await oracles.currentRewardsNonce();
  let encoded = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256'],
    [nonce.toString(), activatedValidators.toString(), totalRewards.toString()]
  );
  let candidateId = hexlify(keccak256(encoded));

  // prepare signatures
  let signatures = [];
  for (let i = 0; i < oracleAccounts.length; i++) {
    await impersonateAccount(oracleAccounts[i]);
    let signature = await web3.eth.sign(candidateId, oracleAccounts[i]);
    signatures.push(signature);
  }
  let feesEscrowBalance = await balance.current(contracts.feesEscrow);

  // update total rewards
  let receipt = await oracles.submitRewards(
    totalRewards,
    activatedValidators,
    signatures,
    {
      from: oracleAccounts[0],
    }
  );
  expect(await rewardEthToken.totalSupply()).to.bignumber.equal(
    totalRewards.add(feesEscrowBalance)
  );

  return receipt;
}

async function setMerkleRoot({
  merkleDistributor,
  merkleRoot,
  merkleProofs,
  oracles,
  oracleAccounts,
}) {
  if ((await merkleDistributor.merkleRoot()) === merkleRoot) {
    return;
  }

  let nonce = await oracles.currentRewardsNonce();
  let encoded = defaultAbiCoder.encode(
    ['uint256', 'string', 'bytes32'],
    [nonce.toString(), merkleProofs, merkleRoot]
  );
  let candidateId = hexlify(keccak256(encoded));

  // prepare signatures
  let signatures = [];
  for (let i = 0; i < oracleAccounts.length; i++) {
    await impersonateAccount(oracleAccounts[i]);
    let signature = await web3.eth.sign(candidateId, oracleAccounts[i]);
    signatures.push(signature);
  }

  // update merkle root
  return oracles.submitMerkleRoot(merkleRoot, merkleProofs, signatures, {
    from: oracleAccounts[0],
  });
}

async function registerValidators(
  depositData,
  oracles,
  poolValidators,
  beaconDepositMock,
  oracleAccounts,
  admin,
  operator
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
    .connect(oracleAccounts[0])
    .registerValidators(
      depositData,
      merkle.depositDataMerkleProofNodes,
      validatorsDepositRoot,
      signatures
    );
}

async function impersonateAccount(account) {
  return hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [account],
  });
}

async function stopImpersonatingAccount(account) {
  return hre.network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [account],
  });
}

async function resetFork() {
  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: hre.config.networks.hardhat.forking.url,
          blockNumber: hre.config.networks.hardhat.forking.blockNumber,
        },
      },
    ],
  });
}

async function setupOracleAccounts({ admin, oracles, accounts }) {
  const totalOracles = (await oracles.oracleCount()).toNumber();

  // remove oracles
  for (let i = 0; i < totalOracles; i++) {
    let oldOracle = await oracles.getRoleMember(oracleRole, 0);
    await oracles.removeOracle(oldOracle, { from: admin });
  }

  // add oracles
  let oracleAccounts = [];
  for (let i = 0; i < totalOracles; i++) {
    let newOracle = accounts[i];
    await oracles.addOracle(newOracle, {
      from: admin,
    });
    oracleAccounts.push(newOracle);
  }

  return oracleAccounts;
}

const generateSignaturesForRegisterValidators = async function (
  signers,
  nonce,
  depositData,
  validatorsDepositRoot
) {
  let encoded = defaultAbiCoder.encode(
    [
      'uint256',
      'tuple(address operator,bytes32 withdrawalCredentials,bytes32 depositDataRoot,bytes publicKey,bytes signature)[]',
      'bytes32',
    ],
    [nonce, depositData, validatorsDepositRoot]
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(
      await signers[i].signMessage(ethers.utils.arrayify(candidateId))
    );
  }
  return signatures;
};

const generateSignaturesForSubmitRewards = async function (
  signers,
  nonce,
  totalRewards,
  activatedValidators
) {
  let encoded = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256'],
    [nonce, activatedValidators, totalRewards]
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(
      await signers[i].signMessage(ethers.utils.arrayify(candidateId))
    );
  }
  return signatures;
};

const generateSignaturesForSetUnstakeProcessing = async function (
  signers,
  nonce
) {
  let encoded = defaultAbiCoder.encode(
    ['uint256', 'string'],
    [nonce, 'setUnstakeProcessing']
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(
      await signers[i].signMessage(ethers.utils.arrayify(candidateId))
    );
  }
  return signatures;
};

const generateSignaturesForSubmitUnstakeAmount = async function (
  signers,
  nonce,
  unstakeAmount
) {
  let encoded = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'string'],
    [nonce, unstakeAmount, 'submitUnstakeAmount']
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(
      await signers[i].signMessage(ethers.utils.arrayify(candidateId))
    );
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
    ['uint256', 'string', 'bytes32'],
    [nonce, merkleProofs, merkleRoot]
  );
  let candidateId = hexlify(keccak256(encoded));

  const signatures = [];
  for (let i = 0; i < signers.length; i++) {
    signatures.push(
      await signers[i].signMessage(ethers.utils.arrayify(candidateId))
    );
  }
  return signatures;
};

const getTestDepositData = function (operatorAddress) {
  return [
    {
      operator: operatorAddress,
      publicKey:
        '0xb793d99ecfa2d9161ba94297085f09beb9f3bbebea65a7d02bc3cc9777a7c3822947369cb441c90181657c2e37d10568',
      withdrawalCredentials:
        '0x010000000000000000000000d692ba892a902810a2ee3fa41c1d8dcd652d47ab',
      signature:
        '0x9719cd1253fefa8665a8d5ce19d010991c0799536029f0b6e51fc4c9c73f9c12c9c0f354e30f19d5639af65db053e0c50eead303fcf63f985e7eaaa8aeb524638ebfe407de4b331793086c4efe9f108ce6b6a138dca87ae146d7acce3b561c21',
      depositDataRoot:
        '0xe852d0f1aaa289f8b9334e2c4a69c84bf0ede128b2a536611c12f72667e1194b',
    },
    {
      operator: operatorAddress,
      publicKey:
        '0x89c76fb58cf17cb012ec7ea3879707d5040e73fa9d16132ce075152f305406b9db80a833b742258c027816381d5b6f28',
      withdrawalCredentials:
        '0x010000000000000000000000d692ba892a902810a2ee3fa41c1d8dcd652d47ab',
      signature:
        '0xa8a6b651824d26a75aa0211bbf51a49d6d287e8b4a482726e9a7e28f7e746c457e336e743b469b70ecd8cfc7f48e7dfc0930d674205efb3bda1e08313c1e100f24cf00d6ec38e2666c8da2103aea815590dc2b8835dc5182e7ced2df9f73c72b',
      depositDataRoot:
        '0x99ae12c6380e6c65894b0e36cb42104bdf90c9fb7c307d47cb13a926e517247c',
    },
    {
      operator: operatorAddress,
      publicKey:
        '0xa171371afb5f93c8572064815414d227d7392fe31ca8b426e2cc50bbe36e76159590662e0b6fbc0af6d85cc60e45963d',
      withdrawalCredentials:
        '0x010000000000000000000000d692ba892a902810a2ee3fa41c1d8dcd652d47ab',
      signature:
        '0xa5556d309a4fdf673585ba1fa649003d266f9f75daa7a6caa975448a4ffbdda64da7f2ad5189e6afef9b49ba7b8cf031067a0f127707bb1706852084d6e919502094a6e43c214ce65b37637911b759ae0ff32559010dcfc8ef35eaae5462094c',
      depositDataRoot:
        '0x207952471f66fb731a31f70f2b923fd07802fde7914c56f65cb64ab046cf980d',
    },
  ];
};

module.exports = {
  checkValidatorRegistered,
  getDepositAmount,
  checkStakedEthToken,
  checkRewardEthToken,
  impersonateAccount,
  stopImpersonatingAccount,
  resetFork,
  setActivatedValidators,
  setTotalRewards,
  setMerkleRoot,
  setupOracleAccounts,
  registerValidators,
  getTestDepositData,
  generateSignaturesForRegisterValidators,
  generateSignaturesForSubmitRewards,
  generateSignaturesForSubmitUnstakeAmount,
  generateSignaturesForSetUnstakeProcessing,
  generateSignaturesForSubmitMerkleRoot,
};
