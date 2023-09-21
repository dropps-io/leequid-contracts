const { ethers } = require("hardhat");
const { expect } = require("chai");
const { getTestDepositData } = require("./utils");

describe("StakedLyxToken contract", function () {
  const protocolFee = 0; // 0%

  let Oracles, oracles;
  let Rewards, rewards;
  let StakedLyxToken, stakedLyxToken;
  let Pool, pool;
  let PoolValidators, poolValidators;
  let MerkleDistributor, merkleDistributor;
  let FeesEscrow, feesEscrow;
  let DepositContract, beaconDepositMock;
  let admin, operator, user1, user2, chain, proxyOwner;

  before(async function () {
    Oracles = await ethers.getContractFactory("Oracles");
    Rewards = await ethers.getContractFactory("Rewards");
    StakedLyxToken = await ethers.getContractFactory("StakedLyxToken");
    Pool = await ethers.getContractFactory("Pool");
    PoolValidators = await ethers.getContractFactory("PoolValidators");
    MerkleDistributor = await ethers.getContractFactory("MerkleDistributor");
    FeesEscrow = await ethers.getContractFactory("FeesEscrow");
    DepositContract = await ethers.getContractFactory("DepositContract");
    [admin, operator, user1, user2, chain, proxyOwner] = await ethers.getSigners();
  });

  beforeEach(async function () {
    const AdminUpgradeabilityProxy = await ethers.getContractFactory("AdminUpgradeabilityProxy");

    const oraclesImplementation = await Oracles.deploy();
    const rewardsImplementation = await Rewards.deploy();
    const stakedLyxTokenImplementation = await StakedLyxToken.deploy();
    const poolImplementation = await Pool.deploy();
    const poolValidatorsImplementation = await PoolValidators.deploy();
    const merkleDistributorImplementation = await MerkleDistributor.deploy();
    beaconDepositMock = await DepositContract.deploy();

    const rewardsProxy = await AdminUpgradeabilityProxy.deploy(
      rewardsImplementation.address,
      proxyOwner.address,
      "0x"
    );
    const stakedLyxTokenProxy = await AdminUpgradeabilityProxy.deploy(
      stakedLyxTokenImplementation.address,
      proxyOwner.address,
      "0x"
    );
    const oraclesProxy = await AdminUpgradeabilityProxy.deploy(
      oraclesImplementation.address,
      proxyOwner.address,
      "0x"
    );
    const poolProxy = await AdminUpgradeabilityProxy.deploy(
      poolImplementation.address,
      proxyOwner.address,
      "0x"
    );
    const poolValidatorsProxy = await AdminUpgradeabilityProxy.deploy(
      poolValidatorsImplementation.address,
      proxyOwner.address,
      "0x"
    );
    const merkleDistributorProxy = await AdminUpgradeabilityProxy.deploy(
      merkleDistributorImplementation.address,
      proxyOwner.address,
      "0x"
    );

    oracles = Oracles.attach(oraclesProxy.address);
    rewards = Rewards.attach(rewardsProxy.address);
    stakedLyxToken = StakedLyxToken.attach(stakedLyxTokenProxy.address);
    pool = Pool.attach(poolProxy.address);
    poolValidators = PoolValidators.attach(poolValidatorsProxy.address);
    merkleDistributor = MerkleDistributor.attach(merkleDistributorProxy.address);

    await rewards.deployed();
    await stakedLyxToken.deployed();
    await oracles.deployed();
    await pool.deployed();
    await poolValidators.deployed();
    await merkleDistributor.deployed();

    feesEscrow = await FeesEscrow.deploy(rewards.address);
    await feesEscrow.deployed();

    await oracles.initialize(
      admin.address,
      rewards.address,
      stakedLyxToken.address,
      pool.address,
      poolValidators.address,
      merkleDistributor.address
    );

    await rewards.initialize(
      admin.address,
      stakedLyxToken.address,
      oracles.address,
      admin.address,
      (protocolFee * 10000).toString(),
      merkleDistributor.address,
      feesEscrow.address,
      pool.address
    );

    await stakedLyxToken
      .connect(admin)
      .initialize(admin.address, admin.address, admin.address, rewards.address);

    await pool
      .connect(admin)
      .initialize(
        admin.address,
        stakedLyxToken.address,
        rewards.address,
        poolValidators.address,
        oracles.address,
        getTestDepositData(operator.address)[0].withdrawalCredentials,
        beaconDepositMock.address,
        ethers.utils.parseEther("9999999999999999999999999999999"),
        "500"
      );

    await poolValidators.connect(admin).initialize(admin.address, pool.address, oracles.address);

    await merkleDistributor
      .connect(admin)
      .initialize(admin.address, rewards.address, oracles.address);
  });

  describe("unstake", function () {
    it("should revert if unstaking is in progress", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("32"), true, "0x");
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("32"));
      await stakedLyxToken.connect(admin).setUnstakeProcessing();
      await expect(
        stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("StakedLyxToken: unstaking in progress");
    });

    it("should revert if amount is zero", async function () {
      await expect(stakedLyxToken.connect(user1).unstake(0)).to.be.revertedWith(
        "StakedLyxToken: amount must be greater than zero"
      );
    });

    it("should revert if user has insufficient balance", async function () {
      await expect(
        stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("StakedLyxToken: insufficient balance");
    });

    it("should revert if contract paused", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("32"), true, "0x");
      const unstakeAmount = ethers.utils.parseEther("16");

      await stakedLyxToken.connect(admin).pause();
      await expect(stakedLyxToken.connect(user1).unstake(unstakeAmount)).to.be.revertedWith(
        "Pausable: paused"
      );
    });

    it("should create a new unstake request and update user balance", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("32"), true, "0x");
      const userBalanceBefore = await stakedLyxToken.balanceOf(user1.address);
      const unstakeAmount = ethers.utils.parseEther("16");

      const tx = await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const userBalanceAfter = await stakedLyxToken.balanceOf(user1.address);

      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(unstakeAmount));

      await expect(tx)
        .to.emit(stakedLyxToken, "NewUnstakeRequest")
        .withArgs(1, user1.address, unstakeAmount, unstakeAmount);
    });

    it("should update total pending unstake and total deposits", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("32"), true, "0x");
      const totalDepositsBefore = await stakedLyxToken.totalDeposits();
      const unstakeAmount = ethers.utils.parseEther("16");

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const totalPendingUnstakeAfter = await stakedLyxToken.totalPendingUnstake();
      const totalDepositsAfter = await stakedLyxToken.totalDeposits();

      expect(totalPendingUnstakeAfter).to.equal(unstakeAmount);
      expect(totalDepositsAfter).to.equal(totalDepositsBefore.sub(unstakeAmount));
    });

    it("should update distributor principal if rewards are disabled for user", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("32"), true, "0x");
      const unstakeAmount = ethers.utils.parseEther("16");

      await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);

      const distributorPrincipalBefore = await stakedLyxToken.distributorPrincipal();

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);

      const distributorPrincipalAfter = await stakedLyxToken.distributorPrincipal();

      expect(distributorPrincipalAfter).to.equal(distributorPrincipalBefore.sub(unstakeAmount));
    });

    it("should not update distributor principal if rewards are enabled for user", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("32"), true, "0x");
      const distributorPrincipalBefore = await stakedLyxToken.distributorPrincipal();
      const unstakeAmount = ethers.utils.parseEther("16");

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const distributorPrincipalAfter = await stakedLyxToken.distributorPrincipal();

      expect(distributorPrincipalAfter).to.equal(distributorPrincipalBefore);
    });
  });

  describe("matchUnstake", function () {
    beforeEach(async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("32"), true, "0x");
      await stakedLyxToken
        .connect(admin)
        .mint(user2.address, ethers.utils.parseEther("32"), true, "0x");
    });

    it("should revert if not called by the pool contract", async function () {
      await expect(
        stakedLyxToken.connect(user1).matchUnstake(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("StakedLyxToken: access denied");
    });

    it("should revert if unstaking is in progress", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("32"), true, "0x");
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("32"));
      await stakedLyxToken.connect(admin).setUnstakeProcessing();
      await expect(
        stakedLyxToken.connect(admin).matchUnstake(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("StakedLyxToken: unstaking in progress");
    });

    it("should return zero if there are no pending unstake requests", async function () {
      const amountMatched = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(ethers.utils.parseEther("1"));
      expect(amountMatched).to.equal(0);
    });

    it("should match the full unstake amount if there are sufficient pending unstake requests", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const amountMatched = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(unstakeAmount);
      expect(amountMatched).to.equal(unstakeAmount);
    });

    it("should match partial unstake amount if there are insufficient pending unstake requests", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const amountToMatch = ethers.utils.parseEther("24");
      // Call Static to get the amount that will be matched
      const amountMatched = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(amountToMatch);
      // Then normal call to update state
      await stakedLyxToken.connect(admin).matchUnstake(amountToMatch);
      const pendingUnstake = await stakedLyxToken.totalPendingUnstake();
      const unstakeRequestCurrentIndex = await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(pendingUnstake).to.equal(unstakeAmount.sub(amountMatched));
      expect(amountMatched).to.equal(unstakeAmount);
      expect(unstakeRequestCurrentIndex).to.equal(1);
    });

    it("should remain latest index if all unstakes matched", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user2).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      const unstakeRequestCurrentIndex = await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(unstakeRequestCurrentIndex).to.equal(1);
    });

    it("should go to next current index if possible and exact match on unstake value", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(user2).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      const unstakeRequestCurrentIndex = await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(unstakeRequestCurrentIndex).to.equal(2);
    });

    it("should have correct input for complex case", async function () {
      await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("14"));
      await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("14"));
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("3"));
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("21"));

      // First call static to get the matched amount
      let matchedAmount = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(ethers.utils.parseEther("3"));
      // Then call normal to update state
      await stakedLyxToken.connect(admin).matchUnstake(ethers.utils.parseEther("3"));

      let unstakeRequestCurrentIndex = await stakedLyxToken.unstakeRequestCurrentIndex();
      let totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      let unstakeRequest = await stakedLyxToken.unstakeRequest(1);

      expect(unstakeRequestCurrentIndex).to.equal(1);
      expect(unstakeRequest.amountFilled).to.equal(ethers.utils.parseEther("3"));
      expect(matchedAmount).to.equal(ethers.utils.parseEther("3"));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("49"));

      // First call static to get the matched amount
      matchedAmount = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(ethers.utils.parseEther("27"));
      // Then call normal to update state
      await stakedLyxToken.connect(admin).matchUnstake(ethers.utils.parseEther("27"));

      unstakeRequestCurrentIndex = await stakedLyxToken.unstakeRequestCurrentIndex();
      totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      unstakeRequest = await stakedLyxToken.unstakeRequest(3);

      expect(unstakeRequestCurrentIndex).to.equal(3);
      expect(unstakeRequest.amountFilled).to.equal(ethers.utils.parseEther("2"));
      expect(matchedAmount).to.equal(ethers.utils.parseEther("27"));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("22"));

      // First call static to get the matched amount
      matchedAmount = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(ethers.utils.parseEther("102"));
      // Then call normal to update state
      await stakedLyxToken.connect(admin).matchUnstake(ethers.utils.parseEther("102"));

      unstakeRequestCurrentIndex = await stakedLyxToken.unstakeRequestCurrentIndex();
      totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      unstakeRequest = await stakedLyxToken.unstakeRequest(4);

      expect(unstakeRequestCurrentIndex).to.equal(4);
      expect(unstakeRequest.amountFilled).to.equal(ethers.utils.parseEther("21"));
      expect(matchedAmount).to.equal(ethers.utils.parseEther("22"));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("0"));
    });

    it("should update totalPendingUnstake and unstakeRequestCurrentIndex properly", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(user2).unstake(unstakeAmount);

      const totalPendingUnstakeBefore = await stakedLyxToken.totalPendingUnstake();

      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      let totalPendingUnstakeAfter = await stakedLyxToken.totalPendingUnstake();
      let unstakeRequestCurrentIndexAfter = await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(totalPendingUnstakeAfter).to.equal(totalPendingUnstakeBefore.sub(unstakeAmount));
      expect(unstakeRequestCurrentIndexAfter).to.equal(2);

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      totalPendingUnstakeAfter = await stakedLyxToken.totalPendingUnstake();
      unstakeRequestCurrentIndexAfter = await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(totalPendingUnstakeAfter).to.equal(unstakeAmount);
      expect(unstakeRequestCurrentIndexAfter).to.equal(3);
    });

    it("should update the amountFilled of unstake requests properly", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(user2).unstake(unstakeAmount);

      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      const request1 = await stakedLyxToken.unstakeRequest(1);
      const request2 = await stakedLyxToken.unstakeRequest(2);

      expect(request1.amountFilled).to.equal(unstakeAmount);
      expect(request2.amountFilled).to.equal(0);
    });
  });

  describe("setUnstakeProcessing", function () {
    it("should revert if not called by admin", async function () {
      await expect(stakedLyxToken.connect(user1).setUnstakeProcessing()).to.be.revertedWith(
        "StakedLyxToken: access denied"
      );
    });

    it("should not be able to setUnstakeProcessing if less than 32LYX pending unstake", async function () {
      await expect(stakedLyxToken.connect(admin).setUnstakeProcessing()).to.be.revertedWith(
        "StakedLyxToken: insufficient pending unstake"
      );
      const unstakeProcessing = await stakedLyxToken.unstakeProcessing();
      expect(unstakeProcessing).to.equal(false);
    });

    it("should be able to setUnstakeProcessing if more than 32LYX pending unstake", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("42"), true, "0x");
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("42"));
      await expect(stakedLyxToken.connect(admin).setUnstakeProcessing())
        .to.emit(stakedLyxToken, "UnstakeReady")
        .withArgs(1);

      const unstakeProcessing = await stakedLyxToken.unstakeProcessing();
      expect(unstakeProcessing).to.equal(true);
    });

    it("should be able to setUnstakeProcessing if more than 96LYX pending unstake", async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("42"), true, "0x");
      await stakedLyxToken
        .connect(admin)
        .mint(user2.address, ethers.utils.parseEther("60"), true, "0x");
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("42"));
      await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("60"));
      await expect(stakedLyxToken.connect(admin).setUnstakeProcessing())
        .to.emit(stakedLyxToken, "UnstakeReady")
        .withArgs(3);

      const unstakeProcessing = await stakedLyxToken.unstakeProcessing();
      expect(unstakeProcessing).to.equal(true);
    });
  });

  describe("unstakeProcessed", function () {
    beforeEach(async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("64"), true, "0x");
      await stakedLyxToken
        .connect(admin)
        .mint(user2.address, ethers.utils.parseEther("64"), true, "0x");
    });

    it("should revert if not called by the pool contract", async function () {
      await expect(stakedLyxToken.connect(user1).unstakeProcessed(1)).to.be.revertedWith(
        "StakedLyxToken: access denied"
      );
    });

    it("should revert if the unstake request does not exist", async function () {
      await expect(stakedLyxToken.connect(admin).unstakeProcessed(1)).to.be.revertedWith(
        "StakedLyxToken: unstaking not in process"
      );
    });

    it("should process the unstakes", async function () {
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("32"));
      await stakedLyxToken.connect(admin).setUnstakeProcessing();
      await stakedLyxToken.connect(admin).unstakeProcessed(1);

      const unstakeRequest = await stakedLyxToken.unstakeRequest(1);
      const totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      const totalUnstaked = await stakedLyxToken.totalUnstaked();
      const unstakeProcessing = await stakedLyxToken.unstakeProcessing();

      expect(unstakeRequest.amountFilled).to.equal(ethers.utils.parseEther("32"));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("0"));
      expect(totalUnstaked).to.equal(ethers.utils.parseEther("32"));
      expect(unstakeProcessing).to.equal(false);
    });

    it("should emit the UnstakeProcessed event", async function () {
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("32"));
      await stakedLyxToken.connect(admin).setUnstakeProcessing();

      await expect(stakedLyxToken.connect(admin).unstakeProcessed(1))
        .to.emit(stakedLyxToken, "UnstakeProcessed")
        .withArgs(ethers.utils.parseEther("32"), ethers.utils.parseEther("0"));
    });

    it("should not change the user balance", async function () {
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("32"));
      await stakedLyxToken.connect(admin).setUnstakeProcessing();

      const userBalanceBefore = await stakedLyxToken.balanceOf(user1.address);
      await stakedLyxToken.connect(admin).unstakeProcessed(1);
      const userBalanceAfter = await stakedLyxToken.balanceOf(user1.address);

      expect(userBalanceAfter).to.equal(userBalanceBefore);
    });

    it("should have correct input for complex case", async function () {
      await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("14"));
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("29"));
      await stakedLyxToken.connect(user2).unstake(ethers.utils.parseEther("18"));
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther("3"));

      await stakedLyxToken.connect(admin).setUnstakeProcessing();
      await stakedLyxToken.connect(admin).unstakeProcessed(1);

      let unstakeRequestCurrentIndex = await stakedLyxToken.unstakeRequestCurrentIndex();
      let totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      let unstakeRequest = await stakedLyxToken.unstakeRequest(2);

      expect(unstakeRequestCurrentIndex).to.equal(2);
      expect(unstakeRequest.amountFilled).to.equal(ethers.utils.parseEther("18"));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("32"));

      await stakedLyxToken.connect(admin).unstakeProcessed(1);

      unstakeRequestCurrentIndex = await stakedLyxToken.unstakeRequestCurrentIndex();
      totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      unstakeRequest = await stakedLyxToken.unstakeRequest(4);

      expect(unstakeRequestCurrentIndex).to.equal(4);
      expect(unstakeRequest.amountFilled).to.equal(ethers.utils.parseEther("3"));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther("0"));
    });
  });

  describe("claimUnstake", function () {
    beforeEach(async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther("64"), true, "0x");
      const transaction = {
        to: rewards.address,
        value: ethers.utils.parseEther("9999"),
        gasLimit: "30000000",
      };
      await chain.sendTransaction(transaction);
    });

    it("should revert if sender not rewards", async function () {
      await expect(
        stakedLyxToken.connect(user1).claimUnstake(user1.address, [1])
      ).to.be.revertedWith("StakedLyxToken: access denied");
    });

    it("should revert if no unstake request exists for this index", async function () {
      await expect(rewards.connect(user1).claimUnstake([1])).to.be.revertedWith(
        "StakedLyxToken: unstake request not claimable"
      );
    });

    it("should revert if sender not the account associated with the unstake", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      await expect(rewards.connect(user2).claimUnstake([1])).to.be.revertedWith(
        "StakedLyxToken: unstake request not from this account"
      );
    });

    it("should revert if unstake request has already been claimed", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      await rewards.connect(user1).claimUnstake([1]);
      await expect(rewards.connect(user1).claimUnstake([1])).to.be.revertedWith(
        "StakedLyxToken: unstake request not claimable"
      );
    });

    it("should revert if unstake request has not been processed yet", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);

      await expect(rewards.connect(user1).claimUnstake([1])).to.be.revertedWith(
        "StakedLyxToken: unstake request not claimable"
      );

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      await expect(rewards.connect(user1).claimUnstake([2])).to.be.revertedWith(
        "StakedLyxToken: unstake request not claimable"
      );
    });

    it("should revert if unstake request has been processed partially", async function () {
      const unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(ethers.utils.parseEther("8"));

      await expect(rewards.connect(user1).claimUnstake([1])).to.be.revertedWith(
        "StakedLyxToken: unstake request not claimable"
      );

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      await expect(rewards.connect(user1).claimUnstake([2])).to.be.revertedWith(
        "StakedLyxToken: unstake request not claimable"
      );
    });

    it("should claim successful when conditions fulfilled", async function () {
      let unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      await rewards.connect(user1).claimUnstake([1]);

      let unstakeRequest = await stakedLyxToken.unstakeRequest(1);

      expect(unstakeRequest.claimed).to.equal(true);

      unstakeAmount = ethers.utils.parseEther("22");

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      await rewards.connect(user1).claimUnstake([2]);

      unstakeRequest = await stakedLyxToken.unstakeRequest(2);

      expect(unstakeRequest.claimed).to.equal(true);
    });

    it("should claim successful multiple when conditions fulfilled", async function () {
      let unstakeAmount = ethers.utils.parseEther("16");
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(ethers.utils.parseEther("45"));

      await await rewards.connect(user1).claimUnstake([1, 2]);

      const unstakeRequest = await stakedLyxToken.unstakeRequest(1);
      const unstakeRequest2 = await stakedLyxToken.unstakeRequest(2);

      expect(unstakeRequest.claimed).to.equal(true);
      expect(unstakeRequest2.claimed).to.equal(true);
    });
  });
});
