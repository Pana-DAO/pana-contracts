import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
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

// for charts rendering
import { ChartJSNodeCanvas, ChartCallback } from "chartjs-node-canvas";
import { ChartConfiguration } from "chart.js";
import { promises as fs } from 'fs';

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

const CHART_WIDTH: number = 1200;
const CHART_HEIGHT: number = 600;

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
    let preMintedPana: any;
    
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
                            .deploy(180, pana.address, LP.address, uniswapRouter.address, treasury.address, authority.address);
        
        USDCDecimals = await usdc.decimals();
        PANADecimals = await pana.decimals();
        // total pana = 6019948
        // to add liquidity pana = 3,749,224 
        // to add liquidity usdc = 37,492
        PanaDeposited = decimalRepresentation("3749224", PANADecimals); 
        USDCDeposited = decimalRepresentation("37492", USDCDecimals); 
        preMintedPana = decimalRepresentation("6019948",PANADecimals); // 5 million pana
        
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
        
        const getPanaReserve = async ()=>{
            let [amt1, amt2] = await LP.getReserves();
            return (pana.address == await LP.token0() ? amt1 :amt2);
        };
        const getUSDCReserve = async ()=>{
            let [amt1, amt2] = await LP.getReserves();
            return (usdc.address == await LP.token0() ? amt1 :amt2);
        };

        describe("Reserve control by add/burn pana",() => {

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
                await LP.connect(deployer).transfer(treasury.address, totalLPbalance);
                // transferring pre-minted pana to treasury and user
                await pana.connect(deployer).transfer(treasury.address, preMintedPana.sub(PanaDeposited).div(3));
                await pana.connect(deployer).transfer(user1.address, preMintedPana.sub(PanaDeposited).div(3));


                // setting price oracle
                await slidingWindow.initialize(LP.address);
                moveTimestamp(1800)

                await supplyControl.connect(deployer).setSupplyControlParams(2250, 50, 50, 3600);
                
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
                
            it("model #1", async function (done) {
     
                await bondDepository.connect(user1)
                        .deposit(1, decimalRepresentation(100,6), decimalRepresentation(1), user1.address, user1.address);
                await bondDepository.connect(user1)
                        .deposit(1, decimalRepresentation(100,6), decimalRepresentation(1), user1.address, user1.address);


                await supplyControl.connect(deployer).enableSupplyControl();

                let target = toDecimalBignumber((await pana.totalSupply()).mul(await supplyControl.lossRatio()).div(10000),18);
                // add more targets to simulate target supply ratio change
                let targets =  new Map<number, number>([
                    [0, target], // zero element is required
                    //[100, 28.0]
                ]);
    
                // add disturbances to simulate external forces on supply ratio (buy/sell or add/remove liquidity)
                let disturbances = new Map<number, number>([
                    //[8, -3.0],
                    //[20, -1.5],
                    //[96, +12.5]
                ]);

                let initialSupply = toDecimalBignumber( await getPanaReserve(),18) ; //45.0
                let ticks = 300;
    
                await runModelling(initialSupply, targets, disturbances, ticks, "model-01.png");
                done();
            }).timeout(8000000);
                 

            async function runModelling(
                initialSupply: number,
                targets: Map<number, number>, 
                disturbances: Map<number, number>,
                ticks: number,
                outputFilename: string) {
                    
                if (!targets.has(0)) throw "Initial target not set";
    
                let targetSupply = targets.get(0)!; // target supply
                let supply = initialSupply; // supply
                let governedSupply = supply; // pid modified supply
    
                let targetSeries = Array<number>();
                let ratioSeries = Array<number>();
                let gratioSeries = Array<number>();
    
                // initial state points
                targetSeries.push(targetSupply);
                ratioSeries.push(supply);
                gratioSeries.push(governedSupply);
    
             
                let initialTreasuryBalanceLP = await LP.balanceOf(treasury.address);
                let initialPanaInReserve = await getPanaReserve();
                console.log("Initial Treasury balance of LP: ",Number(initialTreasuryBalanceLP));
                console.log("Initial PANA in reserve: "+ toDecimalBignumber(initialPanaInReserve,18));
                console.log("Initial USDC in reserve: "+toDecimalBignumber(await getUSDCReserve(),6)+"\n");

                for (let t = 0; t < ticks; t++) {
                    if (disturbances.has(t)) {
                        // account for external disturbances 
                        governedSupply += disturbances.get(t)!;
                        supply += disturbances.get(t)!;
                    }
    
                    // not implemented
                    //if (targets.has(t)) {
                    //    // check for target changes
                   //     targetRatio = targets.get(t)!;
                   // }
    
                    let [panaAmt, slp, burn] = await supplyControl.compute();

    
                    let output = toDecimalBignumber(panaAmt, 18);
                    output = burn? -output : output;
                    governedSupply += output;

                    let totalSupply = toDecimalBignumber(await pana.totalSupply(), 18);
                    
                    console.log('output #' + t + ": ",  output, "current supply :", governedSupply, "g-ratio :", governedSupply / totalSupply );
    
                    targetSeries.push(targetSupply);
                    ratioSeries.push(supply);
                    gratioSeries.push(governedSupply);
                    await (await treasury.updateSupplyRatio(LP.address)).wait();
                    await moveTimestamp(3600);

                }
    
                let finalTreasuryBalanceLP = await LP.balanceOf(treasury.address);
                let finalPanaInReserve = await getPanaReserve();

                console.log("\nTreasury balance of LP after LRP: ",Number(finalTreasuryBalanceLP));
                console.log("PANA in reserve after LRP: "+toDecimalBignumber(finalPanaInReserve,18));
                console.log("USDC in reserve after LRP: "+toDecimalBignumber(await getUSDCReserve(),6));

                let difference = finalTreasuryBalanceLP.sub(initialTreasuryBalanceLP);
                let percentChange = Number(difference.mul(100).div(initialTreasuryBalanceLP));
                console.log("Difference of LP in treasury: "+ difference+" and percentage of change: "+ percentChange+"%")
                console.log("Difference of Pana in Reserve: "+ toDecimalBignumber(finalPanaInReserve.sub(initialPanaInReserve),18));

                await renderChart(prepareChartConfig(ratioSeries, gratioSeries, targetSeries, "PID: " + await getPIDDescription(supplyControl)), outputFilename);   
            }
        });
        
    });
});

function toDecimalBignumber(b: any, decimals: number): number {
    return Number( bigNumberRepresentation(b.toString()).div(bigNumberRepresentation(10).pow(decimals)));
}

function toDecimal(b: BigNumber, decimals: number): number {
    return b.toNumber() / (10**decimals);
}
async function getPIDDescription(pidCtrl: ProportionalSupplyController): Promise<string> {
    return "kp:" + toDecimal(await pidCtrl.kp(), 4);
}

function prepareChartConfig(baseRatio: Array<number>, governedRatio: Array<number>, targetRatio: Array<number>, governorNotes?: string): ChartConfiguration {
    let labels: Array<number> = new Array<number>();
    for (let i = 0; i < baseRatio.length; i++) {
        labels.push(i);
    }

    return {
        type: "line",
        data: {
            datasets: [{
                label: "Base",
                data: baseRatio,
                borderColor: "orange",
            },
            {
                label: "Target",
                data: targetRatio,
                borderColor: "gray",
                borderDash: [10, 5]
            },
            {
                label: governorNotes ?? "Governed",
                data: governedRatio,
                borderColor: "blue"
            }],
            labels: labels,
        },
        options: {
            elements: {
                point:{
                    radius: 0
                }
            }
        },
        plugins: [{
            id: "background-colour",
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, CHART_WIDTH, CHART_HEIGHT);
                ctx.restore();
            }
        }]
    };
}

async function renderChart(cfg: ChartConfiguration, filename: string) {
    const chartCallback: ChartCallback = (ChartJS) => {
        ChartJS.defaults.responsive = true;
        ChartJS.defaults.maintainAspectRatio = false;
    };
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: CHART_WIDTH, height: CHART_HEIGHT, chartCallback });
    const buffer = await chartJSNodeCanvas.renderToBuffer(cfg);
    await fs.writeFile("./output/" + filename, buffer, "base64");
}