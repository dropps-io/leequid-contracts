const { ethers } = require('hardhat');
const { getTestDepositData } = require('./utils');
const { expect } = require('chai');

describe('RewardLyxToken contract', function () {
  const protocolFee = 0.1; // 10%
  const ZERRO_ADDRESS = '0x0000000000000000000000000000000000000000';

  let RewardLyxToken, rewardLyxToken;
  let StakedLyxToken, stakedLyxToken;
  let MerkleDistributor, merkleDistributor;
  let FeesEscrow, feesEscrow;
  let Pool, pool;
  let Oracles, oracles;
  let PoolValidators, poolValidators;
  let DepositContract, beaconDepositMock;
  let chain, admin, user1, user2, user3, user4;

  before(async function () {
    RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
    StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
    MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    FeesEscrow = await ethers.getContractFactory('FeesEscrow');
    Pool = await ethers.getContractFactory('Pool');
    Oracles = await ethers.getContractFactory('Oracles');
    PoolValidators = await ethers.getContractFactory('PoolValidators');
    DepositContract = await ethers.getContractFactory('DepositContract');
    [chain, admin, oracles, operator, user1, user2, user3, user4] =
      await ethers.getSigners();
  });

  beforeEach(async function () {
    rewardLyxToken = await RewardLyxToken.deploy();
    stakedLyxToken = await StakedLyxToken.deploy();
    pool = await Pool.deploy();
    poolValidators = await PoolValidators.deploy();
    merkleDistributor = await MerkleDistributor.deploy();
    oracles = await Oracles.deploy();
    feesEscrow = await FeesEscrow.deploy(rewardLyxToken.address);
    beaconDepositMock = await DepositContract.deploy();
    await oracles.deployed();
    await rewardLyxToken.deployed();
    await stakedLyxToken.deployed();
    await pool.deployed();
    await merkleDistributor.deployed();
    await feesEscrow.deployed();
    await oracles.deployed();

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
      admin.address,
      admin.address,
      (protocolFee * 10000).toString(),
      admin.address,
      feesEscrow.address,
      pool.address
    );

    await stakedLyxToken
      .connect(admin)
      .initialize(
        admin.address,
        pool.address,
        oracles.address,
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

  describe('updateTotalRewards', function () {
    const stakedAmount = 1000; // eth
    const totalRewards = 10; // eth
    const newTotalRewards = totalRewards * 2; // eth
    const totalRewardsWei = ethers.utils.parseEther(totalRewards.toString()); // eth
    const newTotalRewardsWei = ethers.utils.parseEther(
      newTotalRewards.toString()
    ); // eth
    const stakePerUser = ethers.utils.parseEther((stakedAmount / 4).toString());

    beforeEach(async function () {
      await pool.connect(user1).stake({ value: stakePerUser });
      await pool.connect(user2).stake({ value: stakePerUser });
      await pool.connect(user3).stake({ value: stakePerUser });
      await pool.connect(user4).stake({ value: stakePerUser });
    });

    it('should update total rewards', async function () {
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user1.address);

      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
    });

    it('should collect fees', async function () {
      const transaction = {
        to: feesEscrow.address,
        value: ethers.utils.parseEther('1'),
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await expect(
        rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei)
      )
        .to.emit(rewardLyxToken, 'RewardsUpdated')
        .withArgs(
          ethers.utils.parseEther((totalRewards + 1).toString()),
          totalRewardsWei,
          ethers.utils.parseEther('1'),
          ethers.utils.parseEther(
            (((totalRewards + 1) * (1 - protocolFee)) / stakedAmount).toString()
          ),
          0,
          0
        );

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user1.address);
      const contractTotalRewards = await rewardLyxToken.totalRewards();
      const totalFeesCollected = await rewardLyxToken.totalFeesCollected();

      expect(totalFeesCollected).to.equal(ethers.utils.parseEther('1'));
      expect(contractTotalRewards).to.equal(totalRewardsWei);

      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther(
          ((totalRewards + 1) * protocolFee).toFixed(3).toString()
        )
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards + 1 - (totalRewards + 1) * protocolFee) / 4).toString()
        )
      );
    });

    it('should revert if sender not oracle', async function () {
      expect(
        rewardLyxToken.connect(user1).updateTotalRewards(totalRewardsWei)
      ).to.be.revertedWith('RewardLyxToken: access denied');
    });

    it('should update total rewards twice', async function () {
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);
      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(newTotalRewardsWei);

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user1.address);

      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * 2 * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards * 2 - totalRewards * 2 * protocolFee) / 4).toString()
        )
      );
    });

    it('should update properly total rewards twice when protocolFeeReceiver change', async function () {
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);
      await rewardLyxToken
        .connect(admin)
        .setProtocolFeeRecipient(ZERRO_ADDRESS);
      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(newTotalRewardsWei);

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user1.address);

      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * protocolFee).toString())
      );
      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards * 2 - totalRewards * 2 * protocolFee) / 4).toString()
        )
      );
    });

    it('should emit the right RewardsUpdated when updateTotalRewards twice with protocolFeeReceiver change', async function () {
      await rewardLyxToken
        .connect(admin)
        .setProtocolFeeRecipient(ZERRO_ADDRESS);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);
      await rewardLyxToken
        .connect(admin)
        .setProtocolFeeRecipient(admin.address);

      await expect(
        rewardLyxToken.connect(admin).updateTotalRewards(newTotalRewardsWei)
      )
        .to.emit(rewardLyxToken, 'RewardsUpdated')
        .withArgs(
          ethers.utils.parseEther((newTotalRewards - totalRewards).toString()),
          newTotalRewardsWei,
          ethers.utils.parseEther('0'),
          ethers.utils.parseEther(
            ((newTotalRewards * (1 - protocolFee)) / stakedAmount).toString()
          ),
          0,
          0
        );
    });

    it('should emit a RewardsUpdated event', async function () {
      await expect(
        rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei)
      )
        .to.emit(rewardLyxToken, 'RewardsUpdated')
        .withArgs(
          totalRewardsWei,
          totalRewardsWei,
          ethers.utils.parseEther('0'),
          ethers.utils.parseEther(
            ((totalRewards * (1 - protocolFee)) / stakedAmount).toString()
          ),
          0,
          0
        );
    });

    it('should give protocol fees to distributor balance if fee recipient is address(0)', async function () {
      await rewardLyxToken
        .connect(admin)
        .setProtocolFeeRecipient(ZERRO_ADDRESS);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        ZERRO_ADDRESS
      );
      const userBalance = await rewardLyxToken.balanceOf(user1.address);

      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
    });

    it('should emit a RewardsUpdated event with distributor balance rewards info', async function () {
      await rewardLyxToken
        .connect(admin)
        .setProtocolFeeRecipient(ZERRO_ADDRESS);
      await expect(
        rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei)
      )
        .to.emit(rewardLyxToken, 'RewardsUpdated')
        .withArgs(
          totalRewardsWei,
          totalRewardsWei,
          ethers.utils.parseEther('0'),
          ethers.utils.parseEther(
            ((totalRewards * (1 - protocolFee)) / stakedAmount).toString()
          ),
          ethers.utils.parseEther((totalRewards * protocolFee).toString()),
          ethers.utils.parseEther((totalRewards * protocolFee).toString())
        );
    });

    it('should emit the right RewardsUpdated event with right distributor balance rewards info after 2 updates', async function () {
      await rewardLyxToken
        .connect(admin)
        .setProtocolFeeRecipient(ZERRO_ADDRESS);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);
      await expect(
        rewardLyxToken.connect(admin).updateTotalRewards(newTotalRewardsWei)
      )
        .to.emit(rewardLyxToken, 'RewardsUpdated')
        .withArgs(
          ethers.utils.parseEther((newTotalRewards - totalRewards).toString()),
          newTotalRewardsWei,
          ethers.utils.parseEther('0'),
          ethers.utils.parseEther(
            ((newTotalRewards * (1 - protocolFee)) / stakedAmount).toString()
          ),
          ethers.utils.parseEther((totalRewards * protocolFee).toString()),
          ethers.utils.parseEther((totalRewards * protocolFee).toString())
        );
    });
  });

  describe('updateRewardCheckpoint', function () {
    const stakePerUser = ethers.utils.parseEther('25');

    beforeEach(async function () {
      await pool.connect(user1).stake({ value: stakePerUser });
      await pool.connect(user2).stake({ value: stakePerUser });
      await pool.connect(user3).stake({ value: stakePerUser });
      await pool.connect(user4).stake({ value: stakePerUser });
    });

    it('should update reward checkpoint correctly for an account with rewards enabled', async function () {
      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(ethers.utils.parseEther('100'));

      await rewardLyxToken.updateRewardCheckpoint(user1.address);

      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(ethers.utils.parseEther('200'));

      const checkpoint = await rewardLyxToken.checkpoints(user1.address);
      const balance = await rewardLyxToken.balanceOf(user1.address);

      expect(checkpoint.rewardPerToken.toString()).to.equal(
        ethers.utils.parseEther(((100 * (1 - protocolFee)) / 100).toString())
      );
      expect(checkpoint.reward.toString()).to.equal(
        ethers.utils.parseEther(((100 * (1 - protocolFee)) / 4).toString())
      );
      expect(balance).to.equal(
        ethers.utils.parseEther(((200 * (1 - protocolFee)) / 4).toString())
      );
    });

    it('should only update the rewardPerToken if stake is 0', async function () {
      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(ethers.utils.parseEther('100'));

      await stakedLyxToken
        .connect(user1)
        .transferFrom(user1.address, user2.address, stakePerUser);

      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(ethers.utils.parseEther('200'));

      await rewardLyxToken.updateRewardCheckpoint(user1.address);

      const checkpoint = await rewardLyxToken.checkpoints(user1.address);
      const balance = await rewardLyxToken.balanceOf(user1.address);

      expect(checkpoint.rewardPerToken.toString()).to.equal(
        ethers.utils.parseEther(((200 * (1 - protocolFee)) / 100).toString())
      );
      expect(checkpoint.reward.toString()).to.equal(
        ethers.utils.parseEther(((100 * (1 - protocolFee)) / 4).toString())
      );
      expect(balance).to.equal(
        ethers.utils.parseEther(((100 * (1 - protocolFee)) / 4).toString())
      );
    });

    it('should not update reward checkpoint for an account with rewards disabled', async function () {
      await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);

      const initialCheckpoint = await rewardLyxToken.checkpoints(user1.address);
      const initialBalance = await rewardLyxToken.balanceOf(user1.address);

      await rewardLyxToken.updateRewardCheckpoint(user1.address);

      const updatedCheckpoint = await rewardLyxToken.checkpoints(user1.address);
      const updatedBalance = await rewardLyxToken.balanceOf(user1.address);

      expect(updatedCheckpoint.rewardPerToken).to.equal(
        initialCheckpoint.rewardPerToken
      );
      expect(updatedBalance).to.equal(initialBalance);
      expect(updatedCheckpoint.reward).to.equal(initialCheckpoint.reward);
    });
  });

  describe('setRewardsDisabled', function () {
    const stakePerUser = ethers.utils.parseEther('100');

    beforeEach(async function () {
      await pool.connect(user1).stake({ value: stakePerUser });
    });

    it('should set rewardsDisabled for an account', async function () {
      await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);
      const isDisabled = await rewardLyxToken.rewardsDisabled(user1.address);
      expect(isDisabled).to.equal(true);
    });

    it('should emit RewardsToggled event', async function () {
      await expect(
        stakedLyxToken.connect(admin).toggleRewards(user1.address, true)
      )
        .to.emit(rewardLyxToken, 'RewardsToggled')
        .withArgs(user1.address, true);
    });

    it('should update reward checkpoint before setting rewardsDisabled', async function () {
      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(ethers.utils.parseEther('100'));
      await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);
      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(ethers.utils.parseEther('200'));
      const checkpoint = await rewardLyxToken.checkpoints(user1.address);
      const rewardPerToken = await rewardLyxToken.rewardPerToken();
      const balance = await rewardLyxToken.balanceOf(user1.address);

      expect(checkpoint.reward).to.equal(ethers.utils.parseEther('90'));
      expect(checkpoint.rewardPerToken).to.not.equal(rewardPerToken);
      expect(balance).to.equal(ethers.utils.parseEther('90'));
    });

    it('should not update rewards for disabled account', async function () {
      await stakedLyxToken.connect(admin).toggleRewards(user1.address, true);
      const prevBalance = await rewardLyxToken.balanceOf(user1.address);

      const totalRewards = 100; // eth
      const totalRewardsWei = ethers.utils.parseEther(totalRewards.toString()); // eth
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const newBalance = await rewardLyxToken.balanceOf(user1.address);
      expect(prevBalance).to.equal(newBalance);
    });

    it('should update rewards for enabled account', async function () {
      const prevBalance = await rewardLyxToken.balanceOf(user1.address);

      const totalRewards = 100; // eth
      const totalRewardsWei = ethers.utils.parseEther(totalRewards.toString()); // eth
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const newBalance = await rewardLyxToken.balanceOf(user1.address);
      expect(prevBalance).to.not.equal(newBalance);
    });

    it('should revert if sender not stakedLyxToken', async function () {
      await expect(
        rewardLyxToken.connect(user1).setRewardsDisabled(user1.address, true)
      ).to.be.revertedWith('RewardLyxToken: access denied');
    });

    it('should revert if trying to set the same value', async function () {
      await expect(
        stakedLyxToken.connect(admin).toggleRewards(user1.address, false)
      ).to.be.revertedWith('RewardLyxToken: value did not change');
    });
  });

  describe('claim', function () {
    const stakedAmount = 100000; // eth
    const totalRewards = 100; // eth
    const totalRewardsWei = ethers.utils.parseEther(totalRewards.toString()); // eth
    const stakePerUser = ethers.utils.parseEther((stakedAmount / 3).toString());

    beforeEach(async function () {
      await pool.connect(user1).stake({ value: stakePerUser });
      await pool.connect(user2).stake({ value: stakePerUser });
      await pool.connect(user3).stake({ value: stakePerUser });

      await rewardLyxToken
        .connect(admin)
        .setProtocolFeeRecipient(ZERRO_ADDRESS);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);
    });

    it('should successfully claim rewards for user1', async function () {
      await rewardLyxToken
        .connect(admin)
        .claim(user4.address, ethers.utils.parseEther('1'));
      const balance = await rewardLyxToken.balanceOf(user4.address);
      const distributorBalance = await rewardLyxToken.balanceOf(ZERRO_ADDRESS);

      expect(balance).to.equal(ethers.utils.parseEther('1'));
      expect(distributorBalance).to.equal(ethers.utils.parseEther('9'));
    });

    it('should fail to claim rewards if not merkle distributor', async function () {
      await expect(
        rewardLyxToken
          .connect(user1)
          .claim(user4.address, ethers.utils.parseEther('1'))
      ).to.be.revertedWith('RewardLyxToken: access denied');
    });
  });

  describe('cashOutRewards', function () {
    const stakedAmount = 1000; // eth
    const totalRewards = 10; // eth
    const newTotalRewards = totalRewards * 2; // eth
    const totalRewardsWei = ethers.utils.parseEther(totalRewards.toString()); // eth
    const newTotalRewardsWei = ethers.utils.parseEther(
      newTotalRewards.toString()
    ); // eth
    const stakePerUser = ethers.utils.parseEther((stakedAmount / 4).toString());

    beforeEach(async function () {
      await pool.connect(user1).stake({ value: stakePerUser });
      await pool.connect(user2).stake({ value: stakePerUser });
      await pool.connect(user3).stake({ value: stakePerUser });
      await pool.connect(user4).stake({ value: stakePerUser });
    });

    it('should be able to cashout', async function () {
      const transaction = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const userEthBalanceBefore = await ethers.provider.getBalance(
        user1.address
      );

      await rewardLyxToken
        .connect(user1)
        .cashOutRewards(
          ethers.utils.parseEther(
            ((totalRewards * (1 - protocolFee)) / 4).toString()
          )
        );

      const userEthBalanceAfter = await ethers.provider.getBalance(
        user1.address
      );

      const totalCashedOutRewards = await rewardLyxToken.totalCashedOut();

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user2.address);
      const user1Balance = await rewardLyxToken.balanceOf(user1.address);
      const contractEthBalance = await ethers.provider.getBalance(
        rewardLyxToken.address
      );

      expect(totalCashedOutRewards).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
      expect(user1Balance).to.equal(ethers.utils.parseEther('0'));
      expect(contractEthBalance).to.equal(
        // eslint-disable-next-line no-mixed-operators
        ethers.utils.parseEther(
          (totalRewards - (totalRewards * (1 - protocolFee)) / 4).toString()
        )
      );
      expect(
        parseFloat(ethers.utils.formatEther(userEthBalanceAfter))
      ).to.be.gt(parseFloat(ethers.utils.formatEther(userEthBalanceBefore)));
    });

    it('should be able have correct value after cashout, then updateRewards', async function () {
      const transaction = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const userEthBalanceBefore = await ethers.provider.getBalance(
        user1.address
      );

      await rewardLyxToken
        .connect(user1)
        .cashOutRewards(
          ethers.utils.parseEther(
            ((totalRewards * (1 - protocolFee)) / 4).toString()
          )
        );

      const transaction2 = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction2);

      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(newTotalRewardsWei);

      const userEthBalanceAfter = await ethers.provider.getBalance(
        user1.address
      );

      const totalCashedOutRewards = await rewardLyxToken.totalCashedOut();

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user2.address);
      const user1Balance = await rewardLyxToken.balanceOf(user1.address);
      const contractEthBalance = await ethers.provider.getBalance(
        rewardLyxToken.address
      );

      expect(totalCashedOutRewards).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((newTotalRewards * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((newTotalRewards - newTotalRewards * protocolFee) / 4).toString()
        )
      );
      expect(user1Balance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
      expect(contractEthBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          (
            newTotalRewards -
            (totalRewards - totalRewards * protocolFee) / 4
          ).toString()
        )
      );
      expect(
        parseFloat(ethers.utils.formatEther(userEthBalanceAfter))
      ).to.be.gt(parseFloat(ethers.utils.formatEther(userEthBalanceBefore)));
    });

    it('everybody should be able to cashout', async function () {
      const transaction = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const user1Balance = await rewardLyxToken.balanceOf(user1.address);
      const user2Balance = await rewardLyxToken.balanceOf(user2.address);
      const user3Balance = await rewardLyxToken.balanceOf(user3.address);
      const user4Balance = await rewardLyxToken.balanceOf(user4.address);
      const feeRecipientBalance = await rewardLyxToken.balanceOf(admin.address);

      await rewardLyxToken.connect(user1).cashOutRewards(user1Balance);
      await rewardLyxToken.connect(user2).cashOutRewards(user2Balance);
      await rewardLyxToken.connect(user3).cashOutRewards(user3Balance);
      await rewardLyxToken.connect(user4).cashOutRewards(user4Balance);
      await rewardLyxToken.connect(admin).cashOutRewards(feeRecipientBalance);
    });

    it('everybody should be able to cashout even after lot of balances actions', async function () {
      const transaction = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      await rewardLyxToken.connect(user1).updateRewardCheckpoint(user1.address);

      await pool.connect(user4).stake({ value: stakePerUser });
      await pool.connect(user4).stake({ value: stakePerUser });

      const user1Balance1 = await rewardLyxToken.balanceOf(user1.address);
      await rewardLyxToken.connect(user1).cashOutRewards(user1Balance1);

      const transaction2 = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction2);
      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(newTotalRewardsWei);

      const user2Balance2 = await rewardLyxToken.balanceOf(user1.address);
      await rewardLyxToken.connect(user2).cashOutRewards(user2Balance2);

      await pool.connect(user2).stake({
        value: ethers.utils.parseEther((stakedAmount * 6).toString()),
      });

      await rewardLyxToken.connect(user3).updateRewardCheckpoint(user3.address);

      const transaction3 = {
        to: rewardLyxToken.address,
        value: ethers.utils.parseEther((totalRewards * 2).toString()),
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction3);
      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(
          ethers.utils.parseEther((totalRewards * 4).toString())
        );

      const user1Balance = await rewardLyxToken.balanceOf(user1.address);
      const user2Balance = await rewardLyxToken.balanceOf(user2.address);
      const user3Balance = await rewardLyxToken.balanceOf(user3.address);
      const user4Balance = await rewardLyxToken.balanceOf(user4.address);
      const feeRecipientBalance = await rewardLyxToken.balanceOf(admin.address);

      await rewardLyxToken.connect(user1).cashOutRewards(user1Balance);
      await rewardLyxToken.connect(user2).cashOutRewards(user2Balance);
      await rewardLyxToken.connect(user3).cashOutRewards(user3Balance);
      await rewardLyxToken.connect(user4).cashOutRewards(user4Balance);
      await rewardLyxToken.connect(admin).cashOutRewards(feeRecipientBalance);

      const rewardLyxTokenBalance = await ethers.provider.getBalance(
        rewardLyxToken.address
      );
      expect(rewardLyxTokenBalance).to.equal(ethers.utils.parseEther('0'));
    });

    it('should not be able to cashout if user not enough balance', async function () {
      const transaction = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      await expect(
        rewardLyxToken
          .connect(user1)
          .cashOutRewards(
            ethers.utils.parseEther(
              ((totalRewards * (1 - protocolFee)) / 3).toString()
            )
          )
      ).to.revertedWith('RewardLyxToken: insufficient reward balance');
    });

    it('should not be able to cashout if contract not enough balance', async function () {
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      await expect(
        rewardLyxToken
          .connect(user1)
          .cashOutRewards(
            ethers.utils.parseEther(
              ((totalRewards * (1 - protocolFee)) / 4).toString()
            )
          )
      ).to.revertedWith('RewardLyxToken: insufficient contract balance');
    });
  });

  describe('compoundRewards', function () {
    const stakedAmount = 100000; // eth
    const totalRewards = 100; // eth
    const newTotalRewards = totalRewards * 2; // eth
    const totalRewardsWei = ethers.utils.parseEther(totalRewards.toString()); // eth
    const newTotalRewardsWei = ethers.utils.parseEther(
      newTotalRewards.toString()
    ); // eth
    const stakePerUser = ethers.utils.parseEther((stakedAmount / 4).toString());

    beforeEach(async function () {
      await pool.connect(user1).stake({ value: stakePerUser });
      await pool.connect(user2).stake({ value: stakePerUser });
      await pool.connect(user3).stake({ value: stakePerUser });
      await pool.connect(user4).stake({ value: stakePerUser });
    });

    it('should be able to compound', async function () {
      const transaction = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const poolEthBalanceBefore = await ethers.provider.getBalance(
        pool.address
      );

      await rewardLyxToken
        .connect(user1)
        .compoundRewards(
          ethers.utils.parseEther(
            ((totalRewards * (1 - protocolFee)) / 4).toString()
          )
        );

      const poolEthBalanceAfter = await ethers.provider.getBalance(
        pool.address
      );

      const totalCashedOutRewards = await rewardLyxToken.totalCashedOut();

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const userBalance = await rewardLyxToken.balanceOf(user2.address);
      const user1Balance = await rewardLyxToken.balanceOf(user1.address);
      const contractEthBalance = await ethers.provider.getBalance(
        rewardLyxToken.address
      );
      const sLYXBalance = await stakedLyxToken.balanceOf(user1.address);

      expect(sLYXBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          (
            stakedAmount / 4 +
            (totalRewards - totalRewards * protocolFee) / 4
          ).toString()
        )
      );
      expect(totalCashedOutRewards).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((totalRewards * protocolFee).toString())
      );
      expect(userBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );
      expect(user1Balance).to.equal(ethers.utils.parseEther('0'));
      expect(contractEthBalance).to.equal(
        // eslint-disable-next-line no-mixed-operators
        ethers.utils.parseEther(
          (totalRewards - (totalRewards * (1 - protocolFee)) / 4).toString()
        )
      );
      expect(
        parseFloat(ethers.utils.formatEther(poolEthBalanceAfter))
      ).to.be.gt(parseFloat(ethers.utils.formatEther(poolEthBalanceBefore)));
    });

    it('should be able have correct value after cashout, then updateRewards', async function () {
      const transaction = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      const poolEthBalanceBefore = await ethers.provider.getBalance(
        pool.address
      );

      await rewardLyxToken
        .connect(user1)
        .compoundRewards(
          ethers.utils.parseEther(
            ((totalRewards * (1 - protocolFee)) / 4).toString()
          )
        );

      const transaction2 = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction2);

      await rewardLyxToken
        .connect(admin)
        .updateTotalRewards(newTotalRewardsWei);

      const poolEthBalanceAfter = await ethers.provider.getBalance(
        pool.address
      );

      const totalCashedOutRewards = await rewardLyxToken.totalCashedOut();

      const protocolFeeRecipientBalance = await rewardLyxToken.balanceOf(
        admin.address
      );
      const user1Balance = await rewardLyxToken.balanceOf(user1.address);
      const user2Balance = await rewardLyxToken.balanceOf(user2.address);

      const contractEthBalance = await ethers.provider.getBalance(
        rewardLyxToken.address
      );

      const sLYXBalance = await stakedLyxToken.balanceOf(user1.address);

      expect(sLYXBalance).to.equal(
        ethers.utils.parseEther(
          (
            stakedAmount / 4 +
            (totalRewards - totalRewards * protocolFee) / 4
          ).toString()
        )
      );

      expect(totalCashedOutRewards).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          ((totalRewards - totalRewards * protocolFee) / 4).toString()
        )
      );

      // User1 now stake more than the others, for the next update rewards, he then got more rewards
      expect(
        parseFloat(ethers.utils.formatEther(user1Balance))
      ).to.be.greaterThan(
        parseFloat(ethers.utils.formatEther(user2Balance)) -
          // eslint-disable-next-line no-mixed-operators
          (totalRewards - totalRewards * protocolFee) / 4
      );

      expect(protocolFeeRecipientBalance).to.equal(
        ethers.utils.parseEther((newTotalRewards * protocolFee).toString())
      );

      expect(contractEthBalance).to.equal(
        ethers.utils.parseEther(
          // eslint-disable-next-line no-mixed-operators
          (
            newTotalRewards -
            (totalRewards - totalRewards * protocolFee) / 4
          ).toString()
        )
      );
      expect(
        parseFloat(ethers.utils.formatEther(poolEthBalanceAfter))
      ).to.be.gt(parseFloat(ethers.utils.formatEther(poolEthBalanceBefore)));
    });

    it('should not be able to cashout if user not enough balance', async function () {
      const transaction = {
        to: rewardLyxToken.address,
        value: totalRewardsWei,
        gasLimit: '30000000',
      };
      await chain.sendTransaction(transaction);
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      await expect(
        rewardLyxToken
          .connect(user1)
          .compoundRewards(
            ethers.utils.parseEther(
              ((totalRewards * (1 - protocolFee)) / 3).toString()
            )
          )
      ).to.revertedWith('RewardLyxToken: insufficient reward balance');
    });

    it('should not be able to cashout if contract not enough balance', async function () {
      await rewardLyxToken.connect(admin).updateTotalRewards(totalRewardsWei);

      await expect(
        rewardLyxToken
          .connect(user1)
          .compoundRewards(
            ethers.utils.parseEther(
              ((totalRewards * (1 - protocolFee)) / 4).toString()
            )
          )
      ).to.revertedWith('RewardLyxToken: insufficient contract balance');
    });
  });

  describe('claimUnstake', function () {
    const stakedAmount = 100000; // eth
    const stakePerUser = ethers.utils.parseEther((stakedAmount / 4).toString());

    beforeEach(async function () {
      await pool.connect(user1).stake({ value: stakePerUser });
      await pool.connect(user1).stake({ value: stakePerUser });
      await pool.connect(user2).stake({ value: stakePerUser });

      await stakedLyxToken.connect(user1).unstake(stakePerUser);
      await stakedLyxToken.connect(user2).unstake(stakePerUser);

      await pool.connect(user3).stake({ value: stakePerUser });
      await pool.connect(user4).stake({ value: stakePerUser });
    });

    it('should revert if empty indexes array', async function () {
      await expect(
        rewardLyxToken.connect(user1).claimUnstake([])
      ).to.revertedWith('RewardLyxToken: no unstake indexes provided');
    });

    it('should revert if claiming unstake of an other account', async function () {
      await expect(
        rewardLyxToken.connect(user1).claimUnstake([2])
      ).to.revertedWith(
        'StakedLyxToken: unstake request not from this account'
      );
    });

    it('should work well when amount claimable', async function () {
      let balanceBefore = await ethers.provider.getBalance(user1.address);
      await expect(rewardLyxToken.connect(user1).claimUnstake([1]))
        .to.emit(rewardLyxToken, 'UnstakeClaimed')
        .withArgs(user1.address, stakePerUser, [1]);
      let balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(parseInt(ethers.utils.formatEther(balanceAfter))).to.greaterThan(
        parseInt(ethers.utils.formatEther(balanceBefore))
      );

      balanceBefore = await ethers.provider.getBalance(user2.address);
      await expect(rewardLyxToken.connect(user2).claimUnstake([2]))
        .to.emit(rewardLyxToken, 'UnstakeClaimed')
        .withArgs(user2.address, stakePerUser, [2]);
      balanceAfter = await ethers.provider.getBalance(user2.address);

      expect(parseInt(ethers.utils.formatEther(balanceAfter))).to.greaterThan(
        parseInt(ethers.utils.formatEther(balanceBefore))
      );
    });

    it('should not be able to claim twice the same unstake', async function () {
      await rewardLyxToken.connect(user1).claimUnstake([1]);
      await expect(
        rewardLyxToken.connect(user1).claimUnstake([1])
      ).to.revertedWith('StakedLyxToken: unstake request not claimable');
    });

    it('should not be able to claim multiple unstake requests if one is not owned', async function () {
      await expect(
        rewardLyxToken.connect(user1).claimUnstake([1, 2])
      ).to.revertedWith(
        'StakedLyxToken: unstake request not from this account'
      );
    });

    it('should be able to claim multiple unstake requests', async function () {
      await stakedLyxToken.connect(user1).unstake(stakePerUser);

      await pool.connect(user3).stake({ value: stakePerUser });

      let balanceBefore = await ethers.provider.getBalance(user1.address);

      await expect(rewardLyxToken.connect(user1).claimUnstake([1, 3]))
        .to.emit(rewardLyxToken, 'UnstakeClaimed')
        .withArgs(
          user1.address,
          ethers.utils.parseEther((stakedAmount / 2).toString()),
          [1, 3]
        );

      let balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(parseInt(ethers.utils.formatEther(balanceAfter))).to.greaterThan(
        parseInt(ethers.utils.formatEther(balanceBefore))
      );
    });
  });
});
