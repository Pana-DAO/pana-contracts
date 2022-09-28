import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract} from "ethers";
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
  UniswapV2Factory__factory,
  UniswapV2Router02__factory,
  UniswapV2Pair__factory,
  UniswapV2Factory,
  UniswapV2Router02,
  PanaBondingCalculator__factory,
  PanaBondingCalculator,
} from '../../types';

const bigNumberRepresentation = (number:any) => {
  return ethers.BigNumber.from(number.toString());
};
const decimalRepresentation = (value:any, decimals:number=18) => {
  return bigNumberRepresentation(value.toString()).mul(bigNumberRepresentation(10).pow(decimals));
};
const EPOCH_LENGTH = 50;
const EPOCH_NUMBER = 1;
const LARGE_APPROVAL = "100000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Setting epoch to 1 for easier testing
const blocksNeededForQueue = 1;
const INITIAL_REWARD_RATE = bigNumberRepresentation("203000");

let block: any;

const usdc_to_be_deposited = bigNumberRepresentation("1000000000000000000");
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
  let bondingCalculator : PanaBondingCalculator;
  let initialIndex:any;
  let initialStakingSupply:any;
  let initialStakingBalanceTotalSupply:any;
  let distributeAmount:any;
  let initialExcess:any;
  let newIndex:any;
  let newStakingBalanceTotalSupply:any;
  let newkarshaBalanceBond:any;
  let newExcess:any;
  let newDistribute:any;
  let lpfactory: UniswapV2Factory;
  let uniswapRouter : UniswapV2Router02;
  let LP : Contract;
  before(async () => {
    [deployer, vault, bob, alice ] = await ethers.getSigners();
    
    block = await network.provider.send("eth_getBlockByNumber", ["latest", false]);  

    usdc = await (new USDC__factory(deployer)).deploy(chainIds.hardhat);

    const authority = await (new PanaAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address, deployer.address);
    await authority.deployed();

    pana = await (new PanaERC20Token__factory(deployer)).deploy(authority.address);
    sPana = await (new SPana__factory(deployer)).deploy(authority.address);
    karsha = await (new Karsha__factory(deployer)).deploy(deployer.address,sPana.address,authority.address);
    treasury = await (new PanaTreasury__factory(deployer)).deploy(pana.address, blocksNeededForQueue, authority.address);
    staking = await new PanaStaking__factory(deployer).deploy(
        pana.address,
        sPana.address,
        karsha.address,
        authority.address
    );
    await karsha.setStaking(staking.address);
    distributor = await new Distributor__factory(deployer).deploy(treasury.address,
      pana.address,
      staking.address,
      authority.address
    );
    bondDepository = await new PanaBondDepository__factory(deployer).deploy(
      authority.address,pana.address,karsha.address,staking.address,treasury.address);

    lpfactory = await new UniswapV2Factory__factory(deployer).deploy(deployer.address);
    uniswapRouter = await (new UniswapV2Router02__factory(deployer)).deploy(lpfactory.address, ZERO_ADDRESS);
    await lpfactory.createPair(usdc.address, pana.address);
    LP = await( new UniswapV2Pair__factory(deployer)).attach(await lpfactory.getPair(usdc.address, pana.address));

    bondingCalculator = await new PanaBondingCalculator__factory(deployer).deploy(pana.address);        

    // Needed to spend deployer's PANA
    await pana.approve(staking.address, LARGE_APPROVAL);

    await sPana.setIndex("1000000000000000000");
    await sPana.setKarsha(karsha.address);
    await sPana.initialize(staking.address);
    await staking.setDistributor(distributor.address);
    const currentBlock = await ethers.provider.send("eth_blockNumber", []);
    const nextRebase = BigNumber.from(currentBlock).add(10000); // set the rebase far enough in the future to not hit it
    const nextTimestate = 50 + parseInt(block.timestamp);
    const conclusion = parseInt(block.timestamp) + 86400; // 1 day
    const PANADecimals = await pana.decimals();
    const USDCDecimals = await usdc.decimals();

    await staking.setFirstEpoch(EPOCH_LENGTH, EPOCH_NUMBER, nextTimestate);

    await pana.connect(vault).mint(deployer.address,decimalRepresentation("100000",PANADecimals));

    // await treasury.connect(deployer).initialize();
   
    // toggle deployer reserve depositor
    await treasury.enable("0", deployer.address, ZERO_ADDRESS);
    await treasury.enable("0", bondDepository.address, ZERO_ADDRESS);
    
    // toggle USDC as reserve token
    await treasury.enable("1", usdc.address, ZERO_ADDRESS);

    // toggle liquidity depositor
    await treasury.enable("3", deployer.address, ZERO_ADDRESS);
    await treasury.enable("3", bondDepository.address, ZERO_ADDRESS);

     // toggle reward manager
     await treasury.enable("6", distributor.address, ZERO_ADDRESS);
     await treasury.enable("6", bondDepository.address, ZERO_ADDRESS);
     await treasury.enable("4", LP.address, bondingCalculator.address);

    //  await treasury.setBaseValue("100000000000");

    await treasury.initialize();
    await authority.pushVault(treasury.address, true);
    await staking.connect(deployer).addApprovedDepositor(bondDepository.address);
    await staking.setDistributor(distributor.address);

    await distributor.addRecipient(staking.address, INITIAL_REWARD_RATE,true);

    await usdc.addAuth(deployer.address);

    await usdc.connect(deployer).approve(uniswapRouter.address, LARGE_APPROVAL);
    await pana.connect(deployer).approve(uniswapRouter.address, LARGE_APPROVAL);
    await usdc.connect(deployer).mint(deployer.address, decimalRepresentation("1000000",USDCDecimals));
    await usdc.connect(deployer).approve(treasury.address, LARGE_APPROVAL);
    await LP.connect(deployer).approve(treasury.address, LARGE_APPROVAL);

    

    await uniswapRouter.connect(deployer)
                    .addLiquidity(
                        usdc.address, 
                        pana.address, 
                        decimalRepresentation("10000",USDCDecimals),
                        decimalRepresentation("100000",PANADecimals), 
                        0, 
                        0, 
                        deployer.address, 
                        conclusion
                    );

    // let totalLPbalance = await LP.balanceOf(deployer.address);
    // let tokenval = await treasury.tokenValue(LP.address,totalLPbalance);
    // await treasury.connect(deployer).deposit(
    //   totalLPbalance, 
    //         LP.address,tokenval);

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
    await bondDepository.connect(bob).deposit(0, '100', "100000000000000000000", bob.address, ZERO_ADDRESS);
    initialIndex=(await sPana.index());
    // initialPanaTotalSupply =(await pana.totalSupply()); 
    initialStakingSupply = (await staking.stakingSupply());
    initialStakingBalanceTotalSupply =await pana.balanceOf(staking.address);
    distributeAmount=(await staking.epoch()).distribute;
    moveTimestamp(50);     
    await staking.rebase();
    distributeAmount =distributeAmount.add((await staking.epoch()).distribute);

    moveTimestamp(50);    
    await staking.rebase();    
    distributeAmount =distributeAmount.add((await staking.epoch()).distribute);
        
    newIndex=(await sPana.index());
    newStakingBalanceTotalSupply =await pana.balanceOf(staking.address);
    newkarshaBalanceBond = await karsha.balanceOf(bondDepository.address);
    newExcess= initialExcess= await pana.balanceOf(treasury.address);//await treasury.excessReserves();    
    newDistribute=(await staking.epoch()).distribute;        
  }).timeout(-1);
  it("Next reward rate value", async () => {
    let reward = await distributor.nextRewardFor(staking.address);
    let calculatingReward = (await staking.stakingSupply()).mul(INITIAL_REWARD_RATE).div(10**9);   
    expect(reward.div(10**6)).to.equal(calculatingReward.div(10**6));    
  }); 
  // it("Excess Values to be decrease(new excess+distribute)", async () => {     
  //   expect(initialExcess.div(10**6)).to.equal(newExcess.add(newDistribute).div(10**6)); 
  // });
  it("Staking pana balance to be increase(initail+distribute on each rebase)", async () => {    
    expect(newStakingBalanceTotalSupply.div(10**6)).to.equal(initialStakingBalanceTotalSupply.add(distributeAmount).div(10**6));
  });
  it("Index value checks", async () => {   
     
    let stakedBalancewithoutdistribution = newStakingBalanceTotalSupply.sub(newDistribute);
    let indxchk =stakedBalancewithoutdistribution/(initialStakingSupply);       
    //sub distribute amount because this amount will be added on nxt rebase
    expect(parseFloat(indxchk.toString()).toFixed(9)).to.equal(parseFloat((newIndex/(10**18)).toString()).toFixed(9));    
    
  });
  it("distributed is amount add for next index", async () => {     
    let nextIndx = newStakingBalanceTotalSupply/(initialStakingSupply);
    //call next rebase to validate the next index
    moveTimestamp(50);
    await staking.rebase(); 
    let newIndex1:any=(await sPana.index());    
    expect(parseFloat((nextIndx).toString()).toFixed(9)).to.equal(parseFloat((newIndex1/(10**18)).toString()).toFixed(9));    
    
  });
  it("karsha balance equivalent to staking balance*index", async () => { 
    //staking total- distribution values = karsha*index
    expect(newkarshaBalanceBond.mul(newIndex).div(decimalRepresentation(1))).to.equal(newStakingBalanceTotalSupply.sub(newDistribute));
  });
});