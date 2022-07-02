import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, smock } from '@defi-wonderland/smock'

import {
  IStaking,
  IERC20,
  IKarsha,
  PanaERC20Token,
  PanaERC20Token__factory,
  SPana,
  SPana__factory,
  Karsha,
  PanaAuthority__factory,
  ITreasury,
  PanaStaking,
  PanaStaking__factory,
  Karsha__factory
} from '../../types';
import { BigNumber } from "ethers";

const TOTAL_GONS = BigInt(5000000000000000000000000);
const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");
const EPOCH_LENGTH = 2200;
const EPOCH_NUMBER = 1;
const FUTURE_END_TIME = 1022010000; // an arbitrary future block timestamp
const bigNumberRepresentation = (number:any) => {
  return ethers.BigNumber.from(number.toString());
};
const decimalRepresentation = (value:any, decimals:any) => {
  return bigNumberRepresentation(value*(10**decimals));
};
const decimalRepresentation_1 = (value:any, decimals:any=18) => {
  return (value*(10**decimals));
};

describe("sPana", () => {
  let initializer: SignerWithAddress;
  let stakingAddress: SignerWithAddress;
  let stakingAddress1: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let pana: PanaERC20Token;
  let sPana: SPana;
  let karsha: Karsha;
  let karshaFake: FakeContract<Karsha>;
  let stakingFake: FakeContract<IStaking>;
  let staking: PanaStaking;  
  let treasuryFake: FakeContract<ITreasury>;

  beforeEach(async () => {
    [initializer, alice, bob,stakingAddress,stakingAddress1] = await ethers.getSigners();
    stakingFake = await smock.fake<IStaking>('IStaking');
    stakingFake.attach(stakingAddress.address); 
    treasuryFake = await smock.fake<ITreasury>('ITreasury');
    karshaFake = await smock.fake<Karsha>('Karsha');     
    const authority = await (new PanaAuthority__factory(initializer)).deploy(initializer.address, initializer.address, initializer.address, initializer.address, ZERO_ADDRESS);
    pana = await (new PanaERC20Token__factory(initializer)).deploy(authority.address);
    sPana = await (new SPana__factory(initializer)).deploy();
    karsha = await (new Karsha__factory(initializer)).deploy(initializer.address,sPana.address);
    karsha.migrate(stakingAddress.address,sPana.address);
    staking = await new PanaStaking__factory(initializer).deploy(
      pana.address,
      sPana.address,
      karshaFake.address,      
      authority.address
  );  
  });

  it("is constructed correctly", async () => {
    expect(await sPana.name()).to.equal("Staked PANA");
    expect(await sPana.symbol()).to.equal("sPANA");
    expect(await sPana.decimals()).to.equal(18);
  });

  describe("initialization", () => {
    describe("setIndex", () => {
      it("sets the index", async () => {
        await sPana.connect(initializer).setIndex(3);
        expect(await sPana.index()).to.equal(3);
      });

      it("must be done by the initializer", async () => {
        await expect(sPana.connect(alice).setIndex(3)).to.be.reverted;
      });

      it("cannot update the index if already set", async () => {
        await sPana.connect(initializer).setIndex(3);
        await expect(sPana.connect(initializer).setIndex(3)).to.be.reverted;
      });
    });

    describe("setKarsha", () => {
      it("sets karshaFake", async () => {
        await sPana.connect(initializer).setKarsha(karshaFake.address);
        expect(await sPana.KARSHA()).to.equal(karshaFake.address);
      });

      it("must be done by the initializer", async () => {
        await expect(sPana.connect(alice).setKarsha(karshaFake.address)).to.be.reverted;
      });

      it("won't set karshaFake to 0 address", async () => {
        await expect(sPana.connect(initializer).setKarsha(ZERO_ADDRESS)).to.be.reverted;
      });
    });

    describe("initialize", () => {
      it("assigns TOTAL_GONS to the stakingFake contract's balance", async () => {
        await sPana.connect(initializer).initialize(stakingFake.address, treasuryFake.address,initializer.address);        
        expect((await sPana.balanceOf(stakingFake.address)).toBigInt()/BigInt(10**9)).to.equal((TOTAL_GONS/BigInt(10**9)));
      });

      // it("emits Transfer event", async () => {
      //   await expect(sPana.connect(initializer).initialize(stakingFake.address, treasuryFake.address)).
      //     to.emit(sPana, "Transfer").withArgs(ZERO_ADDRESS, stakingFake.address, 5_000_000*(10**18));
      // });

      it("emits LogStakingContractUpdated event", async () => {
        await expect(sPana.connect(initializer).initialize(stakingFake.address, treasuryFake.address,initializer.address)).
          to.emit(sPana, "LogStakingContractUpdated").withArgs(stakingFake.address);
      });

      it("unsets the initializer, so it cannot be called again", async () => {
        await sPana.connect(initializer).initialize(stakingFake.address, treasuryFake.address,initializer.address);
        await expect(sPana.connect(initializer).initialize(stakingFake.address, treasuryFake.address,initializer.address)).to.be.reverted;
      });
    });
  });

  describe("post-initialization", () => {
    beforeEach(async () => {
      await sPana.connect(initializer).setIndex(1);
      await sPana.connect(initializer).setKarsha(karshaFake.address);
      await sPana.connect(initializer).initialize(stakingFake.address, treasuryFake.address,initializer.address);
    });

        describe("approve", () => {
      it("sets the allowed value between sender and spender", async () => {
        await sPana.connect(alice).approve(bob.address, 10);
        expect(await sPana.allowance(alice.address, bob.address)).to.equal(10);
      });

      it("emits an Approval event", async () => {
        await expect(await sPana.connect(alice).approve(bob.address, 10)).
          to.emit(sPana, "Approval").withArgs(alice.address, bob.address, 10);
      });
    });

    describe("increaseAllowance", () => {
      it("increases the allowance between sender and spender", async () => {
        await sPana.connect(alice).approve(bob.address, 10);
        await sPana.connect(alice).increaseAllowance(bob.address, 4);

        expect(await sPana.allowance(alice.address, bob.address)).to.equal(14);
      });

      it("emits an Approval event", async () => {
        await sPana.connect(alice).approve(bob.address, 10);
        await expect(await sPana.connect(alice).increaseAllowance(bob.address, 4)).
          to.emit(sPana, "Approval").withArgs(alice.address, bob.address, 14);
      });      
    });

    describe("decreaseAllowance", () => {
      it("decreases the allowance between sender and spender", async () => {
        await sPana.connect(alice).approve(bob.address, 10);
        await sPana.connect(alice).decreaseAllowance(bob.address, 4);

        expect(await sPana.allowance(alice.address, bob.address)).to.equal(6);
      });

      it("will not make the value negative", async () => {
        await sPana.connect(alice).approve(bob.address, 10);
        await sPana.connect(alice).decreaseAllowance(bob.address, 11);

        expect(await sPana.allowance(alice.address, bob.address)).to.equal(0);
      });

      it("emits an Approval event", async () => {
        await sPana.connect(alice).approve(bob.address, 10);
        await expect(await sPana.connect(alice).decreaseAllowance(bob.address, 4)).
          to.emit(sPana, "Approval").withArgs(alice.address, bob.address, 6);
      });
    });

    describe("circulatingSupply", () => {
      it("is zero when all owned by stakingFake contract", async () => {
        //await stakingFake.supplyInLocked.returns(0);
        await karshaFake.totalSupply.returns(0);
        await karshaFake.balanceFrom.returns(0);

        const totalSupply = await sPana.circulatingSupply();
        expect(totalSupply).to.equal(0);
      });

      it("includes all supply owned by karshaFake", async () => {
       // await stakingFake.supplyInLocked.returns(0);
        await karshaFake.totalSupply.returns(10);
        await karshaFake.balanceFrom.returns(10);

        const totalSupply = await sPana.circulatingSupply();
        expect(totalSupply).to.equal(10);
      });      
      // it("includes all supply in warmup in stakingFake contract", async () => {
      //   await stakingFake.supplyInLocked.returns(50);
      //   await karshaFake.totalSupply.returns(0);
      //   await karshaFake.balanceFrom.returns(0);

      //   const totalSupply = await sPana.circulatingSupply();
      //   expect(totalSupply).to.equal(50);
      // });
    });
    
  });  
  describe("balance Method validataion", () => {
    beforeEach(async () => {
      await sPana.connect(initializer).setIndex(BigInt(decimalRepresentation_1(1,18)));
      await sPana.connect(initializer).setKarsha(karsha.address);
      await sPana.connect(initializer).initialize(stakingFake.address, treasuryFake.address,initializer.address);
    });
    it("balanceTo = (amount*decimal)/index", async () => { 
      let amount_ = BigInt(decimalRepresentation_1(100,18));
      let balanceTo_ =(await sPana.toKARSHA(amount_)).toBigInt();
      let index = (await (sPana.index())).toBigInt();
      let decimalVal = BigInt(String((10**(await sPana.decimals())))); 
      expect(balanceTo_).to.equal((amount_*decimalVal)/index);
    });
    it("balanceFrom  = (amount/decima1)*index", async () => {  
      let amount_ = BigInt(decimalRepresentation_1(100,18));    
      let balanceFrom_ =(await sPana.fromKARSHA(amount_)).toBigInt();   
      let index = (await (sPana.index())).toBigInt();
      let decimalVal = BigInt(String((10**(await sPana.decimals())))); 
      expect(balanceFrom_).to.equal((amount_*index)/decimalVal);
    });

  });
  //staking contract going to removes rebases validation- commented below
  // describe("post-initialization-transfer", () => {
  //   beforeEach(async () => {
  //     await sPana.connect(initializer).setIndex(1);
  //     await sPana.connect(initializer).setKarsha(karshaFake.address);
  //     await sPana.connect(initializer).initialize(staking.address, treasuryFake.address,initializer.address);
  //   });
  //   describe("transfer checks", () => {
  //     it("transfer sPANA", async () => {
  //       await pana.connect(initializer).mint(alice.address, 100);
  //       await pana.connect(alice).approve(staking.address,50);
        
  //       //both claim & rebase value as true(this scenario won't exists in our case)
  //       //to test disable functionality makes as true
  //       //only staking conctract will provide sPana
  //       await staking.connect(alice).stake(alice.address,50,true,true);
        
  //       await sPana.connect(alice).approve(bob.address,50);        
  //       expect(await sPana.connect(bob).transferFrom(alice.address, bob.address, 10)).to.be.exist;
  //       expect(await sPana.connect(alice).transfer(bob.address, 10)).to.be.exist;
  //       //balance of sPana for alice will 10(transferFrom)+10(transfer)
  //       expect(await sPana.connect(alice).balanceOf(bob.address)).to.equal(10+10);
  //     });      
  //     it("disable transfer sPANA rebase staking", async () => {
  //       await pana.connect(initializer).mint(alice.address, 100);
  //       await pana.connect(alice).approve(staking.address,50);

  //       //active disabler
  //       await sPana.connect(initializer).toggleTransfer();    

  //       await expect(staking.connect(alice).stake(alice.address,50,true,true)).to.be.reverted;
  //       expect(await sPana.connect(alice).balanceOf(bob.address)).to.equal(0);
  //     });
  //     it("toggle transfer sPANA user restriction", async () => {
  //       await pana.connect(initializer).mint(alice.address, 100);
  //       await pana.connect(alice).approve(staking.address,50);
  //       //try to active disabler by other user
  //       await expect(sPana.connect(alice).toggleTransfer()).to.be.revertedWith("UNAUTHORIZED User");        
  //     });
  //     it("disable transfer sPANA after stake", async () => {        
  //       await pana.connect(initializer).mint(alice.address, 100);
  //       await pana.connect(alice).approve(staking.address,50);        
        
  //       await staking.connect(alice).stake(alice.address,50,true,true);        
  //       await sPana.connect(alice).approve(bob.address,50);    
        
  //       await sPana.connect(initializer).toggleTransfer();    

  //       await expect(sPana.connect(bob).transferFrom(alice.address, bob.address, 10)).to.be.reverted;
  //       await expect(sPana.connect(alice).transfer(bob.address, 10)).to.be.reverted;
  //     });      
  //   });    
  // });
  describe("debt checks", () => {      
    it("default debt balance is zero", async () => {  
      expect(await sPana.connect(initializer).debtBalances(alice.address)).to.equal(0);
    });
  });
});