import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber,  BytesLike, Signer } from "ethers";
import { ethers, network } from "hardhat";
let moveTimestamp = async(seconds:any)=>   {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

const getRealNumber = (number: any, decimal: number = 18) => {
    return ethers.utils.formatUnits(BigNumber.from(number).toBigInt(), decimal);
}

const delay = async (sec:number)=> {
  return new Promise(resolve => {
      setTimeout(() => { resolve('') }, sec*1000);
  })
}

import {
  PanaERC20Token,
  PanaERC20Token__factory,
  PanaAuthority__factory,
  DAI,
  DAI__factory,
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
const decimalRepresentation_1 = (value:any, decimals:any=18) => {
  return BigInt(value*(10**decimals));
};
const getNormalVaule  = function(number:any,decimals:any=18){                
  return BigInt(number)/BigInt((10**(decimals)));
}  
const getNormalVaule_NUMBER  = function(number:any,decimals:any=18){                
    return Number(BigInt(number)/BigInt((10**(decimals))));
  }  
const EPOCH_LENGTH = 50;
const EPOCH_NUMBER = 1;
const LARGE_APPROVAL = "100000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
 // Initial mint for Frax and DAI (10,000,000)
 const initialMint = "10000000000000000000000000";
 // Reward rate of .1%
 const initialRewardRate = "1000";
 // Debt limit of 10
 const debtLimit = "10000000000";
// Setting epoch to 1 for easier testing
const blocksNeededForQueue = 1;
const INITIAL_REWARD_RATE = "5";

let bondID = 0;
let depositAmount_dai = "1000000000000000000000"; // 1000 dai
const initialDeposit_dai = "50000000000000000000000"; //50,000
let amount_dai = "10000000000000000000000000000"; //10,000,000
let amt_dai    =  "20000000000000000000000"; //20,000
let capacity =   "10000000000000000000000"; // 10,000
let initialPrice_dai = "400000000000000000000"; // 400

let capacity_dai_mint =   "10000000000000000000000"; // 10,000
let capacity_pana_mint =   "1000000000000000000000000"; // 10,000,00
let capacity_dai_mint_min =   "10000000000000000000"; // 10,000
let capacity_pana_mint_min =   "10000000000000000000"; // 10,000,00
let buffer = 2e5;
let depositInterval = 60*60*4; // 4 hours
let tune=60*60; // 1 hour
let block: any;

const dai_to_be_deposited = 100000000000000000000;
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
  let dai : DAI;
  let karsha: Karsha;
  let sPana: SPana;
  let distributor: Distributor
  let staking: PanaStaking;
  let treasury:PanaTreasury;
  let bondDepository:PanaBondDepository;
  let bondSigner:any;
  let swaptester:any;
  let uniswap:any;
  let swapfeesetter:any;
  let swapminter:any;
  let pairAddress:any;
  let user1:any;
  let initialIndex:any;
  let initialPanaTotalSupply:any;
  let initialStakingBalanceTotalSupply:any;
  let distributeAmount:any;
  let initialExcess:any;
  let newIndex:any;
  let newPanaTotalSupply:any;
  let newStakingBalanceTotalSupply:any;
  let newkarshaBalanceBond:any;
  let newkarshaPanaBalanceBond:any;
  let newkarshaTotalSupply:any;
  let newExcess:any;
  let newDistribute:any;
  before(async () => {
    [deployer, vault, bob, alice,user1,bondSigner,swaptester,swapminter,swapfeesetter] = await ethers.getSigners();
    
    block = await network.provider.send("eth_getBlockByNumber", ["latest", false]);  

    dai = await (new DAI__factory(deployer)).deploy(chainIds.hardhat);

    const authority = await (new PanaAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address);
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
    const nextTimestate = 10 + parseInt(block.timestamp);
    await staking.setFirstEpoch(EPOCH_LENGTH, EPOCH_NUMBER, nextTimestate);

    // await treasury.connect(deployer).initialize();
   
    // toggle deployer reserve depositor
    await treasury.enable("0", deployer.address, ZERO_ADDRESS, ZERO_ADDRESS);
    await treasury.enable("0", bondDepository.address, ZERO_ADDRESS, ZERO_ADDRESS);
    
    // toggle DAI as reserve token
    await treasury.enable("2", dai.address, ZERO_ADDRESS, ZERO_ADDRESS);

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

    await dai.addAuth(deployer.address);
    await dai.connect(deployer).mint(deployer.address, '370500000000000000000000');
    await dai.connect(deployer).approve(treasury.address, '370500000000000000000000');
    
    await treasury.connect(deployer).deposit(
            '10000000000000000000', 
            dai.address,0 );  


  });
  it("initilize rebase", async () => {
    const conclusion = 86400 + parseInt(block.timestamp); // 1 day

    await bondDepository.create(dai.address,
      ["250000000000000000000000", "500000000000000000", "100000"],
      [false,true, false, true],
      [1800, conclusion],
      [21600, 1800]); 
    initialIndex= parseFloat(parseFloat(getRealNumber((await sPana.index()).toBigInt())).toFixed(4));
    initialPanaTotalSupply =parseFloat(parseFloat(getRealNumber((await pana.totalSupply()).toBigInt())).toFixed(4));
  
    await delay(15);    
    await dai.mint(bob.address, dai_to_be_deposited.toString());
    await dai.connect(bob).approve(bondDepository.address, dai_to_be_deposited.toString());
    await bondDepository.connect(bob).deposit(0, '1000000000000000000', "100000000000000000000", bob.address, ZERO_ADDRESS);
    initialStakingBalanceTotalSupply =parseFloat(parseFloat(getRealNumber((await pana.balanceOf(staking.address)).toBigInt())).toFixed(4));
    distributeAmount =parseFloat(parseFloat(getRealNumber((await (await staking.epoch()).distribute).toBigInt())).toFixed(4));
    initialExcess=  parseFloat(parseFloat(getRealNumber(await treasury.excessReserves())).toFixed(4));
    await delay(50); 
    await staking.rebase();
    newIndex= parseFloat(parseFloat(getRealNumber((await sPana.index()).toBigInt())).toFixed(4));
    newPanaTotalSupply =parseFloat(parseFloat(getRealNumber((await pana.totalSupply()).toBigInt())).toFixed(4));
    newStakingBalanceTotalSupply =parseFloat(parseFloat(getRealNumber((await pana.balanceOf(staking.address)).toBigInt())).toFixed(4));
    newkarshaBalanceBond =parseFloat(parseFloat(getRealNumber((await karsha.balanceOf(bondDepository.address)).toBigInt())).toFixed(4));
    newkarshaPanaBalanceBond =parseFloat(parseFloat(getRealNumber((await karsha.balanceOfPANA(bondDepository.address)).toBigInt())).toFixed(4));
    newkarshaTotalSupply =parseFloat(parseFloat(getRealNumber((await karsha.totalSupply()).toBigInt())).toFixed(4));
    newExcess=  parseFloat(parseFloat(getRealNumber(await treasury.excessReserves())).toFixed(4));
    newDistribute= parseFloat(parseFloat(getRealNumber((await (await staking.epoch()).distribute))).toFixed(4));    
  }).timeout(-1);
  it("Next reward rate value", async () => {
    let reward = (await distributor.nextRewardFor(staking.address)).toBigInt()   
    let calculatingReward = ((await pana.totalSupply()).toBigInt()* BigInt(INITIAL_REWARD_RATE))/BigInt(10**6);   
    expect(reward).to.equal(calculatingReward);
  }); 
  it("Excess Values to be decrease(new excess+distribute)", async () => {     
    expect(initialExcess).to.equal(parseFloat((newExcess+distributeAmount).toFixed(4))); 
  });
  it("Staking pana balance to be increase(initail+distribute)", async () => {     
    expect(newStakingBalanceTotalSupply).to.equal(parseFloat((initialStakingBalanceTotalSupply+distributeAmount).toFixed(4)));
  });
  it("Index value will be increased", async () => {     
    expect(initialIndex+parseFloat((distributeAmount/initialStakingBalanceTotalSupply).toFixed(4))).to.equal(newIndex);    
  });
  it("distributed amount equivalent to totalpana supply * reward rate", async () => {     
    expect(parseFloat((initialPanaTotalSupply*(parseFloat(INITIAL_REWARD_RATE))/(1000000)).toFixed(4))).to.equal(distributeAmount);
  });
  it("karsha balance equivalent to staking balance*index", async () => { 
    expect(parseFloat((newkarshaBalanceBond*newIndex).toFixed(4))).to.equal(parseFloat((newStakingBalanceTotalSupply-newDistribute).toFixed(4)));
  });
});