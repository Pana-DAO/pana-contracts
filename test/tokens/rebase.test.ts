import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber} from "ethers";
import { ethers, network } from "hardhat";
let moveTimestamp = async(seconds:any)=>   {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

import {
  PanaERC20Token,
  PanaERC20Token__factory,
  PanaAuthority__factory,
  USDC,
  USDC__factory,
  Karsha__factory,
  SPana__factory,
  Karsha,
  SPana,
  PanaStaking,
  Distributor,
  Distributor__factory,
  PanaStaking__factory,
  PanaTreasury__factory,
  PanaTreasury,
  PanaBondDepository__factory,
  PanaBondDepository,
} from '../../types';

const bigNumberRepresentation = (number:any) => {
  return ethers.BigNumber.from(number.toString());
};
const decimalRepresentation = (value:any, decimals:any=18) => {
  return bigNumberRepresentation(value*(10**decimals));
};
const EPOCH_LENGTH = 50;
const EPOCH_NUMBER = 1;
const LARGE_APPROVAL = "100000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Setting epoch to 1 for easier testing
const blocksNeededForQueue = 1;
const INITIAL_REWARD_RATE = bigNumberRepresentation("5000");

let block: any;

const usdc_to_be_deposited = bigNumberRepresentation("100000000");
const chainIds = {
  hardhat: 31337,
  mumbai: 80001
};
describe("sPana Validate Rebase", () => {
  let deployer: SignerWithAddress;
  let vault: SignerWithAddress;
  let bob: SignerWithAddress;
  let alice: SignerWithAddress;
  let pana: PanaERC20Token;
  let usdc : USDC;
  let karsha: Karsha;
  let sPana: SPana;
  let distributor: Distributor
  let staking: PanaStaking;
  let treasury:PanaTreasury;
  let bondDepository:PanaBondDepository;
  let initialIndex:any;
  let initialPanaTotalSupply:any;
  let initialStakingBalanceTotalSupply:any;
  let distributeAmount:any;
  let initialExcess:any;
  let newIndex:any;
  let newStakingBalanceTotalSupply:any;
  let newkarshaBalanceBond:any;
  let newExcess:any;
  let newDistribute:any;
  before(async () => {
    [deployer, vault, bob, alice ] = await ethers.getSigners();
    
    block = await network.provider.send("eth_getBlockByNumber", ["latest", false]);  

    usdc = await (new USDC__factory(deployer)).deploy(chainIds.hardhat);

    const authority = await (new PanaAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address, ZERO_ADDRESS);
    await authority.deployed();

    pana = await (new PanaERC20Token__factory(deployer)).deploy(authority.address);
    sPana = await (new SPana__factory(deployer)).deploy();
    karsha = await (new Karsha__factory(deployer)).deploy(deployer.address,sPana.address);
    treasury = await (new PanaTreasury__factory(deployer)).deploy(pana.address, blocksNeededForQueue, authority.address);
    staking = await new PanaStaking__factory(deployer).deploy(
        pana.address,
        sPana.address,
        karsha.address,
        authority.address
    );
    distributor = await new Distributor__factory(deployer).deploy(treasury.address,
      pana.address,
      staking.address,
      authority.address
    );
    karsha.migrate(staking.address,sPana.address);
    bondDepository = await new PanaBondDepository__factory(deployer).deploy(
      authority.address,pana.address,karsha.address,staking.address,treasury.address);

    // Needed to spend deployer's PANA
    await pana.approve(staking.address, LARGE_APPROVAL);
    await sPana.setIndex("1000000000000000000");
    await sPana.setKarsha(karsha.address);
    await sPana.initialize(staking.address, treasury.address, deployer.address);
    await staking.setDistributor(distributor.address);
    const currentBlock = await ethers.provider.send("eth_blockNumber", []);
    const nextRebase = BigNumber.from(currentBlock).add(10000); // set the rebase far enough in the future to not hit it
    const nextTimestate = 50 + parseInt(block.timestamp);
    await staking.setFirstEpoch(EPOCH_LENGTH, EPOCH_NUMBER, nextTimestate);

    // await treasury.connect(deployer).initialize();
   
    // toggle deployer reserve depositor
    await treasury.enable("0", deployer.address, ZERO_ADDRESS, ZERO_ADDRESS);
    await treasury.enable("0", bondDepository.address, ZERO_ADDRESS, ZERO_ADDRESS);
    
    // toggle USDC as reserve token
    await treasury.enable("2", usdc.address, ZERO_ADDRESS, ZERO_ADDRESS);

    // toggle liquidity depositor
    await treasury.enable("4", deployer.address, ZERO_ADDRESS, ZERO_ADDRESS);
    await treasury.enable("4", bondDepository.address, ZERO_ADDRESS, ZERO_ADDRESS);

     // toggle reward manager
     await treasury.enable("8", distributor.address, ZERO_ADDRESS, ZERO_ADDRESS);
     await treasury.enable("8", bondDepository.address, ZERO_ADDRESS, ZERO_ADDRESS);

     await treasury.setBaseValue("100000000000");

    await treasury.initialize();
    await authority.pushVault(treasury.address, true);
    await staking.setBondDepositor(bondDepository.address);
    await staking.setDistributor(distributor.address);

    await distributor.addRecipient(staking.address, INITIAL_REWARD_RATE);

    await usdc.addAuth(deployer.address);
    await usdc.connect(deployer).mint(deployer.address, '370500000000');
    await usdc.connect(deployer).approve(treasury.address, '370500000000');
    
    await treasury.connect(deployer).deposit(
            '10000000', 
            usdc.address,0 );  


  });
  it("initilize rebase", async () => {
    const conclusion = 86400 + parseInt(block.timestamp); // 1 day

    await bondDepository.create(usdc.address,
      ["250000000000000000000000", "500000000000000000", "100000"],
      [false,true, false, true],
      [1800, conclusion],
      [21600, 1800]); 
 
    moveTimestamp(15);  
    await usdc.mint(bob.address, usdc_to_be_deposited);
    await usdc.connect(bob).approve(bondDepository.address, usdc_to_be_deposited);
    await bondDepository.connect(bob).deposit(0, '1000000', "100000000000000000000", bob.address, ZERO_ADDRESS);
    initialIndex=(await sPana.index());
    initialPanaTotalSupply =(await pana.totalSupply()); 
    initialStakingBalanceTotalSupply =await pana.balanceOf(staking.address);
    distributeAmount =(await (await staking.epoch()).distribute);
    initialExcess= await treasury.excessReserves();
    moveTimestamp(50); 
    await staking.rebase();
    newIndex=(await sPana.index());
    newStakingBalanceTotalSupply =await pana.balanceOf(staking.address);
    newkarshaBalanceBond = await karsha.balanceOf(bondDepository.address);
    newExcess= await treasury.excessReserves();
    newDistribute=await (await staking.epoch()).distribute;    

  }).timeout(-1);
  it("Next reward rate value", async () => {
    let reward = await distributor.nextRewardFor(staking.address);
    let calculatingReward = (await pana.totalSupply()).mul (INITIAL_REWARD_RATE).div(10**6);   
    expect(reward.div(10**6)).to.equal(calculatingReward.div(10**6));
  }); 
  it("Excess Values to be decrease(new excess+distribute)", async () => {     
    expect(initialExcess.div(10**6)).to.equal(newExcess.add(newDistribute).div(10**6)); 
  });
  it("Staking pana balance to be increase(initail+distribute)", async () => {    
    expect(newStakingBalanceTotalSupply.div(10**6)).to.equal(initialStakingBalanceTotalSupply.add(newDistribute).div(10**6));
  });
  it("Index value will be increased", async () => {   
    expect(initialIndex.add((distributeAmount).mul(decimalRepresentation(1)).div(initialStakingBalanceTotalSupply.sub(distributeAmount)))).to.equal(newIndex);    
  });
  it("distributed amount equivalent to totalpana supply * reward rate", async () => {     
    expect((initialPanaTotalSupply.mul(INITIAL_REWARD_RATE).div(1000000)).div(10**6)).to.equal(newDistribute.div(10**6));
  });
  it("karsha balance equivalent to staking balance*index", async () => { 
    expect(newkarshaBalanceBond.mul(newIndex).div(decimalRepresentation(1))).to.equal(newStakingBalanceTotalSupply.sub(newDistribute));
  });
});