const http = require("http");
const { beaconMockPort } = require("../config");

const setValidatorsMock = (mockData) => {
  const options = {
    hostname: "localhost",
    port: beaconMockPort,
    path: "/set-mock/validators",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, () => {});

  req.write(JSON.stringify(mockData));
  req.end();
};

const setFinalityCheckpointsMock = (mockData) => {
  const options = {
    hostname: "localhost",
    port: beaconMockPort,
    path: "/set-mock/finality_checkpoints",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, () => {});

  req.write(JSON.stringify(mockData));
  req.end();
};

const setExpectedWithdrawalsMock = (mockData, state) => {
  const options = {
    hostname: "localhost",
    port: beaconMockPort,
    path: "/set-mock/expected_withdrawals/" + state,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, () => {});

  req.write(JSON.stringify(mockData));
  req.end();
};

const resetMocks = () => {
  const options = {
    hostname: "localhost",
    port: beaconMockPort,
    path: "/reset",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, () => {});

  req.end();
};

module.exports = {
  setExpectedWithdrawalsMock,
  setFinalityCheckpointsMock,
  setValidatorsMock,
  resetMocks,
};
