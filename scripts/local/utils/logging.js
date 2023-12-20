const logMessage = (message, debug) => {
  if (debug) {
    console.log(`${new Date().toISOString()} - ${message}`);
  }
};

module.exports = { logMessage };
