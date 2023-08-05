const { sleep } = require("./sleep");
const { incrementBlocks } = require("./increment-blocks");
const { logMessage } = require("./logging");

async function retry(fn, debug, retries = 2, delay = 5000) {
  try {
    await incrementBlocks(2, debug);
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    else {
      logMessage(`Retrying after error`, debug);
      await sleep(delay);
      return retry(fn, debug, retries - 1, delay); // Include debug in the recursive call
    }
  }
}

module.exports = { retry };
