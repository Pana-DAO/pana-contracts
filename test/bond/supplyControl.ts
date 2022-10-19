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
    SimpleUniswapOracle,
    SimpleUniswapOracle__factory,
    UniswapV2Factory,
    UniswapV2Factory__factory,
    UniswapV2Pair__factory,
    UniswapV2Router02__factory,
    UniswapV2Router02,
    ProportionalSupplyController,
    ProportionalSupplyController__factory,
    
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
    let slidingWindow : SimpleUniswapOracle;
    let uniswapRouter : UniswapV2Router02;
    let USDCDeposited : BigNumber;
    let PanaDeposited : BigNumber;
    let supplyControl : ProportionalSupplyController;
    let USDCDecimals : number;
    let PANADecimals: number;
    let block: any;
    
    // contract deployment
    beforeEach(async () => {
        [deployer, vault, user1, user2] = await ethers.getSigners();
       
        block = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
        
        usdc = await (new USDC__factory(deployer)).deploy(0);
        
        authority = await (new PanaAuthority__factory(deployer))
                        .deploy(deployer.address, deployer.address, deployer.address, vault.address, deployer.address);
        await authority.deployed();
        
        pana = await (new PanaERC20Token__factory(deployer)).deploy(authority.address);
        sPana = await (new SPana__factory(deployer)).deploy(authority.address);
        karsha = await (new Karsha__factory(deployer)).deploy(deployer.address,sPana.address,authority.address);
        
        treasury = await (new PanaTreasury__factory(deployer)).deploy(pana.address, blocksNeededForQueue, authority.address);
        staking = await new PanaStaking__factory(deployer).deploy(pana.address, sPana.address, karsha.address, authority.address);
        distributor = await new Distributor__factory(deployer)
                        .deploy(treasury.address, pana.address, staking.address, authority.address);
        
        await karsha.setStaking(staking.address);
        bondDepository = await new PanaBondDepository__factory(deployer)
                            .deploy(authority.address, pana.address, karsha.address, staking.address, treasury.address);
        
        
        lpfactory = await new UniswapV2Factory__factory(deployer).deploy(deployer.address);
        uniswapRouter = await (new UniswapV2Router02__factory(deployer)).deploy(lpfactory.address, ZERO_ADDRESS);
        
        await lpfactory.createPair(usdc.address, pana.address);
        
        slidingWindow = await( new SimpleUniswapOracle__factory(deployer).deploy(lpfactory.address));
        
        LP = await( new UniswapV2Pair__factory(deployer)).attach(await lpfactory.getPair(usdc.address, pana.address));

        supplyControl = await new ProportionalSupplyController__factory(deployer)
                            .deploy(10000, pana.address, LP.address, uniswapRouter.address, treasury.address, authority.address);
        
        USDCDecimals = await usdc.decimals();
        PANADecimals = await pana.decimals();
        PanaDeposited = decimalRepresentation("2000000", PANADecimals); // 2 million pana 
        USDCDeposited = decimalRepresentation("20000", USDCDecimals); // 20,000 USDC 
        let preMintedPana = decimalRepresentation("5000000",PANADecimals); // 5 million pana
        
        // to add liquidity
       
        // minting USDC
        await usdc.connect(deployer).mint(deployer.address,USDCDeposited);
        // await usdc.connect(deployer).mint(deployer.address,decimalRepresentation("1000000",USDCDecimals));
        await usdc.connect(deployer).mint(user1.address,USDCDeposited);

        // minting pana
        await pana.connect(deployer).mintForDistribution(preMintedPana);
        
        // Needed to spend deployer's PANA
        await sPana.setIndex("1000000000000000000"); // index = 1
        await sPana.setKarsha(karsha.address);
        await sPana.initialize(staking.address);
        await staking.setDistributor(distributor.address);
        
        // Enabling permissions for treasury
        // enable distributor and bondDepository as reward managers
        await treasury.enable("6", distributor.address, ZERO_ADDRESS);
        await treasury.enable("6", bondDepository.address, ZERO_ADDRESS);

        // enable deployer and bondDepository reserve depositors
        await treasury.enable("0", deployer.address, ZERO_ADDRESS);
        await treasury.enable('0', bondDepository.address, ZERO_ADDRESS);

        // enable deployer and bondDepository as liquidity depositors
        await treasury.enable("3", deployer.address, ZERO_ADDRESS);
        await treasury.enable("3", bondDepository.address, ZERO_ADDRESS);
        
        // enable USDC as reserve token
        await treasury.enable("1", usdc.address, ZERO_ADDRESS);

        // enable LP as liquidity token
        await treasury.enable("4", LP.address, supplyControl.address);
        await treasury.initialize();
        
        await authority.pushVault(treasury.address, true);
        await staking.connect(deployer).addApprovedDepositor(bondDepository.address);
        await distributor.connect(deployer).addRecipient(staking.address, INITIAL_REWARD_RATE,true);
        await staking.setFirstEpoch(EPOCH_LENGTH, EPOCH_NUMBER, parseInt(block.timestamp) + 3600);
        
        await bondDepository.connect(deployer).setPriceOracle(slidingWindow.address);

    });
    
    describe("Tests for initialization of supply control", async function() {

        it("Should initialize supply control with correct addresses/values", async() => {
            expect(await supplyControl.router()).to.equal(uniswapRouter.address);
            expect(await supplyControl.pair()).to.equal(LP.address);
            expect(await supplyControl.supplyControlCaller()).to.equal(treasury.address);
            expect(await supplyControl.paramsSet()).to.equal(false);
            expect(await supplyControl.kp()).to.equal(10000);
        });

        it("Should set correct supply control parameters", async() => {
            
            await supplyControl.connect(deployer).setSupplyControlParams(2250, 100, 100, 500);

            expect(await supplyControl.lossRatio()).to.equal(2250);
            expect(await supplyControl.cc()).to.equal(100);
            expect(await supplyControl.cf()).to.equal(100);
            expect(await supplyControl.samplingTime()).to.equal(500);
        });

        it("Should set correct supply control coefficient", async() => {
            expect(await supplyControl.kp()).to.equal(10000);
            await supplyControl.connect(deployer).setPCoefficient(100);
            expect(await supplyControl.kp()).to.equal(100);
        });

        it("Should allow only the policy owner to set supply control coefficient", async() => {
            await expect(supplyControl.connect(user1).setPCoefficient(100))
                    .to.be.revertedWith("UNAUTHORIZED");
        });

        it("Should not allow supply control coefficient to be greater than 10000", async() => {
            await expect(supplyControl.connect(deployer).setPCoefficient(90000))
                    .to.be.revertedWith("Proportional coefficient cannot be more than 1");
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
                    .to.be.revertedWith("CONTROL: Control parameters are not set");
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
                .to.be.revertedWith("CONTROL: Control parameters are not set");
        });

        it("Should initialize treasury with supply control", async()=>{
            expect(await treasury.supplyController(LP.address)).to.equal(supplyControl.address); 
        });

    });
    
    describe("Tests for supply control operations", async function() {
        // bond parameters
        let capacity = decimalRepresentation("500000");
        let initialPrice = decimalRepresentation("1",16); // 1 pana = 0.01 usdc 
        let vesting = 60*60*4; // 4 hours
        let depositInterval = 60*60*24; // 24 hours
        let tune = 60*60*4; // 4 hours
        let buffer = 100e5;
        let conclusion:number;
        let depositUSDC = decimalRepresentation("40", 6); // using a small amount in 6 decimals
        let depositLP = decimalRepresentation("20", 11 );  // using a small lp amount in 11 decimals
        
        const getPanaReserve = async ()=>{
            let [amt1, amt2] = await LP.getReserves();
            return (pana.address == await LP.token0() ? amt1 :amt2);
        };

        const getSupplyRatio = async ()=>{
            let reserve = await getPanaReserve();
            let totalSupply = await pana.totalSupply();
            return reserve.mul(10000).div(totalSupply);
        };

        describe("Reserve control by add/burn pana",() => {

            let lossratio = bigNumberRepresentation("4000");
            let cf = bigNumberRepresentation("2");
            let cc = bigNumberRepresentation("2");
            let ratiorUpperBound = 4001;
            let ratiorLowerBound = 3999;

            beforeEach( async() => {
                // to add liquidity
                await usdc.connect(deployer).approve(uniswapRouter.address, LARGE_APPROVAL);
                await pana.connect(deployer).approve(uniswapRouter.address, LARGE_APPROVAL);
                await usdc.connect(user1).approve(uniswapRouter.address, LARGE_APPROVAL);
                await pana.connect(user1).approve(uniswapRouter.address, LARGE_APPROVAL);
                
                // to add bonding
                await usdc.connect(deployer).approve(bondDepository.address, LARGE_APPROVAL);
                await LP.connect(deployer).approve(bondDepository.address, LARGE_APPROVAL);
                await usdc.connect(user1).approve(bondDepository.address, LARGE_APPROVAL);
                await LP.connect(user1).approve(bondDepository.address, LARGE_APPROVAL);


                conclusion = parseInt(block.timestamp) + 86400; // 1 day

                // Add liquidity to the pool
                // Sets price at 1 USDC = 10 PANA
                let res = await uniswapRouter.connect(deployer)
                    .addLiquidity(
                        usdc.address, 
                        pana.address, 
                        USDCDeposited,
                        PanaDeposited, 
                        0, 
                        0, 
                        deployer.address, 
                        conclusion
                    );

                let totalLPbalance = await LP.balanceOf(deployer.address);
                // transfering 1/4th of total LP tokens acquired from adding liquidity by deployer
                await LP.connect(deployer).transfer(treasury.address, totalLPbalance.mul(1).div(4));
                // transferring pre-minted pana to treasury and user
                await pana.connect(deployer).transfer(treasury.address, decimalRepresentation("150000",PANADecimals));
                await pana.connect(deployer).transfer(user1.address, decimalRepresentation("1500000",PANADecimals));


                // setting price oracle
                await slidingWindow.initialize(LP.address);
                moveTimestamp(1800)

                await supplyControl.connect(deployer).setSupplyControlParams(4000, 2, 2, 3600);
                
                await bondDepository.connect(deployer).create(
                    LP.address,
                    [capacity, decimalRepresentation(4,10), buffer], // initial price is set to 11 decimals since the price of LP is in 10 decimals
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
                        .deposit(0, depositLP, decimalRepresentation(1), deployer.address, user1.address);
                let balanceAfter = await LP.balanceOf(deployer.address);
                expect(balanceAfter).to.equal(balanceBefore.sub(depositLP));
            });
            
            it("Should return target supply if within range", async() => {
                
                let preSupplyRatio = await getSupplyRatio();
                await bondDepository.connect(user1)
                        .deposit(1, depositUSDC, decimalRepresentation(1), user1.address, user1.address);
                let newSupplyRatio = await getSupplyRatio();
                
                expect(Number(newSupplyRatio)).to.be.lessThan(Number(lossratio.sub(cf))); 
                expect(Number(newSupplyRatio)).to.be.lessThan(Number(preSupplyRatio)); 

                await supplyControl.connect(deployer).enableSupplyControl();

                let [expectedPanaSupply, expectedSLP, burn ] = await supplyControl.compute();
                expect(expectedPanaSupply).to.be.not.equal(0);     

            });

            it("Should return correct target supply with different coefficient", async() => {
            
                await supplyControl.setPCoefficient(500);
                let preSupplyRatio = await getSupplyRatio();
                await bondDepository.connect(user1)
                        .deposit(1, depositUSDC, decimalRepresentation(1), user1.address, user1.address);
                let newSupplyRatio = await getSupplyRatio();
            
                expect(Number(newSupplyRatio)).to.be.lessThan(Number(lossratio.sub(cf))); 
                expect(Number(newSupplyRatio)).to.be.lessThan(Number(preSupplyRatio)); 

                await supplyControl.connect(deployer).enableSupplyControl();
                let targetSupply = (await pana.totalSupply()).mul(lossratio).div(10000)

                let [expectedPanaSupply, expectedSLP, burn ] = await supplyControl.compute();
                expect(expectedPanaSupply).to.be.not.equal((await getPanaReserve()).sub(targetSupply).mul(500).div(10000));     

            });
            
            it("Should not return target supply if not within range", async() => {
 
                let preSupplyRatio = await getSupplyRatio();

                await bondDepository.connect(user1)
                        .deposit(1, '100000', decimalRepresentation(1), user1.address, user1.address);
                let newSupplyRatio = await getSupplyRatio();
                expect(Number(newSupplyRatio)).to.be.greaterThan(Number(lossratio.sub(cf))); 
                expect(Number(newSupplyRatio)).to.be.lessThan(Number(preSupplyRatio)); 

                await supplyControl.connect(deployer).enableSupplyControl();
                let [expectedPanaSupply, expectedSLP, burn ] = await supplyControl.compute();

                expect(expectedPanaSupply).to.be.equal(0);
                expect(expectedSLP).to.be.equal(0);
                expect(burn).to.be.equal(false);
            });

            it("Should return correct supply control amount on addition", async() => {
                // total supply is increased -> pana add into pool
                let panaInPool = await getPanaReserve();

                await bondDepository.connect(user1)
                        .deposit(1,depositUSDC, decimalRepresentation(1), user1.address, user1.address);

                await supplyControl.connect(deployer).enableSupplyControl();

                let targetSupply = (await pana.totalSupply()).mul(lossratio).div(10000);

                let [expectedPanaSupply, expectedSLP, burn ] = await supplyControl.compute();

                expect(expectedPanaSupply).to.equal(targetSupply.sub(panaInPool));
                expect(expectedSLP).to.equal("0");
                expect(burn).to.equal(false);

            });

            it("Should return correct supply control amount on burning", async() => {
                // reserve supply is increased -> pana burn from pool
                await uniswapRouter.connect(deployer)
                        .swapExactTokensForTokens(decimalRepresentation("2000"), 0, [pana.address, usdc.address], deployer.address, conclusion);

                await supplyControl.connect(deployer).enableSupplyControl();

                let panaInPool = await getPanaReserve();
                let lptotalSupply = await LP.totalSupply();

                let targetSupply = (await pana.totalSupply()).mul(lossratio).div(10000);
                let slpToBurn = ((panaInPool.sub(targetSupply)).mul(lptotalSupply)).div(panaInPool.mul(2));
                let [expectedPanaSupply, expectedSLP, burn] = await supplyControl.compute();

                expect(expectedPanaSupply).to.equal(panaInPool.sub(targetSupply));
                expect(expectedSLP).to.equal(slpToBurn);
                expect(burn).to.equal(true);

            });

            it("Should not trigger supply control if consecutive control lies within time frame ", async() => {
                // total supply is increased -> pana add into pool
                // let panaInPool = await getPanaReserve();
                await supplyControl.setPCoefficient(100);
                await bondDepository.connect(user1)
                        .deposit(1,depositUSDC, decimalRepresentation(1), user1.address, user1.address);

                await supplyControl.connect(deployer).enableSupplyControl();

                await treasury.updateSupplyRatio(LP.address);
                await treasury.updateSupplyRatio(LP.address);

                let [expectedPanaSupply, expectedSLP, burn ] = await supplyControl.compute();

                expect(expectedPanaSupply).to.equal(0);
                expect(expectedSLP).to.equal("0");
                expect(burn).to.equal(false);

            });

            describe("Reserve control addition of pana to supply", () => {

                let lpBalance : Number;
                let panaBalance : any;

                beforeEach( async() => {

                    await supplyControl.connect(deployer).enableSupplyControl();
                    lpBalance = await LP.balanceOf(treasury.address);
                    panaBalance = await pana.balanceOf(treasury.address);

                });

                it("Should check if correct amount is added to pool on bonding", async() => {

                    // bond with usdc token
                    // increase in Total supply
                    let startingRatio = await getSupplyRatio();
                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("1000",USDCDecimals), decimalRepresentation(1), user1.address, user2.address);

                    // Increase in total supply leads to decrease in loss ratio
                    // Thus,Treasury should add pana to pool
                    let ratioAfterBond = await getSupplyRatio();
                    expect(Number( ratioAfterBond )).to.lessThan(Number(startingRatio.sub(cf)));
                    
                    // bond with LP token to trigger addition of pana to Supply
                    await bondDepository.connect(deployer)
                            .deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(ratiorUpperBound);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(ratiorLowerBound);
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
                    expect(Number(ratioAfterSwap)).to.lessThan(Number(startingRatio.sub(cf)));

                    // bond with LP token to trigger addition of pana to Supply
                    // NOTE: since this is the first bonding, rebase happens which is not calculated into supply control
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(ratioAfterSwap));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(ratiorUpperBound);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(ratiorLowerBound);
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
                    expect(Number(ratioAfterBond)).to.lessThan(Number(startingRatio.sub(cf)));

                    // bond with LP token to trigger addition of pana to Supply
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(ratiorUpperBound);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(ratiorLowerBound);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.lessThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.greaterThan(Number(lpBalance));

                });

                it("Should add with treasury balance if treasury doesnt have enough supply", async() => {

                    let startingRatio = await  getSupplyRatio();


                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("4000",USDCDecimals), decimalRepresentation(1), user1.address, user2.address);

                    let ratioAfterBond = await getSupplyRatio();
                    let [expectedPanaSupply, expectedSLP, burn] = await supplyControl.compute();

                    // the treasury should not have enough pana to supply
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.lessThan(Number(expectedPanaSupply));
                    // Increase in total supply leads to decrease in loss ratio
                    expect(Number(ratioAfterBond)).to.lessThan(Number(startingRatio.sub(cf)));
                    // Thus,Treasury should add pana to pool 
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    // since treasury doesn't have enough supply it shouldn't trigger supply control
                    expect(Number(await pana.balanceOf(treasury.address))).to.equal(Number(0));
                    expect(Number(await getSupplyRatio())).to.greaterThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.lessThan(Number(startingRatio));

                });

                it("Should check if correct amount is added to pool with different coefficient", async() => {

                    // setting different coefficient
                    await supplyControl.setPCoefficient(9000);
                    // bond with usdc token
                    // increase in Total supply
                    let startingRatio = await getSupplyRatio();
                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("1000",USDCDecimals), decimalRepresentation(1), user1.address, user2.address);

                    // Increase in total supply leads to decrease in loss ratio
                    // Thus,Treasury should add pana to pool
                    let ratioAfterBond = await getSupplyRatio();
                    expect(Number( ratioAfterBond )).to.lessThan(Number(startingRatio.sub(cf)));

                    
                    // bond with LP token to trigger addition of pana to Supply
                    // 1st bond to control 90% of supply
                    await bondDepository.connect(deployer)
                            .deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(ratioAfterBond)); 
                    expect(Number(await getSupplyRatio())).to.be.lessThan(Number(lossratio)); 


                    await moveTimestamp(3600);                   
                    // 2nd bond to control another 90% of supply

                    await bondDepository.connect(deployer)
                            .deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(ratiorUpperBound);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(ratiorLowerBound);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.lessThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.greaterThan(Number(lpBalance));
                    
                });

            });

            describe("Reserve control burning of pana in supply", () => {

                let startingRatio : any ;
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
                                    decimalRepresentation("10000",PANADecimals) ,
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
                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(lossratio.add(cc)));
                    
                    // bond with LP token to trigger burning of pana from Supply
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);
                    
                    expect(Number(await getSupplyRatio())).to.be.lessThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(ratiorUpperBound);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(ratiorLowerBound);
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
                    expect(Number( ratioAfterBond )).to.greaterThan(Number(startingRatio.add(cc)));

                    // bond with LP token to trigger addition of pana to Supply
                    // NOTE: since this is the first bonding, rebase happens which is not calculated into supply control
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);
                    
                    expect(Number(await getSupplyRatio())).to.be.lessThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(ratiorUpperBound);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(ratiorLowerBound);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.greaterThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.lessThan(Number(lpBalance));
                });

                it("Should check if correct amount is burnt on adding liquidity", async() => {

                    let ratioAfterBond = await getSupplyRatio();
                    expect(Number( ratioAfterBond )).to.greaterThan(Number(startingRatio.add(cc)));

                    // bond with LP token to trigger burn of pana from Supply
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);
                    
                    expect(Number(await getSupplyRatio())).to.be.lessThan(Number(ratioAfterBond));
                    expect(Number(await getSupplyRatio())).to.be.lessThanOrEqual(ratiorUpperBound);
                    expect(Number(await getSupplyRatio())).to.be.greaterThanOrEqual(ratiorLowerBound);
                    expect(Number(await pana.balanceOf(treasury.address))).to.be.greaterThan(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.be.lessThan(Number(lpBalance));
                });

                it("Should burn with treasury balance if treasury doesn't have enough supply", async() => {

                    await uniswapRouter.connect(user1)
                            .addLiquidity(
                                usdc.address,
                                pana.address, 
                                decimalRepresentation("120000",USDCDecimals), 
                                decimalRepresentation("1250005",PANADecimals) ,
                                0,
                                0, 
                                user1.address, 
                                conclusion
                            );

                    let ratioAfter = await getSupplyRatio();
                    
                    // bond with LP token to trigger addition of pana to Supply
                    await bondDepository.connect(deployer).deposit(0,1,decimalRepresentation(1),deployer.address,user1.address);
                    
                    expect(Number(await LP.balanceOf(treasury.address))).to.equal(Number(0));
                    expect(Number(await getSupplyRatio())).to.be.greaterThan(Number(startingRatio));
                    expect(Number(await getSupplyRatio())).to.be.lessThan(Number(ratioAfter));
                });

            });
            describe("Reserve control change within channel",()=>{
                let lpBalance : any;
                let panaBalance : any;
                let channelFloor = bigNumberRepresentation(10);
                let channelCeil = bigNumberRepresentation(10);
                beforeEach( async() => {
                    await supplyControl.connect(deployer).setSupplyControlParams(4000, 10, 10, 600); // increasing channel floor and ceiling

                    await supplyControl.connect(deployer).enableSupplyControl();
                    lpBalance = await LP.balanceOf(treasury.address);
                    panaBalance = await pana.balanceOf(treasury.address);

                });
                it("Should not trigger add/burn if the loss ratio is within range", async() => {

                    // bonding with usdc to increase total supply = 2500 Pana  
                    await bondDepository.connect(user1)
                            .deposit(1, decimalRepresentation("25",USDCDecimals), decimalRepresentation(1), user1.address, user1.address);

                    // adding USDC and pana to liquidity pool (1000 pana)
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
                    // such that loss ratio is nullified and stays within channel 1000/2500 = 4.00%
                    // Thus, Treasury should not trigger burn
                    let ratioAfterBond = await getSupplyRatio();
                    expect(Number(ratioAfterBond)).to.greaterThan(Number(lossratio.sub(channelFloor))); 
                    expect(Number(ratioAfterBond)).to.lessThan(Number(lossratio.add(channelCeil)));

                    // bond with LP token to check triggering of burn/add of pana to Supply
                    await bondDepository.connect(deployer).deposit(0, 1, decimalRepresentation(1), deployer.address, user1.address);

                    expect(Number(await getSupplyRatio())).to.be.equal(Number(ratioAfterBond));
                    expect(Number(await pana.balanceOf(treasury.address))).to.equal(Number(panaBalance));
                    expect(Number(await LP.balanceOf(treasury.address))).to.equal(Number(lpBalance));

                });

            });
            
        });
        
    });
});
    