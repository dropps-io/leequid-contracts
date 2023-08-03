const { resetNetwork } = require("../../utils/reset-network");
const { resetMocks } = require("../../utils/set-consensus-mock");

const afterTest = async () => {
  await resetNetwork(true);
  await resetMocks();
};

module.exports = { afterTest };
