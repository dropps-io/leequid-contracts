const oraclesAddresses = ["0xB4e765E6A65e4e84c0a2247E5A893e50A4fC05F1"];
const orchestratorAddress = "0xB4e765E6A65e4e84c0a2247E5A893e50A4fC05F1";
const depositDataMerkleRoot = "0x56a58f0e8386d48b41a9092de0a3c2c6fe117ee046089234ea38bd6013192da6";
const oraclesCronTimeoutInMs = 1000 * 30; // 30 seconds
const oraclesRegisterValidatorsTimeoutInMs = 1000 * 30; // 30 seconds
const unstakeBlockOffset = 24;
const beaconMockPort = 3500;

module.exports = {
  oraclesAddresses,
  depositDataMerkleRoot,
  oraclesRegisterValidatorsTimeoutInMs,
  oraclesCronTimeoutInMs,
  orchestratorAddress,
  unstakeBlockOffset,
  beaconMockPort,
};
