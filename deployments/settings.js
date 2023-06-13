let contracts, contractSettings;

// -- LUKSO TESTNET --
contracts = {
  oracles: '0x3fbda838D30354c9eCed17b1568f11Bba7dc7F20',
  pool: '0xC0bEee1133e332039dE494E51B02a7Cf8bDf37A9',
  poolValidators: '0x3157e5af102955Fb01349E19DF38C9c7dCBdd3C4',
  stakedLyxToken: '0x66712679875B99Cc73f567Fe63C564299D09812B',
  rewardsLyxToken: '0xAED7cD8d3105F4d6B4dDF99f619dCB2a26D0a900',
  vestingEscrowFactory: '0xbA91cdD484893c1f8F75DB55733ccaDcd0fE5f59',
  merkleDistributor: '0x66899DE87d70BDd02Fd87CD8090bD8827A8ACe31',
  feesEscrow: '0x859aC430475116A70E022860E44847bEB4ff8159',
  proxyAdmin: '0x0C92EC41A0Aba4F33B69dA6a931A7F74C309d143',
};

contractSettings = {
  admin: '0xD692Ba892a902810a2EE3fA41C1D8DcD652D47Ab',
};

module.exports = {
  contractSettings,
  contracts,
};
