import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber,Contract,  } from "ethers";
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
    PanaSlidingWindowOracle,
    PanaSlidingWindowOracle__factory,
    UniswapV2Factory,
    UniswapV2Factory__factory,
    UniswapV2Pair__factory,
    UniswapV2Router02__factory,
    UniswapV2Router02,
    PanaBondingCalculator,
    PanaBondingCalculator__factory,
    PanaSupplyController,
    PanaSupplyController__factory,
    
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

const BASE_VALUE = 100;
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
};

// constants
const EPOCH_LENGTH = 60*60*1;
const EPOCH_NUMBER = 0;
const LARGE_APPROVAL = "100000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Setting epoch to 1 for easier testing
const blocksNeededForQueue = 1;

const INITIAL_REWARD_RATE = "0";

describe("Pana reserve Supply control", () => {
    // initializing variables
    let deployer: SignerWithAddress;
    let vault: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let pana: PanaERC20Token;
    let usdc : USDC;
    let karsha: Karsha;
    let sPana: SPana;
    let distributor: Distributor
    let staking: PanaStaking;
    let treasury:PanaTreasury;
    let bondDepository:PanaBondDepository;
    let authority:PanaAuthority;
    let lpfactory: UniswapV2Factory;
    let LP : Contract;
    let slidingWindow : PanaSlidingWindowOracle;
    let uniswapRouter : UniswapV2Router02;
    let USDCDeposited : BigNumber;
    let PanaDeposited : BigNumber;
    let bondingCalculator : PanaBondingCalculator;
    let supplyControl : PanaSupplyController;
    let USDCDecimals : number;
    let PANADecimals: number;
    let block: any;
    
    // contract deployment
    beforeEach(async () => {
        [deployer, vault, user1, user2] = await ethers.getSigners();
       
        block = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
        
        usdc = await (new USDC__factory(deployer)).deploy(0);
        
        authority = await (new PanaAuthority__factory(deployer))
                        .deploy(deployer.address, deployer.address, deployer.address, vault.address, ZERO_ADDRESS);
        await authority.deployed();
        
        pana = await (new PanaERC20Token__factory(deployer)).deploy(authority.address);
        sPana = await (new SPana__factory(deployer)).deploy();
        karsha = await (new Karsha__factory(deployer)).deploy(deployer.address, sPana.address);
        
        treasury = await (new PanaTreasury__factory(deployer)).deploy(pana.address, blocksNeededForQueue, authority.address);
        staking = await new PanaStaking__factory(deployer).deploy(pana.address, sPana.address, karsha.address, authority.address);
        distributor = await new Distributor__factory(deployer)
                        .deploy(treasury.address, pana.address, staking.address, authority.address);
        
        karsha.migrate(staking.address, sPana.address);
        bondDepository = await new PanaBondDepository__factory(deployer)
                            .deploy(authority.address, pana.address, karsha.address, staking.address, treasury.address);
        
        
        lpfactory = await new UniswapV2Factory__factory(deployer).deploy(deployer.address);
        uniswapRouter = await (new UniswapV2Router02__factory(deployer)).deploy(lpfactory.address, ZERO_ADDRESS);
        bondingCalculator = await new PanaBondingCalculator__factory(deployer).deploy(pana.address);        
        
        await lpfactory.createPair(usdc.address, pana.address);
        
        slidingWindow = await( new PanaSlidingWindowOracle__factory(deployer).deploy(lpfactory.address, 3600, 2));
        
        LP = await( new UniswapV2Pair__factory(deployer)).attach(await lpfactory.getPair(usdc.address, pana.address));

        supplyControl = await new PanaSupplyController__factory(deployer)
                            .deploy(pana.address, LP.address, uniswapRouter.address, treasury.address, authority.address);
        
        USDCDecimals = await usdc.decimals();
        PANADecimals = await pana.decimals();
        PanaDeposited = decimalRepresentation("1000000", PANADecimals); // 1,000,000 pana 
        USDCDeposited = decimalRepresentation("500000", USDCDecimals); // 50,000 USDC 
        
        // to add liquidity
        await pana.connect(vault).mint(deployer.address,PanaDeposited);
        await usdc.connect(deployer).mint(deployer.address,USDCDeposited);
        await usdc.connect(deployer).mint(deployer.address,decimalRepresentation("1000000",USDCDecimals));
        await pana.connect(vault).mint(user1.address,PanaDeposited);
        await usdc.connect(deployer).mint(user1.address,USDCDeposited);
        await pana.connect(vault).mint(treasury.address,decimalRepresentation("50000"));
        await pana.connect(vault).mint(user2.address,decimalRepresentation("950000"));
        
        // Needed to spend deployer's PANA
        await sPana.setIndex("1000000000000000000"); // index = 1
        await sPana.setKarsha(karsha.address);
        await sPana.initialize(staking.address, treasury.address, deployer.address);
        await staking.setDistributor(distributor.address);
        
        // Enabling permissions for treasury
        // enable distributor and bondDepository as reward managers
        await treasury.enable("8", distributor.address, ZERO_ADDRESS, ZERO_ADDRESS);
        await treasury.enable("8", bondDepository.address, ZERO_ADDRESS, ZERO_ADDRESS);

        // enable deployer and bondDepository reserve depositors
        await treasury.enable("0", deployer.address, ZERO_ADDRESS, ZERO_ADDRESS);
        await treasury.enable('0', bondDepository.address, ZERO_ADDRESS, ZERO_ADDRESS);

        // enable deployer and bondDepository as liquidity depositors
        await treasury.enable("4", deployer.address, ZERO_ADDRESS, ZERO_ADDRESS);
        await treasury.enable("4", bondDepository.address, ZERO_ADDRESS, ZERO_ADDRESS);
        
        // enable USDC as reserve token
        await treasury.enable("2", usdc.address, ZERO_ADDRESS, ZERO_ADDRESS);

        // enable LP as liquidity token
        await treasury.enable("5", LP.address, bondingCalculator.address, supplyControl.address);
        await treasury.initialize();
        
        // set base value on treasury
        await treasury.connect(deployer).setBaseValue('100000000000');

        await authority.pushVault(treasury.address, true);
        await staking.setBondDepositor(bondDepository.address);
        await distributor.connect(deployer).addRecipient(staking.address, INITIAL_REWARD_RATE);
        await staking.setFirstEpoch(EPOCH_LENGTH, EPOCH_NUMBER, parseInt(block.timestamp) + 3600);
        
        // setting price oracle
        await bondDepository.connect(deployer).setPriceOracle(slidingWindow.address);

    });
    
    describe("Tests for initialization of supply control", async function() {

        it("Should initialize supply control with correct addresses/values", async() => {
            expect(await supplyControl.router()).to.equal(uniswapRouter.address);
            expect(await supplyControl.pair()).to.equal(LP.address);
            expect(await supplyControl.supplyControlCaller()).to.equal(treasury.address);
            expect(await supplyControl.paramsSet()).to.equal(false);
        });

        it("Should set correct supply control parameters", async() => {
            
            await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, 500);

            expect(await supplyControl.lossRatio()).to.equal(2250);
            expect(await supplyControl.cc()).to.equal(100);
            expect(await supplyControl.cf()).to.equal(100);
            expect(await supplyControl.mslp()).to.equal(500);
        });

        it("Should allow only the governor to set supply control parameters", async() => {
            await expect(supplyControl.connect(user1).setSupplyControlParams(2250, 100, 100, 500))
                    .to.be.revertedWith("UNAUTHORIZED");
        });

        it("Should allow only governor to enable supply control", async() => {
            await expect(supplyControl.connect(user1).enableSupplyControl()).to.be.revertedWith("UNAUTHORIZED");
        });

        it("Should not allow enablement of supply control if params are not set", async() => {
            await expect(supplyControl.connect(deployer).enableSupplyControl())
                    .to.be.revertedWith("CONTROL: Control parameters are not set, please set control parameters");
        });

        it("Should allow enablement of supply control if params are set", async() => {
            await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, 500);
            await supplyControl.connect(deployer).enableSupplyControl();
            expect(await supplyControl.supplyControlEnabled()).to.equal(true);
        });

        it("Should not allow enablement of supply control if control already in progress", async() => {
            await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, 500);
            await supplyControl.connect(deployer).enableSupplyControl();
            await expect(supplyControl.connect(deployer).enableSupplyControl())
                    .to.be.revertedWith("CONTROL: Control already in progress");
        });


        it("Should only allow the governor to disable supply control", async() => {
            await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, 500);
            await supplyControl.connect(deployer).enableSupplyControl();
            await expect(supplyControl.connect(user1).disableSupplyControl()).to.be.revertedWith("UNAUTHORIZED");
        });

        it("Should disable supply control", async() => {
            await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, 500);
            await supplyControl.connect(deployer).enableSupplyControl();      
            await supplyControl.connect(deployer).disableSupplyControl();
            expect(await supplyControl.supplyControlEnabled()).to.equal(false);
        });

        it("Should revert if already disabled", async() => {
            await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, 500);
            await supplyControl.connect(deployer).enableSupplyControl();      
            await supplyControl.connect(deployer).disableSupplyControl();
            await expect(supplyControl.connect(deployer).disableSupplyControl())
                    .to.be.revertedWith("CONTROL: No control in progress");
        });

        it("Should require re-setting params on re-enable", async() => {
            await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, 500);
            await supplyControl.connect(deployer).enableSupplyControl();
            await supplyControl.connect(deployer).disableSupplyControl();
            await expect(supplyControl.connect(deployer).enableSupplyControl())
                .to.be.revertedWith("CONTROL: Control parameters are not set, please set control parameters");
        });

        it("Should initialize treasury with supply control", async()=>{
            expect(await treasury.supplyController(LP.address)).to.equal(supplyControl.address); 
        });

    });
    
    describe("Tests for supply control operations", async function() {
        // bond parameters
        let capacity = decimalRepresentation("500000");
        let initialPrice = decimalRepresentation("1",17);
        let vesting = 60*60*4; // 4 hours
        let depositInterval = 60*60*24; // 24 hours
        let tune = 60*60*4; // 4 hours
        let buffer = 100e5;
        let conclusion:number;
        let depositAmount = decimalRepresentation("1", 6); // using a small amount in 6 decimals
        
        const getPanaReserve = async ()=>{
            let [amt1, amt2] = await LP.getReserves();
            return (pana.address == await LP.token0() ? amt1 :amt2);
        };

        const getSupplyRatio = async ()=>{
            let reserve = await getPanaReserve();
            let totalSupply = await pana.totalSupply();
            return reserve.mul(10000).div(totalSupply);
        };

        const getLossRatio = async (prevPanaInPool : any, prevTotalSupply : any)=>{
            let CurrentPanaInPool = await getPanaReserve();
            let CurrentTotalSupply = await pana.totalSupply();
            let numerator = prevPanaInPool > CurrentPanaInPool? prevPanaInPool.sub(CurrentPanaInPool) : CurrentPanaInPool.sub(prevPanaInPool);
            let denominator = prevTotalSupply > CurrentTotalSupply ? prevTotalSupply.sub(CurrentTotalSupply) : CurrentTotalSupply.sub(prevTotalSupply);
            return numerator.mul(10000).div(denominator);
        };

        describe("Reserve control by add/burn pana",() => {

            let lossratio = bigNumberRepresentation("2250");
            let cf = bigNumberRepresentation("100");
            let cc = bigNumberRepresentation("100");

            beforeEach( async() => {
                // to add liquidity
                await usdc.connect(deployer).approve(uniswapRouter.address, LARGE_APPROVAL);
                await pana.connect(deployer).approve(uniswapRouter.address, LARGE_APPROVAL);
                await usdc.connect(user1).approve(uniswapRouter.address, LARGE_APPROVAL);
                await pana.connect(user1).approve(uniswapRouter.address, LARGE_APPROVAL);
                
                // to add bonding
                await usdc.connect(deployer).approve(bondDepository.address, LARGE_APPROVAL);
                await usdc.connect(user1).approve(bondDepository.address, LARGE_APPROVAL);
                await LP.connect(deployer).approve(bondDepository.address, LARGE_APPROVAL);
                await LP.connect(user1).approve(bondDepository.address, LARGE_APPROVAL);
                await usdc.connect(deployer).approve(treasury.address, LARGE_APPROVAL);

                await treasury.connect(deployer).deposit(decimalRepresentation("10000",USDCDecimals),
                    usdc.address, panaIntrinsicValBigNumber("990000",PANADecimals,USDCDecimals));

                conclusion = parseInt(block.timestamp) + 86400; // 1 day

                // Add liquidity to the pool
                // Sets price at 1 USDC = 10 PANA
                let res = await uniswapRouter.connect(deployer)
                    .addLiquidity(
                        usdc.address, 
                        pana.address, 
                        decimalRepresentation("90000",USDCDecimals),
                        decimalRepresentation("900000",PANADecimals), 
                        0, 
                        0, 
                        deployer.address, 
                        conclusion
                    );

                let totalLPbalance = await LP.balanceOf(deployer.address);
                // transfering half of LP tokens acquired from adding liquidity by deployer
                await LP.connect(deployer).transfer(treasury.address, totalLPbalance.div(2));
                await slidingWindow.update(usdc.address, pana.address);

                await moveTimestamp(1800);

                await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, decimalRepresentation("200000"));
                
                await bondDepository.connect(deployer).create(
                    LP.address,
                    [capacity, decimalRepresentation(1,11), buffer], // initial price is set to 11 decimals since the price of LP is in 11 decimals
                    [false, true, true, true],
                    [vesting, conclusion] ,
                    [depositInterval, tune]);
                
                await bondDepository.connect(deployer).create(
                    usdc.address,
                    [capacity, initialPrice, buffer],
                    [false, true, false, true],
                    [vesting, conclusion] ,
                    [depositInterval, tune]);
            });
                    
            it("Should enable bonding by user", async () => {
                let balanceBefore = await LP.balanceOf(deployer.address);
                await bondDepository.connect(deployer)
                        .deposit(0, depositAmount, decimalRepresentation(1), deployer.address, user1.address);
                let balanceAfter = await LP.balanceOf(deployer.address);
                expect(balanceAfter).to.equal(balanceBefore.sub(depositAmount));
            });
            
            it("Should return correct target supply", async() => {
                let lastTotalSupply = await pana.totalSupply();
                let lastPanaPool = await getPanaReserve();
                await bondDepository.connect(deployer)
                        .deposit(0, depositAmount, decimalRepresentation(1), deployer.address, user1.address);
                let newTotalSupply = await pana.totalSupply();
                let target = lastPanaPool.add(lossratio.mul(newTotalSupply.sub(lastTotalSupply)).div(10000));
                expect(target).to.equal(await supplyControl.getTargetSupply());            
            });
            
            it("Should return correct supply floor", async() => {
                let lastPanaPool = await getPanaReserve();
                let lastTotalSupply = await pana.totalSupply();
                await bondDepository.connect(deployer)
                        .deposit(0, depositAmount, decimalRepresentation(1), deployer.address, user1.address);
                let newTotalSupply = await pana.totalSupply();            
                let target = lastPanaPool.add((lossratio.sub(cf)).mul(newTotalSupply.sub(lastTotalSupply)).div(10000));
                expect(target).to.equal(await supplyControl.getSupplyFloor());
            });
            
            it("Should return correct supply ceiling", async() => { 
                let lastPanaPool = await getPanaReserve();            
                let lastTotalSupply = await pana.totalSupply();
                await bondDepository.connect(deployer)
                        .deposit(0, depositAmount, decimalRepresentation(1), deployer.address, user1.address);
                let newTotalSupply = await pana.totalSupply();
                let target = lastPanaPool.add((lossratio.add(cc)).mul(newTotalSupply.sub(lastTotalSupply)).div(10000));
                expect(target).to.equal(await supplyControl.getSupplyCeiling());
            });

            it("Should return correct supply control amount on addition", async() => {
                // total supply is increased -> pana add into pool
                let panaInPool = await getPanaReserve();

                await bondDepository.connect(deployer)
                        .deposit(0,depositAmount, decimalRepresentation(1), deployer.address, user1.address);

                await supplyControl.connect(deployer).enableSupplyControl();

                let targetSupply = await supplyControl.getTargetSupply();
                let [expectedPanaSupply, expectedSLP, burn ] = await supplyControl.getSupplyControlAmount();

                expect(expectedPanaSupply).to.equal(targetSupply.sub(panaInPool));
                expect(expectedSLP).to.equal("0");
                expect(burn).to.equal(false);

            });

            it("Should return correct supply control amount on burning", async() => {
                // reserve supply is increased -> pana burn from pool
                await uniswapRouter.connect(user1)
                        .swapExactTokensForTokens(decimalRepresentation("100"), 0, [pana.address, usdc.address], user1.address, conclusion);

                await supplyControl.connect(deployer).enableSupplyControl();

                let panaInPool = await getPanaReserve();
                let lptotalSupply = await LP.totalSupply();

                let targetSupply = await supplyControl.getTargetSupply();
                let slpToBurn = ((panaInPool.sub(targetSupply)).mul(lptotalSupply)).div(panaInPool.mul(2));
                let [expectedPanaSupply, expectedSLP, burn] = await supplyControl.getSupplyControlAmount();

                expect(expectedPanaSupply).to.equal(panaInPool.sub(targetSupply));
                expect(expectedSLP).to.equal(slpToBurn);
                expect(burn).to.equal(true);

            });

            describe("Reserve control addition of pana to supply", () => {

                let lpBalance : Number;
                let panaBalance : any;

                beforeEach( async() => {

                    await slidingWindow.update(usdc.address, pana.address);
                    await moveTimestamp(1800);
                    await supplyControl.connect(deployer).enableSupplyControl();
                    lpBalance = await LP.balanceOf(treasury.address);
                    panaBalance = await pana.balanceOf(treasury.address);

                });

                it("Should check if correct amount is added on bonding", async() => {

                    // bond with usdc token
                    // increase in Total supply
                    let startingRatio = await getSupplyRatio();
                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("1000",USDCDecimals), decimalRepresentation(1), user1.address, user2.address);

                    // Increase in total supply leads to decrease in loss ratio
                    // Thus,Treasury should add pana to pool
                    let ratioAfterBond = await getSupplyRatio();
                    expect(Number( ratioAfterBond )).to.lessThan(Number(startingRatio));
                    
                    // bond with LP token to trigger addition of pana to Supply
                    await bondDepository.connect(deployer)
                            .deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(2251);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(2249);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.lessThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.greaterThan(Number(lpBalance));
                });

                it("Should check if correct amount is added on swapping liquidity", async() => {
                    // swapping USDC in with pana out
                    let startingRatio = await  getSupplyRatio();

                    await uniswapRouter.connect(user1)
                            .swapExactTokensForTokens(decimalRepresentation("100",USDCDecimals), 
                                                        0, 
                                                        [usdc.address, pana.address], 
                                                        user1.address, 
                                                        conclusion
                                                    );
                    // Decrease of pana in reserve leads to decrease in loss ratio
                    // Thus, Treasury should add pana to pool
                    let ratioAfterSwap = await getSupplyRatio();
                    expect(Number(ratioAfterSwap)).to.lessThan(Number(startingRatio));

                    // bond with LP token to trigger addition of pana to Supply
                    // NOTE: since this is the first bonding, rebase happens which is not calculated into supply control
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(ratioAfterSwap));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(2251);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(2249);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.lessThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.greaterThan(Number(lpBalance));

                });

                it("Should check if correct amount is added on adding liquidity", async() => {

                    let startingRatio = await  getSupplyRatio();
                    let panaInpool = await getPanaReserve();
                    let ts = await pana.totalSupply();

                    // bonding with usdc to increase total supply
                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("1000",USDCDecimals), decimalRepresentation(1), user1.address, user1.address);

                    // adding USDC and pana to liquidity pool
                    await uniswapRouter.connect(user1)
                            .addLiquidity(
                                            usdc.address,
                                            pana.address,
                                            decimalRepresentation("100",USDCDecimals),
                                            decimalRepresentation("1000",PANADecimals) ,
                                            0,
                                            0, 
                                            user1.address, 
                                            conclusion
                                        );

                    // increase of pana in reserve and increase of total supply 
                    // such that loss ratio decreases and goes out of channel
                    // Thus, Treasury should add pana to pool
                    let ratioAfterBond = await getSupplyRatio();
                    expect(Number(ratioAfterBond)).to.lessThan(Number(startingRatio));
                    expect(Number(await getLossRatio(panaInpool, ts))).to.be.lessThan(2150);

                    // bond with LP token to trigger addition of pana to Supply
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(2251);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(2249);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.lessThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.greaterThan(Number(lpBalance));

                });

                it("Should not add if treasury doesnt have enough supply", async() => {

                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("40000",USDCDecimals), decimalRepresentation(1), user1.address, user2.address);

                    let ratioAfterBond = await getSupplyRatio();
                    let [expectedPanaSupply, expectedSLP, burn] = await supplyControl.getSupplyControlAmount();

                    // Increase in total supply leads to decrease in loss ratio
                    // Thus,Treasury should add pana to pool
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await pana.balanceOf(treasury.address))).to.equal(Number(panaBalance));
                    expect(Number(await getSupplyRatio())).to.equal(Number(ratioAfterBond));
                });

            });

            describe("Reserve control burning of pana in supply", () => {

                let startingRatio : Number;
                let panaInPool : Number;
                let totalSupplyBefore : any;
                let lpBalance : Number;
                let panaBalance : any;

                beforeEach( async() => {
                    await supplyControl.connect(deployer).enableSupplyControl();
                    startingRatio = await  getSupplyRatio(); // initial supply ratio before adding liquidity to pool
                    panaInPool = await getPanaReserve();
                    totalSupplyBefore = await pana.totalSupply();
                    lpBalance = await LP.balanceOf(treasury.address);
                    panaBalance = await pana.balanceOf(treasury.address); 
                    await uniswapRouter.connect(user1)
                            .addLiquidity(
                                    usdc.address, 
                                    pana.address, 
                                    decimalRepresentation("1000",USDCDecimals), 
                                    decimalRepresentation("1000",PANADecimals) ,
                                    0,
                                    0,
                                    user1.address, 
                                    conclusion
                            );
                });

                it("Should check if correct amount is burnt on bonding", async() => {

                    // bond with usdc token
                    // increase in Total supply
                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("100",USDCDecimals), decimalRepresentation(1), user1.address, user2.address);

                    let ratioAfterBond = await getSupplyRatio();

                    expect(Number(ratioAfterBond)).to.greaterThan(Number(startingRatio));
                    expect(Number(await getLossRatio(panaInPool, totalSupplyBefore))).to.be.greaterThan(2350);
                    
                    // bond with LP token to trigger burning of pana from Supply
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);
                    
                    expect(Number(await getSupplyRatio())).to.be.lessThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(2251);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(2249);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.greaterThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.lessThan(Number(lpBalance));

                });

                it("Should check if correct amount is burnt on swapping liquidity", async() => {

                    // swapping pana in with usdc out
                    await uniswapRouter.connect(user1)
                            .swapExactTokensForTokens(
                                decimalRepresentation("100"),
                                0,
                                [pana.address, usdc.address],
                                user1.address,
                                conclusion
                            );
                    
                    let ratioAfterBond = await getSupplyRatio();
                    expect(Number( ratioAfterBond )).to.greaterThan(Number(startingRatio));

                    // bond with LP token to trigger addition of pana to Supply
                    // NOTE: since this is the first bonding, rebase happens which is not calculated into supply control
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);
                    
                    expect(Number(await getSupplyRatio())).to.be.lessThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(2251);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(2249);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.greaterThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.lessThan(Number(lpBalance));
                });

                it("Should check if correct amount is burnt on adding liquidity", async() => {

                    let ratioAfterBond = await getSupplyRatio();
                    expect(Number( ratioAfterBond )).to.greaterThan(Number(startingRatio));

                    // bond with LP token to trigger burn of pana from Supply
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);
                    
                    expect(Number(await getSupplyRatio())).to.be.lessThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(2251);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(2249);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.greaterThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.lessThan(Number(lpBalance));
                });

                it("Should not burn if treasury doesn't have enough supply", async() => {

                    await uniswapRouter.connect(user1)
                            .addLiquidity(
                                usdc.address,
                                pana.address, 
                                decimalRepresentation("200000",USDCDecimals), 
                                decimalRepresentation("900000",PANADecimals) ,
                                0,
                                0, 
                                user1.address, 
                                conclusion
                            );

                    let ratioAfter = await getSupplyRatio();
                    
                    // bond with LP token to trigger addition of pana to Supply
                    await bondDepository.connect(deployer).deposit(0,1,decimalRepresentation(1),deployer.address,user1.address);
                    
                    expect(Number(await pana.balanceOf(treasury.address))).to.equal(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.equal(Number(lpBalance));
                    expect(Number(await getSupplyRatio())).to.be.equal(Number(ratioAfter));
                });

            });
            describe("Reserve control change within channel",()=>{
                let lpBalance : any;
                let panaBalance : any;
                beforeEach( async() => {

                    await supplyControl.connect(deployer).enableSupplyControl();
                    lpBalance = await LP.balanceOf(treasury.address);
                    panaBalance = await pana.balanceOf(treasury.address);

                });
                it("Should not trigger add/burn if the loss ratio is within range", async() => {

                    let panaInpool = await getPanaReserve();
                    let ts = await pana.totalSupply();
                    // bonding with usdc to increase total supply = 4500 Pana  
                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("450",USDCDecimals), decimalRepresentation(1), user1.address, user1.address);

                    // adding USDC and pana to liquidity pool = 1000 pana
                    await uniswapRouter.connect(user1)
                            .addLiquidity(
                                            usdc.address,
                                            pana.address,
                                            decimalRepresentation("100",USDCDecimals),
                                            decimalRepresentation("1000",PANADecimals) ,
                                            0,
                                            0, 
                                            user1.address, 
                                            conclusion
                                        );


                    // increase of pana in reserve and increase of total supply 
                    // such that loss ratio is nullified and stays within channel 1000/4500 = 22.22%
                    // Thus, Treasury should not trigger burn
                    let ratioAfterBond = await getSupplyRatio();
                    let lossratioAfter = await getLossRatio(panaInpool,ts);
                    expect(Number(lossratioAfter)).to.greaterThan(Number(lossratio.sub(cf)));
                    expect(Number(lossratioAfter)).to.lessThan(Number(lossratio.add(cc)));

                    // bond with LP token to check triggering of burn/add of pana to Supply
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.equal(Number(ratioAfterBond));
                    expect(Number(await pana.balanceOf(treasury.address))).to.equal(Number(panaBalance));

                });

            });
            
        });
        
    });
});
    