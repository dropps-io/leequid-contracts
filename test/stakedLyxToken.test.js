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

  // describe('toggleRewards', function () {
  //   it('should revert if not called by admin', async function () {
  //     await expect(
  //       stakedLyxToken.connect(user1).toggleRewards(user2.address, true)
  //     ).to.be.revertedWith('OwnablePausable: access denied');
  //   });
  //
  //   it('should revert if called with a zero address as tokenOwner', async function () {
  //     await expect(
  //       stakedLyxToken
  //         .connect(admin)
  //         .toggleRewards(ethers.constants.AddressZero, true)
  //     ).to.be.revertedWith('StakedLyxToken: invalid tokenOwner');
  //   });
  //
  //   it('should disable rewards for a user', async function () {
  //     await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);
  //     const isDisabled = await rewardLyxToken.rewardsDisabled(user1.address);
  //     expect(isDisabled).to.be.true;
  //   });
  //
  //   it('should enable rewards for a user', async function () {
  //     await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);
  //     await stakedLyxToken.connect(admin).toggleRewards(user1.address, false);
  //     const isDisabled = await rewardLyxToken.rewardsDisabled(user1.address);
  //     expect(isDisabled).to.be.false;
  //   });
  //
  //   it('should update distributor principal after toggling rewards', async function () {
  //     // Deposit some tokens for user1
  //     await stakedLyxToken
  //       .connect(admin)
  //       .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
  //
  //     const distributorPrincipalBefore =
  //       await stakedLyxToken.distributorPrincipal();
  //     // Disable rewards for user1
  //     await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);
  //     const distributorPrincipalAfter =
  //       await stakedLyxToken.distributorPrincipal();
  //     expect(distributorPrincipalAfter).to.equal(
  //       distributorPrincipalBefore.add(ethers.utils.parseEther('32'))
  //     );
  //
  //     // Enable rewards for user1
  //     await stakedLyxToken.connect(admin).toggleRewards(user1.address, false);
  //
  //     const distributorPrincipalAfterAfter =
  //       await stakedLyxToken.distributorPrincipal();
  //
  //     expect(distributorPrincipalAfterAfter).to.equal(
  //       distributorPrincipalBefore
  //     );
  //   });
  // });
  //
  // describe('unstake', function () {
  //   it('should revert if unstaking is in progress', async function () {
  //     await stakedLyxToken
  //       .connect(admin)
  //       .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
  //     await stakedLyxToken
  //       .connect(user1)
  //       .unstake(ethers.utils.parseEther('32'));
  //     await stakedLyxToken.connect(admin).setUnstakeProcessing(1);
  //     await expect(
  //       stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther('1'))
  //     ).to.be.revertedWith('StakedLyxToken: unstaking in progress');
  //   });
  //
  //   it('should revert if amount is zero', async function () {
  //     await expect(stakedLyxToken.connect(user1).unstake(0)).to.be.revertedWith(
  //       'StakedLyxToken: amount must be greater than zero'
  //     );
  //   });
  //
  //   it('should revert if user has insufficient balance', async function () {
  //     await expect(
  //       stakedLyxToken.connect(user1).unstake(ethers.utils.parseEther('1'))
  //     ).to.be.revertedWith('StakedLyxToken: insufficient balance');
  //   });
  //
  //   it('should create a new unstake request and update user balance', async function () {
  //     await stakedLyxToken
  //       .connect(admin)
  //       .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
  //     const userBalanceBefore = await stakedLyxToken.balanceOf(user1.address);
  //     const unstakeAmount = ethers.utils.parseEther('16');
  //
  //     const tx = await stakedLyxToken.connect(user1).unstake(unstakeAmount);
  //     const userBalanceAfter = await stakedLyxToken.balanceOf(user1.address);
  //
  //     expect(userBalanceAfter).to.equal(userBalanceBefore.sub(unstakeAmount));
  //
  //     await expect(tx)
  //       .to.emit(stakedLyxToken, 'NewUnstakeRequest')
  //       .withArgs(1, user1.address, unstakeAmount, unstakeAmount);
  //   });
  //
  //   it('should update total pending unstake and total deposits', async function () {
  //     await stakedLyxToken
  //       .connect(admin)
  //       .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
  //     const totalDepositsBefore = await stakedLyxToken.totalDeposits();
  //     const unstakeAmount = ethers.utils.parseEther('16');
  //
  //     await stakedLyxToken.connect(user1).unstake(unstakeAmount);
  //     const totalPendingUnstakeAfter =
  //       await stakedLyxToken.totalPendingUnstake();
  //     const totalDepositsAfter = await stakedLyxToken.totalDeposits();
  //
  //     expect(totalPendingUnstakeAfter).to.equal(unstakeAmount);
  //     expect(totalDepositsAfter).to.equal(
  //       totalDepositsBefore.sub(unstakeAmount)
  //     );
  //   });
  //
  //   it('should update distributor principal if rewards are disabled for user', async function () {
  //     await stakedLyxToken
  //       .connect(admin)
  //       .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
  //     const unstakeAmount = ethers.utils.parseEther('16');
  //
  //     await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);
  //
  //     const distributorPrincipalBefore =
  //       await stakedLyxToken.distributorPrincipal();
  //
  //     await stakedLyxToken.connect(user1).unstake(unstakeAmount);
  //
  //     const distributorPrincipalAfter =
  //       await stakedLyxToken.distributorPrincipal();
  //
  //     expect(distributorPrincipalAfter).to.equal(
  //       distributorPrincipalBefore.sub(unstakeAmount)
  //     );
  //   });
  //
  //   it('should not update distributor principal if rewards are enabled for user', async function () {
  //     await stakedLyxToken
  //       .connect(admin)
  //       .mint(user1.address, ethers.utils.parseEther('32'), true, '0x');
  //     const distributorPrincipalBefore =
  //       await stakedLyxToken.distributorPrincipal();
  //     const unstakeAmount = ethers.utils.parseEther('16');
  //
  //     await stakedLyxToken.connect(user1).unstake(unstakeAmount);
  //     const distributorPrincipalAfter =
  //       await stakedLyxToken.distributorPrincipal();
  //
  //     expect(distributorPrincipalAfter).to.equal(distributorPrincipalBefore);
  //   });
  // });

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
      const amountMatched = await stakedLyxToken
        .connect(admin)
        .callStatic.matchUnstake(amountToMatch);
      expect(amountMatched).to.equal(unstakeAmount);
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

    //TODO Rewiew the index logic and add plenty of tests

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
});
