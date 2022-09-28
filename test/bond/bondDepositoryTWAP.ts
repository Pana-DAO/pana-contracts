import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber , Contract  } from "ethers";
import { ethers, network } from "hardhat";
import {
    PanaERC20Token,
    PanaERC20Token__factory,
    PanaAuthority__factory,
    USDC,
    DAI,
    DAI__factory,
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
    SimpleUniswapOracle,
    SimpleUniswapOracle__factory,
    UniswapV2Factory,
    UniswapV2Factory__factory,
    UniswapV2Pair__factory,
    UniswapV2Router02__factory,
    UniswapV2Router02
    
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
}
const getNormalValue  = function(number:any,decimals:number=18){                
    return Number(BigInt(number)/BigInt((10**(decimals))));
};

const BASE_VALUE = 100
const panaIntrinsicValBigNumber = (value: any, PANADecimals: number, tokDecimals: number) => {
    return bigNumberRepresentation(value.toString()).mul(BASE_VALUE).mul(bigNumberRepresentation(10 ** PANADecimals ).div(bigNumberRepresentation( 10 ** tokDecimals )));
};

const ONE = ethers.BigNumber.from(1);
const TWO = ethers.BigNumber.from(2);
const sqrt= (value:any)=> {
    let x = ethers.BigNumber.from(value.toString());
    let z = x.add(ONE).div(TWO);
    let y = x;
    while (z.sub(y).isNegative()) {
        y = z;
        z = x.div(z).add(z).div(TWO);
    }
    return y;
}

// constants
const EPOCH_LENGTH = 60*60*1;
const EPOCH_NUMBER = 0;
const LARGE_APPROVAL = "100000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Setting epoch to 1 for easier testing
const blocksNeededForQueue = 1;

const INITIAL_REWARD_RATE = "5000";
const chainIds = {
    hardhat: 31337,
    mumbai: 80001
};

describe("Pana reserve bond contract", () => {
    // initializing variables
    let deployer: SignerWithAddress;
    let vault: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let rewardManager: SignerWithAddress;
    let reserveDepositor: SignerWithAddress;
    let pana: PanaERC20Token;
    let USDC : USDC;
    let karsha: Karsha;
    let sPana: SPana;
    let distributor: Distributor
    let staking: PanaStaking;
    let treasury:PanaTreasury;
    let bondDepository:PanaBondDepository;
    let authority:PanaAuthority;
    let lpfactory: UniswapV2Factory;
    let LP: Contract;
    let SimpleOracle: SimpleUniswapOracle;
    let uniswapRouter: UniswapV2Router02;
    let USDCDepositedToLP:BigNumber,PanaDepositedToLP:BigNumber;
    let block: any;
    let USDCDecimals :number;
    let PANADecimals: number;
    
    // contract deployment
    beforeEach(async () => {
        [deployer, vault, user1, user2,reserveDepositor,rewardManager] = await ethers.getSigners();
        
        block = await network.provider.send("eth_getBlockByNumber", ["latest", false]);

        USDC = await (new USDC__factory(deployer)).deploy(0);
        
        authority = await (new PanaAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address, deployer.address);
        await authority.deployed();
        
        pana = await (new PanaERC20Token__factory(deployer)).deploy(authority.address);
        sPana = await (new SPana__factory(deployer)).deploy(authority.address);
        karsha = await (new Karsha__factory(deployer)).deploy(deployer.address,sPana.address,authority.address);
        
        treasury = await (new PanaTreasury__factory(deployer)).deploy(pana.address, blocksNeededForQueue, authority.address);
        staking = await new PanaStaking__factory(deployer).deploy(pana.address,sPana.address,karsha.address,authority.address);
        distributor = await new Distributor__factory(deployer).deploy(treasury.address,pana.address,staking.address,authority.address);
        
        await karsha.setStaking(staking.address);
        bondDepository = await new PanaBondDepository__factory(deployer).deploy(
            authority.address,pana.address,karsha.address,staking.address,treasury.address);
            
            
            lpfactory = await new UniswapV2Factory__factory(deployer).deploy(deployer.address);
            uniswapRouter = await (new UniswapV2Router02__factory(deployer)).deploy(lpfactory.address,ZERO_ADDRESS);
            
            await lpfactory.createPair(USDC.address,pana.address);
            
            // alternate method to deploy
            // LP = await new Contract( await lpfactory.getPair(USDC.address,pana.address),JSON.stringify(IUniswapV2Pair__factory.abi),deployer ).connect(deployer);
            
            SimpleOracle = await ( new SimpleUniswapOracle__factory(deployer).deploy(lpfactory.address));
            
            LP = await( new UniswapV2Pair__factory(deployer)).attach(await lpfactory.getPair(USDC.address,pana.address));
            USDCDecimals = await USDC.decimals();
            PANADecimals = await pana.decimals();
            
            // price = 4/100 = 0.04 USDC/pana
            PanaDepositedToLP = decimalRepresentation("2000000", PANADecimals); // 2000000 pana 
            USDCDepositedToLP = decimalRepresentation("40000", USDCDecimals); // 40000 USDC 
            
            await pana.connect(deployer).mintForDistribution(decimalRepresentation("5000000"));
            await USDC.connect(deployer).mint(deployer.address,USDCDepositedToLP);
   
            
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
            await treasury.enable("0", deployer.address, ZERO_ADDRESS);
            await treasury.enable('0',bondDepository.address,ZERO_ADDRESS);
            // toggle liquidity depositor
            await treasury.enable("3", deployer.address,ZERO_ADDRESS);
            await treasury.enable("3", bondDepository.address,ZERO_ADDRESS);

            // toggle USDC as reserve token
            await treasury.enable("1", USDC.address,ZERO_ADDRESS);
            // toggle LP as liquidity token
            await treasury.enable("4", LP.address,ZERO_ADDRESS);
            
            //Add reserve depositor and manage for LP bonds
            //  await treasury.connect(deployer).enable(0, reserveDepositor.address, ZERO_ADDRESS);
            // await treasury.connect(deployer).enable(8, rewardManager.address, ZERO_ADDRESS);
            await treasury.initialize();
            
            await authority.pushVault(treasury.address, true);
            await staking.connect(deployer).addApprovedDepositor(bondDepository.address);
            await distributor.connect(deployer).addRecipient(staking.address, INITIAL_REWARD_RATE,true);
            await staking.setFirstEpoch(EPOCH_LENGTH, EPOCH_NUMBER, parseInt(block.timestamp) + 3600);
            
            // setting oracle price
            await bondDepository.connect(deployer).setPriceOracle(SimpleOracle.address);
        });
        
        
        let bondID = 0;
        let capacity = decimalRepresentation("250000");
        let initialPrice = decimalRepresentation("25",15);
        let vesting = 60*60*4 // 4 hours
        let depositInterval = 60*60; // 1 hour
        let tune=60*60*1; // 4 hours
        let buffer = 100e5;
        let conclusion:number;

        
        describe("Liquidity Addition to Pool", ()=>{
            
            beforeEach(async()=>{
                conclusion = parseInt(block.timestamp) + 86400; // 1 day
                
                await USDC.connect(deployer).approve(uniswapRouter.address,LARGE_APPROVAL);
                await pana.connect(deployer).approve(uniswapRouter.address,LARGE_APPROVAL);
                await USDC.connect(user1).approve(uniswapRouter.address,LARGE_APPROVAL);
                await pana.connect(user1).approve(uniswapRouter.address,LARGE_APPROVAL);
                
                await uniswapRouter.connect(deployer).addLiquidity(USDC.address,pana.address,              
                    USDCDepositedToLP,PanaDepositedToLP,BigNumber.from("0")
                    ,BigNumber.from("0"),                
                    deployer.address,
                    conclusion);
                    //
                await SimpleOracle.initialize(LP.address);
                moveTimestamp(1800)
                
                
                await USDC.connect(user1).approve(bondDepository.address, LARGE_APPROVAL);
            });
                
                // bond market creation
                
            describe("Deposition functions for naked USDC bond", ()=>{
                
                beforeEach(async()=>{
                    // minting tokens for user and treasury
                    await USDC.addAuth(deployer.address);
                    await USDC.connect(deployer).mint(deployer.address,    decimalRepresentation("10000000",USDCDecimals));
                    await USDC.connect(deployer).approve(treasury.address, decimalRepresentation("10000000",USDCDecimals));
                    await USDC.mint(user1.address,decimalRepresentation(100000,USDCDecimals));
                    await USDC.connect(user1).approve(bondDepository.address, LARGE_APPROVAL);
                    await bondDepository.connect(deployer).create(
                        USDC.address,
                        [capacity,initialPrice,buffer],
                        [false,true,false,true],
                        [vesting,conclusion] ,
                        [depositInterval,tune]);
                    });
                    
                    
                    it("should add bond",async()=>{
                        expect(await bondDepository.isLive(bondID)).to.be.equal(true);
                    });
                    it("should set sliding window oracle in depository",async()=>{
                        expect( await bondDepository.priceOracle()).to.be.equal(SimpleOracle.address);
                    });
                    it("should return correct price from oracle",async()=>{
                        
                        let OraclePrice = await bondDepository.getOraclePriceView(0);

                        // price = (tokenA * decimalsB) / (tokenB * decimalsA) * 10**18
                        let tokenPrice = USDCDepositedToLP.mul(decimalRepresentation(1)).mul(decimalRepresentation(1,PANADecimals-USDCDecimals)).div(PanaDepositedToLP);
                        let upperbound = Number(tokenPrice) * 1.0001;
                        let lowerbound = Number(tokenPrice) * 0.0997;
                        expect(Number(OraclePrice)).to.be.lessThanOrEqual(upperbound);
                        expect(Number(OraclePrice)).to.be.greaterThanOrEqual(lowerbound);
                        
                    });
                    it("should return correct market price when negative discount",async()=>{
                        
                        // assuming initial price as 1 USDC for 1 pana
                        await bondDepository.connect(deployer).create(
                            USDC.address,
                            [capacity,decimalRepresentation(1),buffer],
                            [false,true,false,true],
                            [vesting,conclusion] ,
                            [depositInterval,tune]);
                            
                            let OraclePrice = await bondDepository.getOraclePriceView(0);

                            // amount = AmtUSDC(6) * (36) / USDCDecimals(6)
                            //payout = amount / price
                            let expectedPayout = Number(decimalRepresentation(1,36)) /Number(OraclePrice); 
                        
                            let [Payout,,] =await bondDepository.connect(user1).callStatic.deposit(
                                    1,decimalRepresentation(1,USDCDecimals),decimalRepresentation(1),user1.address,user2.address);
                            
                            expect(expectedPayout).to.be.equal(Number(Payout));
                            
                        });
                        
                    });

                    describe("Deposition functions for naked Lp bond", ()=>{

                        beforeEach(async()=>{
                    
                            // await LP.addAuth(deployer.address);
                            await USDC.connect(deployer).mint(deployer.address,    decimalRepresentation("10000000",USDCDecimals));
                            // await LP.connect(deployer).approve(treasury.address, decimalRepresentation("10000000"));

                            // await USDC.connect(deployer).approve(treasury.address, decimalRepresentation("10000000",USDCDecimals));
                            await LP.connect(deployer).approve(bondDepository.address, LARGE_APPROVAL);
                            
                            await bondDepository.connect(deployer).create(
                                LP.address,
                                [capacity,decimalRepresentation(1),buffer],
                                [false,true,true,true],
                                [vesting,conclusion] ,
                                [depositInterval,tune]);
                            });
                        it("should add bond",async()=>{
                            expect(await bondDepository.isLive(0)).to.be.equal(true);
                        });
                        it("should set sliding window in depository",async()=>{
                            expect( await bondDepository.priceOracle()).to.be.equal(SimpleOracle.address);
                        });
                        it("should return correct price from oracle",async()=>{
                        
                            let OraclePrice = await bondDepository.getOraclePriceView(0);
                            let NumberofLP = sqrt(USDCDepositedToLP.mul(PanaDepositedToLP));
                            let lpPrice =  NumberofLP.mul(decimalRepresentation(1,18)).div(PanaDepositedToLP).div(2);

                            let upperbound = Number(lpPrice) * 1.0001;
                            let lowerbound = Number(lpPrice) * 0.9997;
                            expect(Number(OraclePrice)).to.be.lessThanOrEqual(upperbound);
                            expect(Number(OraclePrice)).to.be.greaterThanOrEqual(lowerbound);
                            
                        });
                        it("should return correct market price when negative discount",async()=>{
                            
                            // assuming initial price as 1 USDC for 1 pana
                            await bondDepository.connect(deployer).create(
                                LP.address,
                                [capacity,decimalRepresentation(1),buffer],
                                [false,true,true,true],
                                [vesting,conclusion] ,
                                [depositInterval,tune]);
                                
                                let OraclePrice = await bondDepository.getOraclePriceView(0);
                                let expectedPayout = decimalRepresentation(1,USDCDecimals+PANADecimals).div(OraclePrice);  // amout = 10**(usdcDecimal+panadecimals)
                            
                                let [Payout,,] =await bondDepository.connect(deployer).callStatic.
                                deposit(1,decimalRepresentation(1,USDCDecimals),decimalRepresentation(1),deployer.address,user2.address);
                                
                                expect(Number(expectedPayout)).to.be.equal(Number(Payout));
                                
                            });
                    });
                    
                });
            });