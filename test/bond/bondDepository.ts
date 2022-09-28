import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";

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
    PanaAuthority,
    USDC1Decimal,
} from '../../types';

const moveTimestamp = async(seconds:any)=>   {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
};
const bigNumberRepresentation = (number:any) => {
    return ethers.BigNumber.from(number.toString());
};
const decimalRepresentation = (value:any, decimals:number=18) => {
    return bigNumberRepresentation(value.toString()).mul(bigNumberRepresentation(10).pow(decimals));
};
const getNormalValue  = function(number:any,decimals:number=18){
    return bigNumberRepresentation(number).div(10**(decimals));
};
const EPOCH_LENGTH = 60*60*1;
const EPOCH_NUMBER = 0;
const LARGE_APPROVAL = "100000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// Initial mint for USDC (10,000,000)
// Setting epoch to 1 for easier testing
const blocksNeededForQueue = 1;

let block: any;
let conclusion: number;

const INITIAL_REWARD_RATE = "5000";
const chainIds = {
    hardhat: 31337,
    mumbai: 80001
};
describe("Pana reserve bond contract", () => {
    
    let deployer: SignerWithAddress;
    let vault: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let distributionVault: SignerWithAddress;
    let pana: PanaERC20Token;
    let usdc : USDC;
    let karsha: Karsha;
    let sPana: SPana;
    let distributor: Distributor
    let staking: PanaStaking;
    let treasury:PanaTreasury;
    let bondDepository:PanaBondDepository;
    let authority:PanaAuthority;
    var USDCDecimals: number;
    let PANADecimals : number;
    
    beforeEach(async () => {
        [deployer, vault, user1, user2, distributionVault] = await ethers.getSigners();
        
        block = await network.provider.send("eth_getBlockByNumber", ["latest", false]);

        usdc = await (new USDC__factory(deployer)).deploy(chainIds.hardhat);
        
        authority = await (new PanaAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address, distributionVault.address);
        await authority.deployed();
        
        pana = await (new PanaERC20Token__factory(deployer)).deploy(authority.address);
        sPana = await (new SPana__factory(deployer)).deploy(authority.address);
        karsha = await (new Karsha__factory(deployer)).deploy(deployer.address,sPana.address,authority.address);
        
        treasury = await (new PanaTreasury__factory(deployer)).deploy(pana.address, blocksNeededForQueue, authority.address);
        staking = await new PanaStaking__factory(deployer).deploy(pana.address,sPana.address,karsha.address,authority.address);
        await karsha.setStaking(staking.address);
        distributor = await new Distributor__factory(deployer).deploy(treasury.address,pana.address,staking.address,authority.address);
        
        bondDepository = await new PanaBondDepository__factory(deployer).deploy(
            authority.address,pana.address,karsha.address,staking.address,treasury.address);
        USDCDecimals = await usdc.decimals();
        PANADecimals = await pana.decimals();
            
            // Needed to spend deployer's PANA
            await sPana.setIndex("1000000000000000000"); // index = 1
            await sPana.setKarsha(karsha.address);
            await sPana.initialize(staking.address);
            await staking.setDistributor(distributor.address);
            
            // Enabling permissions for treasury
            // toggle reward manager
            await treasury.enable("6", distributor.address,ZERO_ADDRESS);
            await treasury.enable("6", bondDepository.address,ZERO_ADDRESS);
            // toggle deployer and bond reserve depositor
            await treasury.enable("0", deployer.address,ZERO_ADDRESS);
            await treasury.enable('0',bondDepository.address, ZERO_ADDRESS);
            // toggle liquidity depositor
            await treasury.enable("3", deployer.address, ZERO_ADDRESS);
            // toggle USDC as reserve token
            await treasury.enable("1", usdc.address,ZERO_ADDRESS);
            await treasury.initialize();

            await pana.connect(deployer).mintForDistribution(decimalRepresentation('5000000'))
            await authority.pushVault(treasury.address, true);
            await staking.connect(deployer).addApprovedDepositor(bondDepository.address);
            await distributor.connect(deployer).addRecipient(staking.address, INITIAL_REWARD_RATE,true);
            await staking.setFirstEpoch(EPOCH_LENGTH, EPOCH_NUMBER, parseInt(block.timestamp) + 3600);
        });
        it("should initialize authorities",async()=>{
            expect(await authority.policy()).to.be.equal(deployer.address);
            expect(await authority.vault()).to.be.equal(treasury.address);
            expect(await authority.guardian()).to.be.equal(deployer.address);
            expect(await authority.governor()).to.be.equal(deployer.address);
        });
        it("should initialize tokens", async()=>{
            expect(await usdc.symbol()).to.be.equal("USDC");
            expect(await usdc.decimals()).to.be.equal(6);
            expect(await pana.symbol()).to.be.equal("PANA");
            expect(await pana.decimals()).to.be.equal(18);
            expect(await karsha.symbol()).to.be.equal("KARSHA");
            expect(await karsha.decimals()).to.be.equal(18);
            expect(await karsha.index()).to.be.equal(decimalRepresentation(1));
        });
        
        // bond parameters
        let bondID = 0;
        let capacity = decimalRepresentation(2500000);
        let initialPrice = decimalRepresentation(15,15); //initial price for bond as 0.015
        let vesting = 60*60*4 // 4 hours
        let depositInterval = 60*60*2; // 2 hours
        let tune=60*60*1; // 4 hours
        let buffer = 100e5;
        describe("Deposition functions", ()=>{
            let depositAmount : any;
            let maxPrice :any;
            
            beforeEach(async()=>{
                depositAmount = decimalRepresentation("100",USDCDecimals);
                maxPrice = decimalRepresentation("15",16);
                // minting tokens for user and treasury
                await usdc.addAuth(deployer.address);
                await usdc.connect(deployer).mint(deployer.address,    decimalRepresentation(10000000,USDCDecimals));
                await usdc.mint(user1.address,decimalRepresentation(100000,USDCDecimals));
                await usdc.connect(user1).approve(bondDepository.address, LARGE_APPROVAL);
                
                conclusion =  parseInt(block.timestamp)  + 86400;
                
                // bond market creation
                await bondDepository.connect(deployer).create(
                    usdc.address,
                    [capacity,initialPrice,buffer],
                    [false,true,false,true],
                    [vesting,conclusion] ,
                    [depositInterval,tune]);
                });
                it("should add bond",async()=>{
                    expect(await bondDepository.isLive(bondID)).to.be.equal(true);
                });
                
                it("should add multiple bonds",async()=>{
                
                    await bondDepository.connect(deployer).create(
                        usdc.address, [capacity,initialPrice,buffer],
                        [false,true,false,true],
                        [100,conclusion],[depositInterval,tune]);
                
                    let [first, second] = await bondDepository.liveMarkets();
                    expect(Number(first)).to.equal(0);
                    expect(Number(second)).to.equal(1);
                
                });

                it("should set correct reward rate",async() => {
                    await bondDepository.setRewards("1000","300");
                    // expect(await bondDepository.daoReward()).to.be.equal("500");
                    expect(await bondDepository.refReward()).to.be.equal("1000");
                    expect(await bondDepository.treasuryReward()).to.be.equal("300");
                });

                it("should close correct bond", async () => {
                
                    await bondDepository.connect(deployer).create(
                        usdc.address, [capacity,initialPrice,buffer],[false,true,false,true],
                        [100,conclusion],[depositInterval,tune]);
                
                    await bondDepository.close(0);
                    let [first] = await bondDepository.liveMarkets();
                    expect(Number(first)).to.equal(1);
                });
                
                it("should return correct maxpayout for bond",async()=>{
                    let [,,,,,maxPayout,,] = await bondDepository.markets(bondID);
                    var upperBound = Number(capacity) * 1.0033 / 12;
                    var lowerBound = Number(capacity) * 0.9967 / 12;
                    expect(Number(maxPayout)).to.be.greaterThan(lowerBound);
                    expect(Number(maxPayout)).to.be.lessThan(upperBound);
                
                
                });
                it("should start with price at initial price", async () => {
                    let lowerBound = Number(initialPrice) * 0.9999;
                    expect(Number(await bondDepository.marketPrice(bondID))).to.be.greaterThan(lowerBound);
                });
                
                it("should provide correct payout for price",async()=>{
                    let amount = decimalRepresentation(100,USDCDecimals);
                    let price = await bondDepository.marketPrice(bondID);
                    let expectedPayout = Number(amount) / Number(price);
                    let [payout,,] = await bondDepository.connect(user1).callStatic.deposit(
                        bondID,
                        amount,
                        maxPrice,
                        user1.address,
                        user2.address
                    );

                    expect(Number(payout)).to.be.greaterThanOrEqual(expectedPayout);
                });
                
                
                it("should create a deposit for user", async () => {
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        depositAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    expect((await bondDepository.indexesFor(user1.address)).length).to.equal(1);
                });
                
                it("should deposit correct amount",async()=>{
                    let balanceBefore = await usdc.balanceOf(user1.address);
                
                    await bondDepository.connect(user1).deposit(
                        0,depositAmount,maxPrice,user1.address,user2.address);
                    let balanceAfter = await usdc.balanceOf(user1.address);
                
                    expect(Number(depositAmount)).to.equal(Number(balanceBefore.sub(balanceAfter)));
                });

                it("should return correct reward on bonding",async() => {
                    await bondDepository.setRewards("0","2000");
                    let [payout,,] = await bondDepository.connect(user1).callStatic.deposit(
                        bondID,
                        depositAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        depositAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.greaterThanOrEqual(Number(payout.mul("2000").div("10000")));
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.lessThan(Number(payout.mul("2001").div("10000")));

                });

                it("should return correct reward based on reward rate",async ()=> {
                    await bondDepository.setRewards("100000","100000");
                    let [payout,,] = await bondDepository.connect(user1).callStatic.deposit(
                        bondID,
                        decimalRepresentation(15,USDCDecimals),
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        decimalRepresentation(15,USDCDecimals),
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    // get remaining rewards for treasury
                    await bondDepository.connect(deployer).getTreasuryRewards();
                    
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.greaterThanOrEqual(Number(payout.mul("200000").div("10000")));
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.lessThan(Number(payout.mul("200100").div("10000")));
                });

                it("should allow multiple deposits",async () => {
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        depositAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    await moveTimestamp(100);
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        depositAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    expect((await bondDepository.indexesFor(user1.address)).length).to.equal(2);
                });

                it("should set redeem correct payout post rebase",async()=>{
                    await moveTimestamp(EPOCH_LENGTH);
                    let balanceBefore = await karsha.balanceOf(user1.address);
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        depositAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        depositAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                    let indexes = await bondDepository.indexesFor(user1.address);
                    let payout=bigNumberRepresentation(0);
                    for(let i in indexes ){
                        let [pay,] =await bondDepository.pendingFor(user1.address,i)
                        payout = payout.add(pay);
                    }
                    await moveTimestamp(vesting);

                    await bondDepository.redeemAll(user1.address);
                    let balanceAfter = await karsha.balanceOf(user1.address);
                    expect(Number(balanceAfter)).to.be.equal(Number(balanceBefore) + Number(payout))
                });


                it("should decay debt as time increases",async()=>{
                    let [,,,,totalDebt,,,] = await bondDepository.markets(0);
                    await moveTimestamp(100);
                    await bondDepository.connect(user1).deposit(bondID, "1" ,maxPrice ,user1.address ,user2.address);
                    
                    let [,,,,newTotalDebt,,,] = await bondDepository.markets(0);
                    expect(Number(totalDebt)).to.be.greaterThan(Number(newTotalDebt));
                    
                });
                it("adjustment should lower control variable by change in tune interval if behind", async () => {
                    await moveTimestamp(tune)
                   
                    let [, controlVariable, , ,] = await bondDepository.terms(bondID);
                   
                    let amountCV = decimalRepresentation(1000,USDCDecimals);                
                    await bondDepository.connect(user1).deposit(bondID, amountCV, maxPrice, user1.address, user2.address);
                    
                    await moveTimestamp(tune)
                 
                    let [change,,,] = await bondDepository.adjustments(bondID);

                    await bondDepository.connect(user1).deposit(bondID, amountCV, maxPrice, user1.address, user2.address);
                    let [, newControlVariable, , ,] = await bondDepository.terms(bondID);
                    expect(newControlVariable).to.equal(controlVariable.sub(change));
                });
                
                it("should not allow deposit more than max payout",async()=>{
                    
                    let maxAmount = decimalRepresentation(50000,USDCDecimals); // 5000 (0.015 * 2500000 / 12 + 0.5%)
                    await expect(bondDepository.connect(user1).deposit(
                        bondID,
                        maxAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                        )).to.be.revertedWith("Depository: max size exceeded");
                });
                    
                it("should not redeem before vested", async () => {
                    let balance = await pana.balanceOf(user1.address);
                    
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        depositAmount,
                        maxPrice,
                        user1.address,
                        user2.address
                        );
                        await bondDepository.connect(user1).redeemAll(user1.address);
                    expect(await karsha.balanceOf(user1.address)).to.equal(balance);
                });
                    
                    
                it("should redeem bonds",async()=>{ 
                        
                    let [expectedPayout,,] =await bondDepository.connect(user1).callStatic.deposit(
                        0,depositAmount,maxPrice,user1.address,user2.address);
                    await bondDepository.connect(user1).deposit(
                        0,depositAmount,maxPrice,user1.address,user2.address);
                                
                    await moveTimestamp(vesting);
                    await bondDepository.connect(user1).redeemAll(user1.address);
                    
                    let balanceAfter = Number(await karsha.balanceOf(user1.address));
                    expect(balanceAfter).to.greaterThanOrEqual(Number(await karsha.balanceTo(expectedPayout)));
                    expect(balanceAfter).to.lessThan(Number(await karsha.balanceTo(expectedPayout))*1.0001);
                        
                });
                    
                it("should decay maxpayout after tune interval",async()=>{
                    let [,,,,,maxPayout,,] = await bondDepository.markets(bondID);
                    let price = await bondDepository.marketPrice(bondID);
                    let maxAmount = (maxPayout).div(decimalRepresentation(1,30)).mul(price).mul(997).div(1000); 
                    await bondDepository.connect(user1).deposit(
                        bondID,
                        maxAmount, // amount for max payout
                        maxPrice,
                        user1.address,
                        user2.address
                    );
                   
                    await moveTimestamp(depositInterval);                                
                    let newPrice = await bondDepository.marketPrice(bondID);
                    expect(Number(newPrice)).to.be.lessThan(Number(initialPrice));
                    
                });
                it("should close a bond", async () => {
                    let [bondCapacity,,,,,,,] = await bondDepository.markets(bondID);
                    expect(Number(bondCapacity)).to.be.greaterThan(0);
                    await bondDepository.connect(deployer).close(bondID);
                    [bondCapacity,,,,,,,] = await bondDepository.markets(bondID);
                    expect(Number(bondCapacity)).to.equal(0);
                });
                
                
                it("Should conclude bond",async()=>{
                    
                    expect(await bondDepository.isLive(bondID)).to.be.equal(true);
                    await moveTimestamp(conclusion);
                    expect(await bondDepository.isLive(bondID)).to.be.equal(false);
                });
                
                
            });
     });