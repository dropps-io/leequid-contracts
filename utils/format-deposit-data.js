const formatGeneratedDepositData = (generatedDepositData) => {
  return generatedDepositData.map((data) => {
    return {
      publicKey: '0x' + data.pubkey,
      signature: '0x' + data.signature,
      depositDataRoot: '0x' + data.deposit_data_root,
      withdrawalCredentials: '0x' + data.withdrawal_credentials,
    };
  });
};

module.exports = { formatGeneratedDepositData };
