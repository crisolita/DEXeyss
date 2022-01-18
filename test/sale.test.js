const IStakeContract = require("./IStakingRewards.json");
const { artifacts } = require("hardhat");
const Sale = artifacts.require("Sale");
const StakingRewardsFactory = artifacts.require("StakingRewardsFactory");
const Token = artifacts.require("BBCNToken");
const { Provider } = require("@ethersproject/abstract-provider");

/**Token deployed to: 0xaB97b0eEA567Bf8c5eEC65DE489F8faeF13646Af
1641526899355
Sale deployed to: 0xa3910E54B609881AE689d6faf5497472ca043C1A
StakingRewardsFactory deployed to: 0xBD66934E02BbEa25F1f8cFC69A7369084ca3d926
stakigRewards= 0xa390570e9bb65d972269c433fC2aFCeCA2be9031*/

const {
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { expect } = require("chai");
const { latest } = require("@openzeppelin/test-helpers/src/time");

const BNB = "0xb8c77482e45f1f44de1745f52c74426c631bdd52";

// this function include the decimals
toBN = (num) => web3.utils.toBN(num + "0".repeat(18));

toWei = (num) => web3.utils.toWei(num);
fromWei = (num) => web3.utils.fromWei(num);

contract("Sale", ([owner, user, admin1, admin2]) => {
  let token, sale, factory, genesis;

  beforeEach(async function () {
    const maxSupply = toBN(10000);
    const chainLinkAddress = "0x14e613AC84a31f709eadbdF89C6CC390fDc9540A";
    token = await Token.new({ from: owner });
    sale = await Sale.new({ from: owner });
    sale.initialize(maxSupply, owner, token.address, chainLinkAddress, {
      from: owner,
    });
    genesis = (await time.latest()) + 1;
    factory = await StakingRewardsFactory.new(token.address, genesis);

    await token.mint(owner, maxSupply, { from: owner });
    await token.approve(sale.address, maxSupply, { from: owner });
  });
  it("Create first phase", async function () {
    const price = "5" /** 5$ per token*/,
      min = toBN(2);
    (supply = toBN(5000)),
      (dateEndPhase =
        Number(await time.latest()) + 3600) /** the phase will last one hour */;

    const tx = await sale.createPhase(
      true,
      min,
      price,
      dateEndPhase,
      supply,
      25,
      {
        from: owner,
      }
    );

    const phase = await sale.phases(1);

    /** checking that the phase is created */
    expect(phase.price.toString()).to.equal(
      price.toString(),
      "Phase price err"
    );
    expect(Number(phase.minimunEntry)).to.equal(
      Number(min),
      "Phase minimunEntry err"
    );
    expect(Number(phase.endAt)).to.equal(
      Number(dateEndPhase),
      "Phase ends err"
    );
    expect(Number(phase.supply)).to.equal(Number(supply), "Phase supply err");
  });
  it("Create first phase, buy tokens, cancel phase (by owner) and created another phase to buy", async function () {
    const price = toBN(5) /** toBN(5) per TOKEN */,
      min = toBN(2);
    (supply = toBN(500)),
      (dateEndPhase =
        Number(await time.latest()) + 3600) /** the phase will last one hour */;

    const tx = await sale.createPhase(
      true,
      min,
      price,
      dateEndPhase,
      supply,
      25,
      {
        from: owner,
      }
    );

    await expectRevert(
      sale.createPhase(true, min, price, dateEndPhase, supply, 25, {
        from: owner,
      }),
      "This phase isn't over"
    );
    expect((await token.balanceOf(user)).toString()).to.equal("0");
    await sale.buyToken(toBN(25), { from: user, value: toBN(1) });

    await sale.cancelPhase();

    await sale.createPhase(true, min, price, dateEndPhase, supply, 0, {
      from: owner,
    });

    await sale.buyToken(toBN(25), { from: user, value: toBN(5) });

    expect((await token.balanceOf(user)).toString()).to.equal(
      toBN(25).toString()
    );

    await time.increase(time.duration.days(2));

    await sale.release(1, { from: user });

    expect((await token.balanceOf(user)).toString()).to.equal(
      toBN(50).toString()
    );
  });

  it("Errors creating phases", async function () {
    const maxSupply = toBN(1000);

    /// err end date is now less one second
    await expectRevert(
      sale.createPhase(
        true,
        toBN(2),
        1,
        (await time.latest()) - 1,
        toBN(1),
        25,
        {
          from: owner,
        }
      ),
      "The end of the phase should be greater than now"
    );
    /// err more that maxSupply (the current supply is maxSupply - phase one original supply)
    await expectRevert(
      sale.createPhase(
        true,
        toBN(1),
        1,
        (await time.latest()) + 1,
        maxSupply + 20,
        25,
        {
          from: owner,
        }
      ),
      "Not enough supply to mint"
    );

    await expectRevert(
      sale.createPhase(
        true,
        toBN(1),
        1,
        (await time.latest()) + 1,
        maxSupply + 20,
        25,
        {
          from: user,
        }
      ),
      `AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
    );
  });

  it("Should release token in the rigth time", async function () {
    const price = 5 /** 5$ per token */,
      min = toBN(2);
    (supply = toBN(5000)),
      (dateEndPhase =
        Number(await time.latest()) +
        time.duration.days(10)) /** the phase will last one hour */,
      (timeLock = 3600);

    await sale.createPhase(true, min, price, dateEndPhase, supply, timeLock, {
      from: owner,
    });

    const currentPhaseNumber = Number(await sale.currentPhase());

    const id = 1;

    const preUserBalance = Number(await token.balanceOf(user));
    const prePhaseSupply = Number(
      (await sale.phases(currentPhaseNumber)).supply
    );

    await sale.buyToken(toBN("400"), {
      from: user,
      value: toWei("162"),
    });

    await expectRevert(
      sale.release(id, { from: user }),
      "TokenTimelock: current time is before release time"
    );

    await time.increase(time.duration.days(6));

    await sale.release(id, { from: user });

    const postUserBalance = Number(await token.balanceOf(user));

    const posPhaseSupply = Number(
      (await sale.phases(currentPhaseNumber)).supply
    );

    expect(preUserBalance).to.equal(0, "user phase one pre balance err");

    // /// check the user have the token
    expect(postUserBalance).to.equal(
      Number(toBN("400")),
      "user phase one pos balance err"
    );
    // /// check the phase supply decrase
    expect(prePhaseSupply).to.equal(
      posPhaseSupply + Number(toBN("400")),
      "supply phase one balance err"
    );
  });

  it("Should end the phase (supply out)", async function () {
    const dateEndPhase = Number(await time.latest()) + time.duration.days(1),
      supply = toBN(2500),
      isPublic = true,
      min = toBN(2),
      price = toBN(5);

    await sale.createPhase(isPublic, min, price, dateEndPhase, supply, 25, {
      from: owner,
    });

    const currentPhaseNumber = await sale.currentPhase();

    amountOfTokens = toBN(3);

    // call the ETH/BNB needed to this operation
    const ethNeeded = price.mul(supply).div(await sale.getLatestPrice());

    // / err not enought ETH/BNB
    await expectRevert(
      sale.buyToken((await sale.phases(currentPhaseNumber)).supply, {
        from: user,
        value: ethNeeded - 1,
      }),
      "Not enough ETH/BNB"
    );
    /// Err not enought tokens.
    await expectRevert(
      sale.buyToken(toBN(1), { from: user, value: ethNeeded }),
      "There are too few tokens"
    );

    await sale.buyToken((await sale.phases(currentPhaseNumber)).supply, {
      from: user,
      value: ethNeeded,
    });

    // Check that the initial phase is over
    assert.isTrue(
      Boolean((await sale.phases(currentPhaseNumber)).over),
      "The phase is over"
    );

    // check supply
    expect(Number((await sale.phases(0)).supply)).to.equal(
      0,
      "Not enought supply"
    );
  });

  it("Only the two admins can access to the private phase", async function () {
    const dateEndPhase = Number(await time.latest()) + time.duration.days(10),
      supply = await sale.tokensRemainForSale();

    await sale.createPhase(false, toBN(2), 5, dateEndPhase, supply, 25, {
      from: owner,
    });

    const currentPhaseNumber = Number(await sale.currentPhase());

    // add the admin to a whitelist
    await sale.addToWhitelist([admin1, admin2]);

    // the ordinary user cannot buy because the phase is private

    await expectRevert(
      sale.buyToken(toBN(2), { from: user, value: toBN(20) }),
      "This phase is private"
    );
  });

  it("Only owner can cancel the phase", async function () {
    const dateEndPhase = Number(await time.latest()) + time.duration.days(1),
      supply = await sale.tokensRemainForSale();

    await sale.createPhase(true, toBN(2), 5, dateEndPhase, supply, 25, {
      from: owner,
    });

    const currentPhaseNumber = Number(await sale.currentPhase());

    await expectRevert(
      sale.cancelPhase({ from: user }),
      "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    await sale.cancelPhase({ from: owner });
    assert.isTrue(
      Boolean((await sale.phases(currentPhaseNumber)).over),
      "The phase is over"
    );
  });

  it("Should end the phase (time out)", async function () {
    const dateEndPhase = Number(await time.latest()) + 3600,
      supply = toBN(2500),
      isPublic = true,
      min = toBN(1),
      price = 10;

    await sale.createPhase(isPublic, min, price, dateEndPhase, supply, 25, {
      from: owner,
    });

    amountOfTokens = toBN(3);

    //increase time to end the phase
    await time.increase(time.duration.days(50));

    await expectRevert(
      sale.buyToken(amountOfTokens, { from: user, value: toBN(10) }),
      "This phase is over, wait for the next"
    );
  });

  it("Should recieve the purchase event and release event", async function () {
    const price = 278934 /** 278934$ per token*/,
      min = toBN("9");
    (supply = toBN(5000)),
      (dateEndPhase =
        Number(await time.latest()) +
        time.duration.days(10)) /** the phase will last one hour */,
      (timeLock = 3600);

    await sale.createPhase(true, min, price, dateEndPhase, supply, timeLock, {
      from: owner,
    });

    const id = "1";

    const shop = await sale.buyToken(toBN("10"), {
      from: user,
      value: toWei("10"),
    });

    expectEvent(shop, "Purchase", {
      _account: user,
      _amount: toBN("10"),
      _id: id,
    });

    await time.increase(time.duration.days(6));

    const release = await sale.release(id, { from: user });

    expectEvent(release, "Claims", { _id: id });
  });

  it("Should release the tokens and transfers to user", async function () {
    const dateEndPhase = Number(await time.latest()) + time.duration.days(5),
      supply = toBN(2500),
      isPublic = true,
      min = toBN(1),
      price = 10;

    await sale.createPhase(isPublic, min, price, dateEndPhase, supply, 6800, {
      from: owner,
    });

    amountOfTokens = toBN(3);

    await sale.buyToken(amountOfTokens, { from: user, value: toWei("10") });

    expect((await token.balanceOf(user)).toString()).to.equal("0");

    //increase time to end the timeLock
    await time.increase(8000);

    // release the tokens to user
    await sale.release(1, { from: user });

    //check the tokens balances
    expect((await token.balanceOf(user)).toString()).to.equal(
      amountOfTokens.toString()
    );
  });

  it("The owner can deploy and update the stake", async function () {
    const _stakingToken = token.address,
      _rewardsAmount = 50,
      _rewardsDuration = 8000;

    await factory.deploy(_stakingToken, _rewardsAmount, _rewardsDuration);

    const stk = await factory.stakingRewardsInfoByStakingToken(token.address);

    expect(stk.duration.toString()).to.equal("8000");
    expect(stk.rewardAmount.toString()).to.equal("50");

    await factory.update(_stakingToken, 80, 9000);

    const stk2 = await factory.stakingRewardsInfoByStakingToken(token.address);

    expect(stk2.duration.toString()).to.equal("9000");
    expect(stk2.rewardAmount.toString()).to.equal("80");
  });

  it("Users can stake their tokens and receive rewards", async function () {
    const dateEndPhase = Number(await time.latest()) + time.duration.days(5),
      supply = toBN(2500),
      isPublic = true,
      min = toBN(1),
      price = 10;

    await sale.createPhase(isPublic, min, price, dateEndPhase, supply, 6800, {
      from: owner,
    });

    amountOfTokens = toBN(3);

    await sale.buyToken(amountOfTokens, { from: user, value: toWei("10") });

    expect((await token.balanceOf(user)).toString()).to.equal("0");

    //increase time to end the timeLock
    await time.increase(8000);

    // release the tokens to user
    await sale.release(1, { from: user });

    //check the tokens balances
    expect((await token.balanceOf(user)).toString()).to.equal(
      amountOfTokens.toString()
    );

    const _stakingToken = token.address,
      _rewardsAmount = toBN("50"),
      _rewardsDuration = (await time.latest()) + 500;

    await token.transfer(factory.address, toBN("50"));
    //the owner create the stake
    await factory.deploy(_stakingToken, _rewardsAmount, _rewardsDuration);

    await time.increaseTo(genesis + 1);

    await factory.notifyRewardAmounts({ from: admin2 });

    const stk = (await factory.stakingRewardsInfoByStakingToken(token.address))
      .stakingRewards;
    var stakeContract = new web3.eth.Contract(IStakeContract, stk.toString());

    await token.approve(stk, toBN("2"), { from: user });

    await stakeContract.methods.stake(toBN("2")).send({ from: user });

    await time.increase(time.duration.days(10));

    const balanceOfUserBeforeClaim = await token.balanceOf(user);

    const tx = await stakeContract.methods.getReward().send({ from: user });

    const earned = web3.utils.toBN(parseInt(tx.events[0].raw.data, 16));

    const balanceOfUser = await token.balanceOf(user);

    expect(balanceOfUser.toString()).to.equal(
      balanceOfUserBeforeClaim.add(earned).toString()
    );

    const now = (await time.latest()) + time.duration.minutes(8);
  });
});
