const { logMessage } = require("./logging");
const sleep = (ms, debug) => {
  logMessage(`⏳ ${ms / 1000} s`, debug);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports = { sleep };
