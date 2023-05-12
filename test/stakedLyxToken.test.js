const { ethers } = require('hardhat');
const { expect } = require('chai');
const { getTestDepositData } = require('./utils');

describe('StakedLyxToken contract', function () {
  const protocolFee = 0; // 0%

  let Oracles, oracles;
  let RewardLyxToken, rewardLyxToken;
  let StakedLyxToken, stakedLyxToken;
  let Pool, pool;
  let PoolValidators, poolValidators;
  let MerkleDistributor, merkleDistributor;
  let FeesEscrow, feesEscrow;
  let DepositContract, beaconDepositMock;
  let admin, operator, user1, user2;

  before(async function () {
    Oracles = await ethers.getContractFactory('Oracles');
    RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
    StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
    Pool = await ethers.getContractFactory('Pool');
    PoolValidators = await ethers.getContractFactory('PoolValidators');
    MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    FeesEscrow = await ethers.getContractFactory('FeesEscrow');
    DepositContract = await ethers.getContractFactory('DepositContract');
    [admin, operator, user1, user2] = await ethers.getSigners();
  });

  beforeEach(async function () {
    oracles = await Oracles.deploy();
    rewardLyxToken = await RewardLyxToken.deploy();
    stakedLyxToken = await StakedLyxToken.deploy();
    pool = await Pool.deploy();
    poolValidators = await PoolValidators.deploy();
    merkleDistributor = await MerkleDistributor.deploy();
    beaconDepositMock = await DepositContract.deploy();
    feesEscrow = await FeesEscrow.deploy(pool.address, rewardLyxToken.address);
    await oracles.deployed();
    await rewardLyxToken.deployed();
    await stakedLyxToken.deployed();
    await pool.deployed();
    await poolValidators.deployed();
    await merkleDistributor.deployed();
    await feesEscrow.deployed();

    await oracles.initialize(
      admin.address,
      rewardLyxToken.address,
      stakedLyxToken.address,
      pool.address,
      poolValidators.address,
      merkleDistributor.address
    );

    await rewardLyxToken.initialize(
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
      .initialize(
        admin.address,
        admin.address,
        admin.address,
        rewardLyxToken.address
      );

    await pool
      .connect(admin)
      .initialize(
        admin.address,
        stakedLyxToken.address,
        rewardLyxToken.address,
        poolValidators.address,
        oracles.address,
        getTestDepositData(operator.address)[0].withdrawalCredentials,
        beaconDepositMock.address,
        ethers.utils.parseEther('9999999999999999999999999999999'),
        '500'
      );

    await poolValidators
      .connect(admin)
      .initialize(admin.address, pool.address, oracles.address);

    await merkleDistributor
      .connect(admin)
      .initialize(admin.address, rewardLyxToken.address, oracles.address);
  });

  describe('unstake', function () {
    it('should revert if unstaking is in progress', async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
      await stakedLyxToken
        .connect(user1)
        .unstake(ethers.utils.parseEther('32'));
      await stakedLyxToken.connect(admin).setUnstakeProcessing(1);
      await expect(
        stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther('1'))
      ).to.be.revertedWith('StakedLyxToken: unstaking in progress');
    });

    it('should revert if amount is zero', async function () {
      await expect(stakedLyxToken.connect(user1).unstake(0)).to.be.revertedWith(
        'StakedLyxToken: amount must be greater than zero'
      );
    });

    it('should revert if user has insufficient balance', async function () {
      await expect(
        stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther('1'))
      ).to.be.revertedWith('StakedLyxToken: insufficient balance');
    });

    it('should create a new unstake request and update user balance', async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
      const userBalanceBefore = await stakedLyxToken.balanceOf(user1.address);
      const unstakeAmount = ethers.utils.parseEther('16');

      const tx = await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const userBalanceAfter = await stakedLyxToken.balanceOf(user1.address);

      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(unstakeAmount));

      await expect(tx)
        .to.emit(stakedLyxToken, 'NewUnstakeRequest')
        .withArgs(1, user1.address, unstakeAmount, unstakeAmount);
    });

    it('should update total pending unstake and total deposits', async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
      const totalDepositsBefore = await stakedLyxToken.totalDeposits();
      const unstakeAmount = ethers.utils.parseEther('16');

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const totalPendingUnstakeAfter =
        await stakedLyxToken.totalPendingUnstake();
      const totalDepositsAfter = await stakedLyxToken.totalDeposits();

      expect(totalPendingUnstakeAfter).to.equal(unstakeAmount);
      expect(totalDepositsAfter).to.equal(
        totalDepositsBefore.sub(unstakeAmount)
      );
    });

    it('should update distributor principal if rewards are disabled for user', async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
      const unstakeAmount = ethers.utils.parseEther('16');

      await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);

      const distributorPrincipalBefore =
        await stakedLyxToken.distributorPrincipal();

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);

      const distributorPrincipalAfter =
        await stakedLyxToken.distributorPrincipal();

      expect(distributorPrincipalAfter).to.equal(
        distributorPrincipalBefore.sub(unstakeAmount)
      );
    });

    it('should not update distributor principal if rewards are enabled for user', async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
      const distributorPrincipalBefore =
        await stakedLyxToken.distributorPrincipal();
      const unstakeAmount = ethers.utils.parseEther('16');

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const distributorPrincipalAfter =
        await stakedLyxToken.distributorPrincipal();

      expect(distributorPrincipalAfter).to.equal(distributorPrincipalBefore);
    });
  });

  describe('matchUnstake', function () {
    beforeEach(async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
      await stakedLyxToken
        .connect(admin)
        .mint(user2.address, ethers.utils.parseEther('32'), true, '0x');
    });

    it('should revert if not called by the pool contract', async function () {
      await expect(
        stakedLyxToken.connect(user1).matchUnstake(ethers.utils.parseEther('1'))
      ).to.be.revertedWith('StakedLyxToken: access denied');
    });

    it('should revert if unstaking is in progress', async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
      await stakedLyxToken
        .connect(user1)
        .unstake(ethers.utils.parseEther('32'));
      await stakedLyxToken.connect(admin).setUnstakeProcessing(1);
      await expect(
        stakedLyxToken.connect(admin).matchUnstake(ethers.utils.parseEther('1'))
      ).to.be.revertedWith('StakedLyxToken: unstaking in progress');
    });

    it('should return zero if there are no pending unstake requests', async function () {
      const amountMatched = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(ethers.utils.parseEther('1'));
      expect(amountMatched).to.equal(0);
    });

    it('should match the full unstake amount if there are sufficient pending unstake requests', async function () {
      const unstakeAmount = ethers.utils.parseEther('16');
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const amountMatched = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(unstakeAmount);
      expect(amountMatched).to.equal(unstakeAmount);
    });

    it('should match partial unstake amount if there are insufficient pending unstake requests', async function () {
      const unstakeAmount = ethers.utils.parseEther('16');
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      const amountToMatch = ethers.utils.parseEther('24');
      // Call Static to get the amount that will be matched
      const amountMatched = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(amountToMatch);
      // Then normal call to update state
      await stakedLyxToken.connect(admin).matchUnstake(amountToMatch);
      const pendingUnstake = await stakedLyxToken.totalPendingUnstake();
      const unstakeRequestCurrentIndex =
        await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(pendingUnstake).to.equal(unstakeAmount.sub(amountMatched));
      expect(amountMatched).to.equal(unstakeAmount);
      expect(unstakeRequestCurrentIndex).to.equal(1);
    });

    it('should remain latest index if all unstakes matched', async function () {
      const unstakeAmount = ethers.utils.parseEther('16');
      await stakedLyxToken.connect(user2).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      const unstakeRequestCurrentIndex =
        await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(unstakeRequestCurrentIndex).to.equal(1);
    });

    it('should go to next current index if possible and exact match on unstake value', async function () {
      const unstakeAmount = ethers.utils.parseEther('16');
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(user2).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      const unstakeRequestCurrentIndex =
        await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(unstakeRequestCurrentIndex).to.equal(2);
    });

    it('should have correct input for complex case', async function () {
      await stakedLyxToken
        .connect(user2)
        .unstake(ethers.utils.parseEther('14'));
      await stakedLyxToken
        .connect(user2)
        .unstake(ethers.utils.parseEther('14'));
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther('3'));
      await stakedLyxToken
        .connect(user1)
        .unstake(ethers.utils.parseEther('21'));

      // First call static to get the matched amount
      let matchedAmount = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(ethers.utils.parseEther('3'));
      // Then call normal to update state
      await stakedLyxToken
        .connect(admin)
        .matchUnstake(ethers.utils.parseEther('3'));

      let unstakeRequestCurrentIndex =
        await stakedLyxToken.unstakeRequestCurrentIndex();
      let totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      let unstakeRequest = await stakedLyxToken.unstakeRequest(1);

      expect(unstakeRequestCurrentIndex).to.equal(1);
      expect(unstakeRequest.amountFilled).to.equal(
        ethers.utils.parseEther('3')
      );
      expect(matchedAmount).to.equal(ethers.utils.parseEther('3'));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther('49'));

      // First call static to get the matched amount
      matchedAmount = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(ethers.utils.parseEther('27'));
      // Then call normal to update state
      await stakedLyxToken
        .connect(admin)
        .matchUnstake(ethers.utils.parseEther('27'));

      unstakeRequestCurrentIndex =
        await stakedLyxToken.unstakeRequestCurrentIndex();
      totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      unstakeRequest = await stakedLyxToken.unstakeRequest(3);

      expect(unstakeRequestCurrentIndex).to.equal(3);
      expect(unstakeRequest.amountFilled).to.equal(
        ethers.utils.parseEther('2')
      );
      expect(matchedAmount).to.equal(ethers.utils.parseEther('27'));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther('22'));

      // First call static to get the matched amount
      matchedAmount = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(ethers.utils.parseEther('102'));
      // Then call normal to update state
      await stakedLyxToken
        .connect(admin)
        .matchUnstake(ethers.utils.parseEther('102'));

      unstakeRequestCurrentIndex =
        await stakedLyxToken.unstakeRequestCurrentIndex();
      totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      unstakeRequest = await stakedLyxToken.unstakeRequest(4);

      expect(unstakeRequestCurrentIndex).to.equal(4);
      expect(unstakeRequest.amountFilled).to.equal(
        ethers.utils.parseEther('21')
      );
      expect(matchedAmount).to.equal(ethers.utils.parseEther('22'));
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther('0'));
    });

    it('should update totalPendingUnstake and unstakeRequestCurrentIndex properly', async function () {
      const unstakeAmount = ethers.utils.parseEther('16');
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(user2).unstake(unstakeAmount);

      const totalPendingUnstakeBefore =
        await stakedLyxToken.totalPendingUnstake();

      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      let totalPendingUnstakeAfter = await stakedLyxToken.totalPendingUnstake();
      let unstakeRequestCurrentIndexAfter =
        await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(totalPendingUnstakeAfter).to.equal(
        totalPendingUnstakeBefore.sub(unstakeAmount)
      );
      expect(unstakeRequestCurrentIndexAfter).to.equal(2);

      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      totalPendingUnstakeAfter = await stakedLyxToken.totalPendingUnstake();
      unstakeRequestCurrentIndexAfter =
        await stakedLyxToken.unstakeRequestCurrentIndex();

      expect(totalPendingUnstakeAfter).to.equal(unstakeAmount);
      expect(unstakeRequestCurrentIndexAfter).to.equal(3);
    });

    it('should update the amountFilled of unstake requests properly', async function () {
      const unstakeAmount = ethers.utils.parseEther('16');
      await stakedLyxToken.connect(user1).unstake(unstakeAmount);
      await stakedLyxToken.connect(user2).unstake(unstakeAmount);

      await stakedLyxToken.connect(admin).matchUnstake(unstakeAmount);

      const request1 = await stakedLyxToken.unstakeRequest(1);
      const request2 = await stakedLyxToken.unstakeRequest(2);

      expect(request1.amountFilled).to.equal(unstakeAmount);
      expect(request2.amountFilled).to.equal(0);
    });
  });

  describe('setUnstakeProcessing', function () {
    it('should revert if not called by admin', async function () {
      await expect(
        stakedLyxToken.connect(user1).setUnstakeProcessing(1)
      ).to.be.revertedWith('StakedLyxToken: access denied');
    });

    it('should not be able to setUnstakeProcessing if less than 32LYX pending unstake', async function () {
      await expect(stakedLyxToken.connect(admin).setUnstakeProcessing(1))
        .to.emit(stakedLyxToken, 'UnstakeCancelled')
        .withArgs(1);
      const unstakeProcessing = await stakedLyxToken.unstakeProcessing();
      expect(unstakeProcessing).to.equal(false);
    });

    it('should be able to setUnstakeProcessing if more than 32LYX pending unstake', async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
      await stakedLyxToken
        .connect(user1)
        .unstake(ethers.utils.parseEther('32'));
      await expect(stakedLyxToken.connect(admin).setUnstakeProcessing(1))
        .to.emit(stakedLyxToken, 'UnstakeReady')
        .withArgs(1);

      const unstakeProcessing = await stakedLyxToken.unstakeProcessing();
      expect(unstakeProcessing).to.equal(true);
    });
  });

  describe('unstakeProcessed', function () {
    beforeEach(async function () {
      await stakedLyxToken
        .connect(admin)
        .mint(user1.address, ethers.utils.parseEther('64'), true, '0x');
      await stakedLyxToken
        .connect(admin)
        .mint(user2.address, ethers.utils.parseEther('64'), true, '0x');
    });

    it('should revert if not called by the pool contract', async function () {
      await expect(
        stakedLyxToken.connect(user1).unstakeProcessed(1, user1.address)
      ).to.be.revertedWith('StakedLyxToken: access denied');
    });

    it('should revert if the unstake request does not exist', async function () {
      await expect(
        stakedLyxToken.connect(admin).unstakeProcessed(1, user1.address)
      ).to.be.revertedWith('StakedLyxToken: unstaking not in process');
    });

    it('should process the unstakes', async function () {
      await stakedLyxToken
        .connect(user1)
        .unstake(ethers.utils.parseEther('32'));
      await stakedLyxToken.connect(admin).setUnstakeProcessing(1);
      await stakedLyxToken
        .connect(admin)
        .unstakeProcessed(1, ethers.utils.parseEther('32'));

      const unstakeRequest = await stakedLyxToken.unstakeRequest(1);
      const totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      const totalUnstaked = await stakedLyxToken.totalUnstaked();
      const unstakeProcessing = await stakedLyxToken.unstakeProcessing();

      expect(unstakeRequest.amountFilled).to.equal(
        ethers.utils.parseEther('32')
      );
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther('0'));
      expect(totalUnstaked).to.equal(ethers.utils.parseEther('32'));
      expect(unstakeProcessing).to.equal(false);
    });

    it('should emit the UnstakeProcessed event', async function () {
      await stakedLyxToken
        .connect(user1)
        .unstake(ethers.utils.parseEther('32'));
      await stakedLyxToken.connect(admin).setUnstakeProcessing(1);

      await expect(
        stakedLyxToken
          .connect(admin)
          .unstakeProcessed(1, ethers.utils.parseEther('32'))
      )
        .to.emit(stakedLyxToken, 'UnstakeProcessed')
        .withArgs(
          1,
          ethers.utils.parseEther('32'),
          ethers.utils.parseEther('0')
        );
    });

    it('should not change the user balance', async function () {
      await stakedLyxToken
        .connect(user1)
        .unstake(ethers.utils.parseEther('32'));
      await stakedLyxToken.connect(admin).setUnstakeProcessing(1);

      const userBalanceBefore = await stakedLyxToken.balanceOf(user1.address);
      await stakedLyxToken
        .connect(admin)
        .unstakeProcessed(1, ethers.utils.parseEther('32'));
      const userBalanceAfter = await stakedLyxToken.balanceOf(user1.address);

      expect(userBalanceAfter).to.equal(userBalanceBefore);
    });

    it('should have correct input for complex case', async function () {
      await stakedLyxToken
        .connect(user2)
        .unstake(ethers.utils.parseEther('14'));
      await stakedLyxToken
        .connect(user1)
        .unstake(ethers.utils.parseEther('29'));
      await stakedLyxToken
        .connect(user2)
        .unstake(ethers.utils.parseEther('18'));
      await stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther('3'));

      await stakedLyxToken.connect(admin).setUnstakeProcessing(1);
      await stakedLyxToken
        .connect(admin)
        .unstakeProcessed(1, ethers.utils.parseEther('32'));

      let unstakeRequestCurrentIndex =
        await stakedLyxToken.unstakeRequestCurrentIndex();
      let totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      let unstakeRequest = await stakedLyxToken.unstakeRequest(2);

      expect(unstakeRequestCurrentIndex).to.equal(2);
      expect(unstakeRequest.amountFilled).to.equal(
        ethers.utils.parseEther('18')
      );
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther('32'));

      await stakedLyxToken.connect(admin).setUnstakeProcessing(1);
      await stakedLyxToken
        .connect(admin)
        .unstakeProcessed(1, ethers.utils.parseEther('32'));

      unstakeRequestCurrentIndex =
        await stakedLyxToken.unstakeRequestCurrentIndex();
      totalPendingUnstake = await stakedLyxToken.totalPendingUnstake();
      unstakeRequest = await stakedLyxToken.unstakeRequest(4);

      expect(unstakeRequestCurrentIndex).to.equal(4);
      expect(unstakeRequest.amountFilled).to.equal(
        ethers.utils.parseEther('3')
      );
      expect(totalPendingUnstake).to.equal(ethers.utils.parseEther('0'));
    });
  });
});
