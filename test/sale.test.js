const { artifacts } = require("hardhat");
const Sale = artifacts.require("Sale");
const StakingRewardsFactory = artifacts.require("StakingRewardsFactory");
const Token = artifacts.require("Token");



const {
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { expect } = require("chai");

const BNB = '0xb8c77482e45f1f44de1745f52c74426c631bdd52';



// this function include the desimals
toBN = (num) => web3.utils.toBN(num + "0".repeat(18));

toWei = (num) => web3.utils.toWei(num);
fromWei = (num) => web3.utils.fromWei(num);

contract("Sale", ([owner, user,admin1,admin2]) => {
  let token, sale, factory;
 
  beforeEach(async function () {
    const maxSupply = toBN(10000);
    token = await Token.new();
    sale = await Sale.new(maxSupply, owner, token.address, {
      from: owner,
    });
    factory = await StakingRewardsFactory.new(token.address,'135057580000');
  
    await token.mint(maxSupply, {from: owner});
    await token.approve(sale.address, maxSupply, {from: owner});
  });
  it("Create first phase", async function () {
    const discount = 505 /** 50.5% */,
    maxSupply = toBN(10000),
    price = 5 /** 1 ETH/BNB = 5 Tokens */,
    min = toBN(2);
    supply = toBN(5000),
    dateEndPhase =
    Number(await time.latest()) + 3600 /** the phase will last one hour */;

    const tx = await sale.createPhase(true,min,price,discount,dateEndPhase,supply,25,{
        from: owner,
      });
    
      const phase = await sale.phases(0);

      /** checking that the phase is created */
      expect(Number(phase.discount)).to.equal( Number(discount));
      expect(Number(phase.price)).to.equal(price, "Phase price err");
      expect(Number(phase.minimunEntry)).to.equal(Number(min), "Phase minimunEntry err");
      expect(Number(phase.endAt)).to.equal(Number(dateEndPhase), "Phase ends err");
      expect(Number(phase.supply)).to.equal(Number(supply), "Phase supply err");
      /** checking that the contract decrease the supply */
      expect(Number(await sale.supply())).to.equal(
        maxSupply - supply,
        "Contract dicrease supply err"
      );

    });


  it("Errors creating phases", async function () {
    /// err 200% discount
    await expectRevert(
      sale.createPhase(true,toBN(2),5,2000, (await time.latest()) + 1, toBN(1),25, {
        from: owner,
      }),
      "Discount cannot be greater than 100%"
    );
    /// err end date is now less one second
    await expectRevert(
      sale.createPhase(true,toBN(2),2000,1, (await time.latest()) - 1, toBN(1),25, {
        from: owner,
      }),
      "The end of the phase should be greater than now"
    );
    /// err more that maxSupply (the current supply is maxSupply - phase one original supply)
   const maxSupply = toBN(10000);
    await expectRevert(
      sale.createPhase(true,toBN(1),200,1, (await time.latest()) + 1, maxSupply+20,25,{
        from: owner,
      }),
      "Not enough supply to mint"
    );
  });
  
  

  it("Should release token in the rigth time", async function () {
    const discount = 505 /** 50.5% */,
    maxSupply = toBN(10000),
    price = 5 /** 1 ETH/BNB = 5 Tokens */,
    min = toBN(2);
    supply = toBN(5000),
    dateEndPhase =
    Number(await time.latest()) + time.duration.days(10) /** the phase will last one hour */,
    timeLock = 3600;

    await sale.createPhase(true,min,price,discount,dateEndPhase,supply,timeLock,{
        from: owner,
      });
    
    const currentPhaseNumber = Number(await sale.currentPhase());

    const id =0;

    const preUserBalance = Number(await token.balanceOf(user));
    const prePhaseSupply = Number(
      (await sale.phases(currentPhaseNumber)).supply
    );

    await sale.buyToken(toBN("400"), {
      from: user,
      value: toWei("160.5"),
    });

    await expectRevert(
      sale.release(id, {from: user}),
      "TokenTimelock: current time is before release time"
    );


    await time.increase(time.duration.days(6));

    await sale.release(id, {from: user});

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
    const discount = 505,
    dateEndPhase = Number(await time.latest()) + time.duration.days(1),
    supply = toBN(2500),
    isPublic = true,
    min = toBN(2),
    price = 10;

    await sale.createPhase(isPublic,min,price, discount,dateEndPhase,supply,25,{from: owner});

    const currentPhaseNumber = await sale.currentPhase();

  
    amountOfTokens = toBN(3);

    // call the ETH/BNB needed to this operation
    const ethNeeded =
      Math.ceil(Number((await sale.phases(currentPhaseNumber)).supply) /
      (Number((await sale.phases(currentPhaseNumber)).price) *
        (1000 -
          Number((await sale.phases(currentPhaseNumber)).discount))) /
      1000);
    // / err not enought ETH/BNB
    await expectRevert(
      sale.buyToken(
        (await sale.phases(currentPhaseNumber)).supply,
        { from: user, value: ethNeeded - 1000 }
      ),
      "Not enough ETH/BNB"
    );
    /// Err not enought tokens.
    await expectRevert(
      sale.buyToken(
        toBN(1),
        { from: user, value: ethNeeded }
      ),
      "There are too few tokens"
    );

    await sale.buyToken(
      (await sale.phases(currentPhaseNumber)).supply, 
      { from: user, value: ethNeeded }
    );

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
  
    const discount = 0,
    dateEndPhase =
    Number(await time.latest()) + time.duration.days(10),
    supply = (await sale.supply());
    
    await sale.createPhase(false,toBN(2),5,discount, dateEndPhase, supply,25, {
      from: owner,
    });   

    const currentPhaseNumber = Number(await sale.currentPhase());

    // add the admin to a whitelist
    await sale.addToWhitelist(admin1);


    // the ordinary user cannot buy because the phase is private

    await expectRevert(sale.buyToken(toBN(2), {from:user, value:toBN(20)}), "This phase is private");
    

    });

    it("Only owner can cancel the phase", async function () {
    
      const discount = 0,
      dateEndPhase =
      Number(await time.latest()) + time.duration.days(1),
      supply = (await sale.supply());
      
      await sale.createPhase(true,toBN(2),5,discount, dateEndPhase, supply,25, {
        from: owner,
      });   

      const currentPhaseNumber = Number(await sale.currentPhase());
      
      await expectRevert(
        sale.cancelPhase({from: user}),
        "Ownable: caller is not the owner"
        );

      await sale.cancelPhase({from:owner});
      assert.isTrue(
        Boolean((await sale.phases(currentPhaseNumber)).over),
        "The phase is over"
      );
      });
      
      it("Should end the phase (time out)", async function () {
      
        const discount = 0,
        dateEndPhase = Number(await time.latest()) + 3600,
        supply = toBN(2500),
        isPublic = true,
        min = toBN(1),
        price = 10;
    
        await sale.createPhase(isPublic,min,price, discount,dateEndPhase,supply,25,{from: owner});
    
        amountOfTokens = toBN(3);
    
        //increase time to end the phase
        await time.increase(time.duration.days(50));

        await expectRevert(
          sale.buyToken(amountOfTokens,{from:user, value:toBN(10)}),
          "This phase is over, wait for the next"
        );
        });

        it("Should recieve the purchase event and release event", async function () {
          const maxSupply = toBN(10000),
            price = 278934 /** 1 ETH/BNB = 5 Tokens */,
            min = toBN('9');
            supply = toBN(5000),
            dateEndPhase =
            Number(await time.latest()) + time.duration.days(10) /** the phase will last one hour */,
            timeLock = 3600;
        
            await sale.createPhase(true,min,price,0,dateEndPhase,supply,timeLock,{
                from: owner,
              });
        
            const id = toBN('0');
        
  
          
          const shop = await sale.buyToken(toBN('10'),{from: user, value:toWei('10')});

          expectEvent(shop, "Purchase",{_account:user,_amount:toBN('10'),_price: 'price',_id:id});

          await time.increase(time.duration.days(6));

         const release = await sale.release(id, {from: user});

          expectEvent(release, "Claims",{_id: id});



          });
          it("Should release the tokens and transfers to user", async function () {
      
            const discount = 0,
            dateEndPhase = Number(await time.latest()) + 3600,
            supply = toBN(2500),
            isPublic = true,
            min = toBN(1),
            price = 10;
        
            await sale.createPhase(isPublic,min,price, discount,dateEndPhase,supply,25,{from: owner});
        
            amountOfTokens = toBN(3);
        
            //increase time to end the phase
            await time.increase(time.duration.days(5));
    
            });

            it("Should release the tokens and transfers to user", async function () {
      
              const discount = 0,
              dateEndPhase = Number(await time.latest()) + time.duration.days(5),
              supply = toBN(2500),
              isPublic = true,
              min = toBN(1),
              price = 10;
          
              await sale.createPhase(isPublic,min,price, discount,dateEndPhase,supply,6800,{from: owner});
          
              amountOfTokens = toBN(3);
          

              await sale.buyToken(amountOfTokens,{from: user, value:toWei('10')});

              expect((await token.balanceOf(user)).toString()).to.equal('0');
              
              //increase time to end the timeLock
              await time.increase(8000);

            // release the tokens to user
              await sale.release(0,{from:user});

              //check the tokens balances
              expect((await token.balanceOf(user)).toString()).to.equal(amountOfTokens.toString());


      
              });

    
                it("The owner can deploy and update the stake", async function () {

                const _stakingToken = token.address,
                _rewardsAmount = 50,
                _rewardsDuration = 8000;

                await factory.deploy(_stakingToken, _rewardsAmount,_rewardsDuration);
    
                const stk = await factory.stakingRewardsInfoByStakingToken(token.address);

                expect(stk.duration.toString()).to.equal('8000');
                expect(stk.rewardAmount.toString()).to.equal('50');
                
                await factory.update(_stakingToken,80,9000);

                const stk2 = await factory.stakingRewardsInfoByStakingToken(token.address);
                
                expect(stk2.duration.toString()).to.equal('9000');
                expect(stk2.rewardAmount.toString()).to.equal('80');
                            
                  });

                  it("Users can stake their tokens", async function () {
      
                    const discount = 0,
                    dateEndPhase = Number(await time.latest()) + time.duration.days(5),
                    supply = toBN(2500),
                    isPublic = true,
                    min = toBN(1),
                    price = 10;
                
                    await sale.createPhase(isPublic,min,price, discount,dateEndPhase,supply,6800,{from: owner});
                
                    amountOfTokens = toBN(3);
                
      
                    await sale.buyToken(amountOfTokens,{from: user, value:toWei('10')});
      
                    expect((await token.balanceOf(user)).toString()).to.equal('0');
                    
                    //increase time to end the timeLock
                    await time.increase(8000);
      
                  // release the tokens to user
                    await sale.release(0,{from:user});
      
                    //check the tokens balances
                    expect((await token.balanceOf(user)).toString()).to.equal(amountOfTokens.toString());

                    const _stakingToken = token.address,
                    _rewardsAmount = 50,
                    _rewardsDuration = 8000;

                    //the owner create the stake 
                    await factory.deploy(_stakingToken, _rewardsAmount,_rewardsDuration);

                    const stk = (await factory.stakingRewardsInfoByStakingToken(token.address)).stakingRewards;


        
      
            
                    });
  

           
          
      });

    