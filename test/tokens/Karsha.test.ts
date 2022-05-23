import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, smock } from '@defi-wonderland/smock'
import {
  IStaking,
  SPana,
  SPana__factory,
  Karsha,
  Karsha__factory,
  PanaAuthority__factory,
  ITreasury,
} from '../../types';

const bigNumberRepresentation = (number:any) => {
  return ethers.BigNumber.from(number.toString());
};
const decimalRepresentation = (value:any, decimals:any) => {
  return bigNumberRepresentation(value*(10**decimals));
};
const decimalRepresentation_1 = (value:any, decimals:any) => {
  return (value*(10**decimals));
};

describe("Karsha-Token-Test", () => {
  let deployer: SignerWithAddress;
  let vault: SignerWithAddress;
  let bob: SignerWithAddress;
  let alice: SignerWithAddress;
  let initializer: SignerWithAddress;
  let stakingAddress: SignerWithAddress;
  let karsha: Karsha;
  let sPana: SPana;
  let stakingFake: FakeContract<IStaking>;
  let treasuryFake: FakeContract<ITreasury>;
  let indexDecimal = 18;
  beforeEach(async () => {
    [deployer, vault, bob, alice,initializer,stakingAddress] = await ethers.getSigners();
    const authority = await (new PanaAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address);
    await authority.deployed();
    treasuryFake = await smock.fake<ITreasury>('ITreasury');
    stakingFake = await smock.fake<IStaking>('IStaking');
    stakingFake.attach(stakingAddress.address);    
    sPana = await (new SPana__factory(initializer)).deploy();
    karsha = await (new Karsha__factory(deployer)).deploy(deployer.address,sPana.address);
    karsha.migrate(stakingAddress.address,sPana.address);
    await sPana.connect(initializer).setIndex(decimalRepresentation(2,indexDecimal));
    await sPana.connect(initializer).setKarsha(karsha.address);
    await sPana.connect(initializer).initialize(stakingAddress.address, treasuryFake.address,initializer.address);    
  });

  it("correctly constructs an ERC20", async () => {
    expect(await karsha.name()).to.equal("Karsha");
    expect(await karsha.symbol()).to.equal("KARSHA");
    expect(await karsha.decimals()).to.equal(18);
  });

  describe("mint", () => {
    it("must be done by Staking Contract only", async () => {
      await expect(karsha.connect(bob).mint(bob.address, 100)).
        to.be.revertedWith("Only approved");
    });
    it("increases total supply", async () => {
      let supplyBefore = await karsha.totalSupply();
      await karsha.connect(stakingAddress).mint(bob.address, 100);      
      expect(supplyBefore.add(100)).to.equal(await karsha.totalSupply());
    });
    it("check Balance of", async () => {
      let supplyBefore = await karsha.totalSupply();
      await karsha.connect(stakingAddress).mint(bob.address, 100);
      expect(supplyBefore.add(100)).to.equal(await karsha.balanceOf(bob.address));      
    });
  });

  describe("burn", () => {
    beforeEach(async () => {
      await karsha.connect(stakingAddress).mint(bob.address, 100);
    });

    it("reduces the total supply", async () => {
      let supplyBefore = await karsha.totalSupply();
      await karsha.connect(stakingAddress).burn(bob.address,10);
      expect(supplyBefore.sub(10)).to.equal(await karsha.totalSupply());
    });
    it("reduces the bob balance", async () => {      
      let bobBalance = await karsha.balanceOf(bob.address);
      await karsha.connect(stakingAddress).burn(bob.address,10);
      let bobNewBalance = await karsha.balanceOf(bob.address);
      expect(bobBalance.toNumber()-10).to.equal(bobNewBalance.toNumber());
    });

    it("cannot exceed total supply", async () => {
      let supply = await karsha.totalSupply();
      await expect(karsha.connect(stakingAddress).burn(bob.address,supply.add(1))).
        to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("cannot exceed bob's balance", async () => {
      await karsha.connect(stakingAddress).mint(alice.address, 15);
      await expect(karsha.connect(stakingAddress).burn(bob.address,101)).
        to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });

  describe("Karsha-balance", () => {    
    let amount_ = BigInt(decimalRepresentation_1(100,18));
    beforeEach(async () => {
      let kBalance_ =(await karsha.balanceTo(amount_));      
      await karsha.connect(stakingAddress).mint(bob.address, kBalance_);
    });
    it("balanceOf Bob's= (amount*decimal)/index", async () => {
      let balanceOfKarsh = (await karsha.balanceOf(bob.address));
      let balanceOfKarshPana = (await (karsha.balanceOfPANA(bob.address))).toBigInt();
      let index = (await (karsha.index())).toBigInt();
      let decimalVal = BigInt(String((10**(await karsha.decimals()))));
      expect(balanceOfKarsh).to.equal((balanceOfKarshPana*decimalVal)/index);
    });
    it("balanceTo = (amount*decimal)/index", async () => { 
      let balanceTo_ =(await karsha.balanceTo(amount_)).toBigInt();
      let index = (await (karsha.index())).toBigInt();
      let decimalVal = BigInt(String((10**(await karsha.decimals()))));     
      expect(balanceTo_).to.equal((amount_*decimalVal)/index);
    });
    it("balanceFrom  = (amount/decima1)*index", async () => {         
      let balanceFrom_ =(await karsha.balanceFrom(amount_)).toBigInt();   
      let index = (await (karsha.index())).toBigInt();
      let decimalVal = BigInt(String((10**(await karsha.decimals()))));          
      expect(balanceFrom_).to.equal((amount_*index)/decimalVal);
    });
    it("balanceTo inverse of balanceFrom", async () => { 
      let balanceTo_ =(await karsha.balanceTo(amount_)).toBigInt();
      expect((await karsha.balanceFrom(balanceTo_)).toBigInt()).to.equal(amount_);
    });
    it("BalanceFrom (Karsha balance) is equal to PANA(minted)", async () => {      
      await expect((await karsha.balanceFrom(await karsha.balanceOf(bob.address))).toBigInt()).to.equal((amount_));
    });
    it("validating Balance of Pana from Karsha is equal to PANA(minted)", async () => {      
      await expect((await karsha.balanceOfPANA(bob.address)).toBigInt()).to.equal(amount_);
    });
    it("console log for validation", async () => {     
     
      let currentIndex = (await (karsha.index())).toBigInt();
      let kBalance_ =(await karsha.balanceTo(currentIndex));
      await karsha.connect(stakingAddress).mint(alice.address, kBalance_);
      let balance = (await karsha.balanceOf(alice.address)).toBigInt();
      expect(String(currentIndex).replace("n","")).to.equal('2000000000000000000');
      expect(String(currentIndex).replace("n","").length).to.equal(19);
      expect(String(balance).replace("n","")).to.equal('1000000000000000000');
      expect(String(balance).replace("n","").length).to.equal(19);
    });
  });
});