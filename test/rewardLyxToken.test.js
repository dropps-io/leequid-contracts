const { ethers } = require('hardhat');
const { getTestDepositData } = require('./utils');
const { expect } = require('chai');

describe('Oracles contract', function () {
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
  let admin, user1, user2, user3, user4;

  before(async function () {
    RewardLyxToken = await ethers.getContractFactory('RewardLyxToken');
    StakedLyxToken = await ethers.getContractFactory('StakedLyxToken');
    MerkleDistributor = await ethers.getContractFactory('MerkleDistributor');
    FeesEscrow = await ethers.getContractFactory('FeesEscrow');
    Pool = await ethers.getContractFactory('Pool');
    Oracles = await ethers.getContractFactory('Oracles');
    PoolValidators = await ethers.getContractFactory('PoolValidators');
    DepositContract = await ethers.getContractFactory('DepositContract');
    [admin, oracles, operator, user1, user2, user3, user4] =
      await ethers.getSigners();
  });

  beforeEach(async function () {
    rewardLyxToken = await RewardLyxToken.deploy();
    stakedLyxToken = await StakedLyxToken.deploy();
    pool = await Pool.deploy();
    poolValidators = await PoolValidators.deploy();
    merkleDistributor = await MerkleDistributor.deploy();
    oracles = await Oracles.deploy();
    feesEscrow = await FeesEscrow.deploy(pool.address, rewardLyxToken.address);
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
      merkleDistributor.address,
      feesEscrow.address
    );

    await stakedLyxToken
      .connect(admin)
      .initialize(admin.address, pool.address, rewardLyxToken.address, false);

    await pool
      .connect(admin)
      .initialize(
        admin.address,
        stakedLyxToken.address,
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
          ethers.utils.parseEther(
            ((newTotalRewards * (1 - protocolFee)) / stakedAmount).toString()
          ),
          ethers.utils.parseEther((totalRewards * protocolFee).toString()),
          ethers.utils.parseEther((totalRewards * protocolFee).toString())
        );
    });
  });
});
