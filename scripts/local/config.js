const oraclesAddresses = [
  "0xC4406cC10c6A845Ad645294B3dd93767844B27A3",
  "0xef430e46bDE5c4Ad71eF09493D962dDD6695dE09",
  "0x3e232dec5E872b116044b2059406aC0Ba57E0a63",
  "0x8cEfB05ebFa2d64baa2B06390257c77B287C3a71",
];
const orchestratorAddress = "0xEb7A67d9460365862f0ce2e6A5309657E5f58444";
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
