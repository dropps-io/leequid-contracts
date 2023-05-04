const { keccak256 } = require('js-sha3');
const { MerkleTree } = require('merkletreejs');
const { registerValidators } = require('./register-validators');

const depositData = [
  {
    operator: '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab',
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
    operator: '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab',
    publicKey:
      '0x89c76fb58cf17cb012ec7ea3879707d5040e73fa9d16132ce075152f305406b9db80a833b742258c027816381d5b6f28',
    withdrawalCredentials:
      '0x010000000000000000000000d692ba892a902810a2ee3fa41c1d8dcd652d47ab',
    signature:
      '0xa8a6b651824d26a75aa0211bbf51a49d6d287e8b4a482726e9a7e28f7e746c457e336e743b469b70ecd8cfc7f48e7dfc0930d674205efb3bda1e08313c1e100f24cf00d6ec38e2666c8da2103aea815590dc2b8835dc5182e7ced2df9f73c72b',
    depositDataRoot:
      '0x99ae12c6380e6c65894b0e36cb42104bdf90c9fb7c307d47cb13a926e517247c',
  },
];

const leafNodes = depositData.map((data) => {
  const node = keccak256(
    data.publicKey +
      data.withdrawalCredentials +
      data.signature +
      data.depositDataRoot
  );
  return Buffer.from(node, 'hex');
});

const merkleTree = new MerkleTree(leafNodes, keccak256, {
  sortLeaves: true,
  sortPairs: true,
});

const proofs = leafNodes.map((leaf) => merkleTree.getProof(leaf));
const proofNodes = proofs.map((proof) =>
  proof.map((node) => node.data.toString('hex')).join('')
);
const proofNodes2D = proofs.map((proof) =>
  proof.map((node) => '0x' + node.data.toString('hex'))
);
const depositDataMerkleProofs = proofNodes.join('');
const root = '0x' + merkleTree.getRoot().toString('hex');
console.log(`Merkle root: ${root}`);
console.log(`Merkle proof nodes: ${proofNodes}`);
console.log(`depositDataMerkleProofs: ${depositDataMerkleProofs}`);

registerValidators(
  depositData,
  proofNodes2D,
  '0x0000000000000000000000000000000000000000000000000000000000000000',
  '0x69177979FbdF06D0Fe3E71443BA6514b39A09a2c'
);

// console.log(`Merkle proof:`);
// console.log(
//   merkleTree.getProof(leafNodes[0]).map((x) => x.data.toString('hex'))
// );
