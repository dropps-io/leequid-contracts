const http = require("http");
const { consensusMockPort } = require("../config");

const setValidatorMock = (mockData) => {
  const options = {
    hostname: "localhost",
    port: consensusMockPort,
    path: "/set-mock/validator",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, () => {});

  req.write(JSON.stringify(mockData));
  req.end();
};

const setValidatorWithdrawalCredentialsMock = (mockData) => {
  const options = {
    hostname: "localhost",
    port: consensusMockPort,
    path: "/set-mock/validator/withdrawalCredentials",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, () => {});

  req.write(JSON.stringify(mockData));
  req.end();
};

module.exports = { setValidatorMock, setValidatorWithdrawalCredentialsMock };
