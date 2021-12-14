const Sale = artifacts.require("Sale");
const Token = artifacts.require("Token");
const {
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");


import chai, {expect} from 'chai';
import {solidity} from 'ethereum-waffle';

chai.use(solidity);

// this function include the desimals
toBN = (num) => web3.utils.toBN(num + "0".repeat(18));

toWei = (num) => web3.utils.toWei(num);
fromWei = (num) => web3.utils.fromWei(num);

contract("Sale", ([owner, user,admin1,admin2]) => {
  let token, sale;
 
  beforeEach(async function () {
    const maxSupply = toBN(10000);
    token = await Token.new();
    sale = await Sale.new(maxSupply, owner, token.address, {
      from: owner,
    });
  
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
      assert.equal(Number(phase.discount), discount, "Phase discount err");
      assert.equal(Number(phase.price), price, "Phase price err");
      assert.equal(Number(phase.minimunEntry), min, "Phase minimunEntry err");
      assert.equal(Number(phase.endAt), dateEndPhase, "Phase ends err");
      assert.equal(Number(phase.supply), supply, "Phase supply err");
      /** checking that the contract decrease the supply */
      assert.equal(
        Number(await sale.supply()),
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
  
    assert.equal(preUserBalance, 0, "user phase one pre balance err");

    // /// check the user have the token
    assert.equal(
      postUserBalance,
      Number(toBN("400")),
      "user phase one pos balance err"
    );
    // /// check the phase supply decrase
    assert.equal(
      prePhaseSupply,
      posPhaseSupply + Number(toBN("400")),
      "supply phase one balance err"
    );
  });



  it("Should end the phase (supply out)", async function () {
    const discount = 0,
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
        { from: user, value: ethNeeded - 10 }
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
    assert.equal(
      Number((await sale.phases(0)).supply),
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
        dateEndPhase = Number(await time.latest()) + Number(time.duration.days(1)),
        supply = toBN(2500),
        isPublic = true,
        min = toBN(1),
        price = 10;
    
        await sale.createPhase(isPublic,min,price, discount,dateEndPhase,supply,25,{from: owner});
    
        amountOfTokens = toBN(3);
    
        //increase time to end the phase
        await time.increase(time.duration.days(5));

    
        await expectRevert(
          sale.buyToken(amountOfTokens,{from:user, value:toBN(10)}),
          "This phase is over, wait for the next"
        );
        });

        it("Should recieve the purchase event and release event", async function () {
          const discount = 505 /** 50.5% */,
            maxSupply = toBN(10000),
            price = 5 /** 1 ETH/BNB = 5 Tokens */,
            min = 9;
            supply = toBN(5000),
            dateEndPhase =
            Number(await time.latest()) + time.duration.days(10) /** the phase will last one hour */,
            timeLock = 3600;
        
            await sale.createPhase(true,min,price,discount,dateEndPhase,supply,timeLock,{
                from: owner,
              });
        
            const id =0;
        
            const finalPrice = (10/price)*(
                  (1000 - discount)/ 1000);
          
          const shop = await sale.buyToken(10,{from: user, value:toWei('10')});

          await time.increase(time.duration.days(6));

         const release = await sale.release(id, {from: user});
          
          // expect(release
          //   ).to.emit(sale,"Claims")
          //   .withArgs(user,id); 


          //   expect(shop
          //     ).to.emit(sale,"Purchase")
          //     .withArgs(user,10,finalPrice,id); 


          });

           
          
      });

    