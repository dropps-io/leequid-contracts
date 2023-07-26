const { resetNetwork } = require("../../utils/reset-network");
const { deployLocalContracts } = require("../../deploy-contracts");
const { initProtocol } = require("../../utils/init-protocol");

const beforeTest = async () => {
  await resetNetwork(true);
  await deployLocalContracts(true);
  await initProtocol(true);
};

module.exports = { beforeTest };
