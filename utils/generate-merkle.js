const { MerkleTree } = require('merkletreejs');
const { defaultAbiCoder, hexlify, keccak256 } = require('ethers/lib/utils');

function generateDepositDataMerkle(depositData) {
  const leafNodes = depositData.map((data) => {
    const encodedData = defaultAbiCoder.encode(
      ['bytes', 'bytes32', 'bytes', 'bytes32'],
      [
        data.publicKey,
        data.withdrawalCredentials,
        data.signature,
        data.depositDataRoot,
      ]
    );

    const node = hexlify(keccak256(encodedData));
    return Buffer.from(node.slice(2), 'hex');
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

  return {
    depositDataMerkleRoot: root,
    depositDataMerkleProofNodes: proofNodes2D,
    depositDataMerkleProofsString: '0x' + depositDataMerkleProofs,
  };
}

module.exports = { generateDepositDataMerkle };
