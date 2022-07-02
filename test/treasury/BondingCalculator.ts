import { MockContract } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PanaAuthority, PanaBondingCalculator, PanaERC20Token, PanaTreasury, UniswapV2Pair } from "../../types";

const { ethers } = require("hardhat");
const { expect } = require("chai");


const bigNumberRepresentation = (number:any) => {
    return ethers.BigNumber.from(number.toString());
};
const decimalRepresentation = (value:any, decimals:number) => {
    return bigNumberRepresentation(value.toString()).mul(bigNumberRepresentation(10).pow(decimals));
}

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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const BASE_VALUE = 100;

const panaIntrinsicValBigNumber = (value: any, PANADecimals: number, tokDecimals: number) => {
    return bigNumberRepresentation(value.toString()).mul(BASE_VALUE).mul(bigNumberRepresentation(10 ** PANADecimals ).div(bigNumberRepresentation( 10 ** tokDecimals )));
};

describe("Bonding Calculator Test Suite", async function() {
    let deployer: SignerWithAddress,
        governor: SignerWithAddress,
        guardian: SignerWithAddress,
        policy: SignerWithAddress,
        vault: SignerWithAddress,
        reserveDepositor: SignerWithAddress,
        reserveSpender: SignerWithAddress,
        liquidityDepositor: SignerWithAddress,
        reserveManager: SignerWithAddress,
        liquidityManager: SignerWithAddress,
        debtor: SignerWithAddress,
        rewardee: SignerWithAddress,
        testAddress: SignerWithAddress,
        DAO: SignerWithAddress,
        rewardManager: SignerWithAddress,
        PANA: PanaERC20Token,
        DAI: MockContract,
        DAI16: MockContract,
        USDC: MockContract,
        USDC17Decimal: MockContract,
        USDC1Decimal: MockContract,
        USDC9Decimal: MockContract,
        PanaAuthority: PanaAuthority,
        BondingCalculator: PanaBondingCalculator,
        lp: UniswapV2Pair,
        PANADecimals: number,
        DAIDecimals: number,
        DAI16Decimals: number,

        USDCDecimals: number,
        USDC17DecimalDecimals: number,
        USDC1DecimalDecimals: number,  
        USDC9DecimalDecimals: number,  
        LPTokenDecimals: number,
        kValueDecimals: number,
        kVal: any,
        Treasury: PanaTreasury,
        DAIDepositedToTreasury: any,
        DAIDepositedToLP: any,
        DAIDepositedToLPPANAEquivalent: any,
        DAI16DepositedToTreasury: any,
        DAI16DepositedToLP: any,
        DAI16DepositedToLPPANAEquivalent: any,
        USDCDepositedToTreasury: any,
        USDCDepositedToLP: any,
        USDCDepositedToLPPANAEquivalent: any,
        USDC17DecimalDepositedToTreasury: any,
        USDC17DecimalDepositedToLP: any,
        USDC17DecimalDepositedToLPPANAEquivalent: any,
        USDC1DecimalDepositedToTreasury: any,
        USDC1DecimalDepositedToLP: any,
        USDC1DecimalDepositedToLPPANAEquivalent: any,
        USDC9DecimalDepositedToTreasury: any,
        USDC9DecimalDepositedToLP: any,
        USDC9DecimalDepositedToLPPANAEquivalent: any;

    // Setting epoch to 1 for easier testing
    const blocksNeededForQueue = 1;    
    
    beforeEach(
        
        async function() {
            [ 
                deployer, 
                governor,
                guardian,
                policy,
                vault,
                reserveDepositor, 
                reserveSpender, 
                liquidityDepositor,
                reserveManager,
                liquidityManager,
                debtor,
                rewardManager,
                rewardee,
                testAddress,
                DAO 
            ] = await ethers.getSigners();

            let panaAuthorityContract = await ethers.getContractFactory("PanaAuthority");
            PanaAuthority = await panaAuthorityContract.deploy(governor.address, guardian.address, policy.address, vault.address, ZERO_ADDRESS);

            let panaTokenContract = await ethers.getContractFactory("PanaERC20Token");
            PANA = await panaTokenContract.deploy(PanaAuthority.address);

            let daiTokenContract = await ethers.getContractFactory("DAI");
            DAI = await daiTokenContract.deploy(0);
            let dai16TokenContract = await ethers.getContractFactory("DAI16");
            DAI16 = await dai16TokenContract.deploy(0);

            let usdcTokenContract = await ethers.getContractFactory("USDC");
            USDC = await usdcTokenContract.deploy(0);

            let usdc17DecimalTokenContract = await ethers.getContractFactory("USDC17Decimal");
            USDC17Decimal = await usdc17DecimalTokenContract.deploy(0);

            let usdc1DecimalTokenContract = await ethers.getContractFactory("USDC1Decimal");
            USDC1Decimal = await usdc1DecimalTokenContract.deploy(0);

            let usdc9DecimalTokenContract = await ethers.getContractFactory("USDC9Decimal");
            USDC9Decimal = await usdc9DecimalTokenContract.deploy(0);
            
            PanaAuthority.connect(governor).pushPanaGovernor(governor.address, true);
            PanaAuthority.connect(governor).pushGuardian(guardian.address, true);
            PanaAuthority.connect(governor).pushPolicy(policy.address, true);
            PanaAuthority.connect(governor).pushVault(vault.address, true);

            let treasuryContract = await ethers.getContractFactory("PanaTreasury");
            Treasury = await treasuryContract.deploy(PANA.address, blocksNeededForQueue, PanaAuthority.address);

            PanaAuthority.connect(governor).pushVault(Treasury.address, true);

            PANADecimals = await PANA.decimals();
            DAIDecimals = await DAI.decimals();
            DAI16Decimals = await DAI16.decimals();

            USDCDecimals = await USDC.decimals();
            USDC17DecimalDecimals = await USDC17Decimal.decimals();
            USDC1DecimalDecimals = await USDC1Decimal.decimals();
            USDC9DecimalDecimals = await USDC9Decimal.decimals();
            
            let bondingCalculatorContract = await ethers.getContractFactory("PanaBondingCalculator");
            BondingCalculator = await bondingCalculatorContract.deploy(PANA.address);

            //Add reserve depositor for testing purposes
            await Treasury.connect(governor)
            .enable(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS);

            // Add reward manager for testing purposes
            await Treasury.connect(governor)
            .enable(8, rewardManager.address, ZERO_ADDRESS, ZERO_ADDRESS);

            //Add reserve token for testing purposes
            await Treasury.connect(governor)
            .enable(2, DAI.address, ZERO_ADDRESS, ZERO_ADDRESS);
            await Treasury.connect(governor)
            .enable(2, DAI16.address, ZERO_ADDRESS, ZERO_ADDRESS);

            //Add reserve token for testing purposes
            await Treasury.connect(governor)
            .enable(2, USDC.address, ZERO_ADDRESS, ZERO_ADDRESS);

            //Add reserve token for testing purposes
            await Treasury.connect(governor)
            .enable(2, USDC17Decimal.address, ZERO_ADDRESS, ZERO_ADDRESS);

            //Add reserve token for testing purposes
            await Treasury.connect(governor)
            .enable(2, USDC1Decimal.address, ZERO_ADDRESS, ZERO_ADDRESS);

            //Add reserve token for testing purposes
            await Treasury.connect(governor)
            .enable(2, USDC9Decimal.address, ZERO_ADDRESS, ZERO_ADDRESS);

            //Set Base Value for Treasury
            await Treasury.connect(governor)
            .setBaseValue(bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)));

            let lpContract = await ethers.getContractFactory("UniswapV2Pair");
            lp = await lpContract.deploy();
        }
    );

    describe("Tests for same decimal tokens upper bound", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                DAIDepositedToTreasury = bigNumberRepresentation("5192296858534827628530496329220"); // 51 trillion
                DAIDepositedToLP =  bigNumberRepresentation("5192296858534827628530496329220"); // 51 trillion
                DAIDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(DAIDepositedToLP, PANADecimals, DAIDecimals);

                // Mint 51 trillion DAI to reserveDepositor
                await DAI.mint(reserveDepositor.address, DAIDepositedToTreasury);
                await DAI.connect(reserveDepositor).approve(Treasury.address, DAIDepositedToTreasury);

                // Deposit 51 trillion DAI into treasury for testing purposes
                // Assume 100% profit
                // Mints 5 quadrillion Pana
                await Treasury.connect(reserveDepositor).deposit(DAIDepositedToTreasury, DAI.address, DAIDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 51 trillion DAI and 5 quadrillion Pana
                // Mint 51 trillion DAI to liquidity pool for testing purposes
                // Mint 5 quadrillion PANA to liquidity pool for testing purposes
                await DAI.mint(lp.address, DAIDepositedToLP); // 51 trillion DAI
                await Treasury.connect(rewardManager).mint(lp.address, DAIDepositedToLPPANAEquivalent); // 5 quadrillion PANA
                lp.initialize(DAI.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints  519 billion LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + DAIDecimals;

                let lpDAI = bigNumberRepresentation(DAIDepositedToLP);
                let lpPana = bigNumberRepresentation(DAIDepositedToLPPANAEquivalent);
                totalSupplyDecimals = (DAIDecimals + PANADecimals)/2;


                kVal = lpDAI.mul(lpPana);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount =  bigNumberRepresentation("5192296858534827628530496329220"); // 519,229,685,853,482.762853049632922000 (519 billion)
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-totalSupplyDecimals)).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal*lpTokenAmount/lpTokenTotalSupply*BASE_VALUE *10**(18-(totalSupplyDecimals)); 
            expect(Number(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(tokenVal));
        });
    });

    describe("Tests for same decimal tokens normal pools", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                DAIDepositedToTreasury = decimalRepresentation("100", DAIDecimals); // 100 DAI 
                DAIDepositedToLP = decimalRepresentation("100", DAIDecimals); // 100 DAI 
                DAIDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(DAIDepositedToLP, PANADecimals, DAIDecimals);

                // Mint 100 DAI to reserveDepositor
                await DAI.mint(reserveDepositor.address, DAIDepositedToTreasury);
                await DAI.connect(reserveDepositor).approve(Treasury.address, DAIDepositedToTreasury);

                // Deposit 100 DAI into treasury for testing purposes
                // Assume 100% profit
                // Mints 10000 Pana
                await Treasury.connect(reserveDepositor).deposit(DAIDepositedToTreasury, DAI.address,  DAIDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 100 DAI and 10000 Pana
                // Mint 100 DAI to liquidity pool for testing purposes
                // Mint 10000 PANA to liquidity pool for testing purposes
                await DAI.mint(lp.address, DAIDepositedToLP); // 100 DAI
                await Treasury.connect(rewardManager).mint(lp.address, DAIDepositedToLPPANAEquivalent); // 10000 PANA
                lp.initialize(DAI.address, PANA.address);
                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 1000 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + DAIDecimals;

                totalSupplyDecimals = (DAIDecimals + PANADecimals)/2;

                kVal = DAIDepositedToLP.mul(DAIDepositedToLPPANAEquivalent);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));

            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = decimalRepresentation("1000", LPTokenDecimals); // 1000 tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal*lpTokenAmount/lpTokenTotalSupply*BASE_VALUE*(10**(18-(totalSupplyDecimals))); 
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });
    });


    describe("Tests for same decimal tokens lower bound with near minimum liquidity in the pool", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                DAIDepositedToTreasury = bigNumberRepresentation(101);
                DAIDepositedToLP = bigNumberRepresentation(101);
                DAIDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(DAIDepositedToLP, PANADecimals, DAIDecimals);
                // Mint 0.000000000000000101 DAI to reserveDepositor
                await DAI.mint(reserveDepositor.address, DAIDepositedToTreasury);
                await DAI.connect(reserveDepositor).approve(Treasury.address, DAIDepositedToTreasury);

                // Deposit 0.000000000000000101 DAI into treasury for testing purposes
                // Assume 100% profit
                // Mints 0.000000000000010100 Pana
                await Treasury.connect(reserveDepositor).deposit(DAIDepositedToTreasury, DAI.address, DAIDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 0.000000000000000101 DAI and 0.000000000000010100 Pana
                // Mint 0.000000000000000101 DAI to liquidity pool for testing purposes
                // Mint 0.000000000000010100 PANA to liquidity pool for testing purposes
                await DAI.mint(lp.address, DAIDepositedToLP);
                await Treasury.connect(rewardManager).mint(lp.address, DAIDepositedToLPPANAEquivalent);
                lp.initialize(DAI.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 1010 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + DAIDecimals;
                totalSupplyDecimals = (DAIDecimals + PANADecimals)/2;


                kVal = DAIDepositedToLP.mul(DAIDepositedToLPPANAEquivalent); 
            }
        );

        it("Should get the correct k value", async function() {
            expect((await BondingCalculator.getKValue(lp.address))).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for large upper bound on uniswap pool", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1010 // 1010 LP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            let tokenVal = ((totalVal*lpTokenAmount)/(lpTokenTotalSupply))*BASE_VALUE*(10**(18-(totalSupplyDecimals))); 
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });
    });


    describe("Tests for different decimal average case tokens upper bound", async function() {
        let totalSupplyDecimals: any;
        beforeEach(
            async function() {
                DAI16DepositedToTreasury = bigNumberRepresentation("51922968585348276285304963292"); // 51 trillion
                DAI16DepositedToLP =  bigNumberRepresentation("51922968585348276285304963292"); // 51 trillion
                DAI16DepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(DAI16DepositedToLP, PANADecimals, DAI16Decimals);

                // Mint 51 trillion DAI16 to reserveDepositor
                await DAI16.mint(reserveDepositor.address, DAI16DepositedToTreasury);
                await DAI16.connect(reserveDepositor).approve(Treasury.address, DAI16DepositedToTreasury);

                // Deposit 51 trillion DAI16 into treasury for testing purposes
                // Assume 100% profit
                // Mints 5 quadrillion Pana
                await Treasury.connect(reserveDepositor).deposit(DAI16DepositedToTreasury, DAI16.address, DAI16DepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 51 trillion DAI16 and 5 quadrillion Pana
                // Mint 51 trillion DAI16 to liquidity pool for testing purposes
                // Mint 5 quadrillion PANA to liquidity pool for testing purposes
                await DAI16.mint(lp.address, DAI16DepositedToLP); // 51 trillion DAI16
                await Treasury.connect(rewardManager).mint(lp.address, DAI16DepositedToLPPANAEquivalent); // 5 quadrillion PANA
                lp.initialize(DAI16.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 51 billion LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + DAI16Decimals;

                let lpDAI16 = bigNumberRepresentation(DAI16DepositedToLP);
                let lpPana = bigNumberRepresentation(DAI16DepositedToLPPANAEquivalent);
                totalSupplyDecimals = (DAI16Decimals + PANADecimals)/2;
                kVal = lpDAI16.mul(lpPana);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
            
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount =  bigNumberRepresentation("51922968585348276285304963292200"); // 51,922,968,585,348.276285304963292200 (51 billion)
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(Number(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(tokenVal));
        });
    });

    describe("Tests for different decimal average case tokens normal pools", async function() {
                let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                DAI16DepositedToTreasury = decimalRepresentation("100", DAI16Decimals); // 100 DAI16
                DAI16DepositedToLP = decimalRepresentation("100", DAI16Decimals); // 100 DAI16
                DAI16DepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(DAI16DepositedToLP, PANADecimals, DAI16Decimals);

                // Mint 100 DAI16 to reserveDepositor
                await DAI16.mint(reserveDepositor.address, DAI16DepositedToTreasury);
                await DAI16.connect(reserveDepositor).approve(Treasury.address, DAI16DepositedToTreasury);

                // Deposit 100 DAI16 into treasury for testing purposes
                // Assume 100% profit
                // Mints 1000000 Pana
                await Treasury.connect(reserveDepositor).deposit(DAI16DepositedToTreasury, DAI16.address, DAI16DepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 100 DAI16 and 10000 Pana
                // Mint 100 DAI16 to liquidity pool for testing purposes
                // Mint 1000000 PANA to liquidity pool for testing purposes
                await DAI16.mint(lp.address, DAI16DepositedToLP); // 10000 DAI16
                await Treasury.connect(rewardManager).mint(lp.address, DAI16DepositedToLPPANAEquivalent); // 1000000 PANA
                lp.initialize(DAI16.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 1000 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + DAI16Decimals;




                totalSupplyDecimals = (DAI16Decimals + PANADecimals)/2;


                kVal = DAI16DepositedToLP.mul(DAI16DepositedToLPPANAEquivalent);

            }
        );

        it("Should get the correct k value", async function() {
            // console.log(await lp.totalSupply());
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = decimalRepresentation("100", LPTokenDecimals); // 1000 tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply); 
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });
    });


    describe("Tests for different decimal average case tokens lower bound with near minimum liquidity in the pool", async function() {
                let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                DAI16DepositedToTreasury = bigNumberRepresentation(101);
                DAI16DepositedToLP = bigNumberRepresentation(101);
                DAI16DepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(DAI16DepositedToLP, PANADecimals, DAI16Decimals);

                // Mint 0.000000000000010100 DAI16 to reserveDepositor
                await DAI16.mint(reserveDepositor.address, DAI16DepositedToTreasury);
                await DAI16.connect(reserveDepositor).approve(Treasury.address, DAI16DepositedToTreasury);

                // Deposit 0.000000000000010100 DAI16 into treasury for testing purposes
                // Assume 100% profit
                // Mints 0.000000000001010000 Pana
                await Treasury.connect(reserveDepositor).deposit(DAI16DepositedToTreasury, DAI16.address, DAI16DepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 0.000000000000010100 DAI16 and 0.000000000001010000 Pana
                // Mint 0.000000000000010100 DAI16 to liquidity pool for testing purposes
                // Mint 0.000000000001010000 PANA to liquidity pool for testing purposes
                await DAI16.mint(lp.address, DAI16DepositedToLP);
                await Treasury.connect(rewardManager).mint(lp.address, DAI16DepositedToLPPANAEquivalent);
                lp.initialize(DAI16.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 1010 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + DAI16Decimals;
                totalSupplyDecimals = (DAI16Decimals + PANADecimals)/2;


                kVal = DAI16DepositedToLP.mul(DAI16DepositedToLPPANAEquivalent);
            }
        );

        it("Should get the correct k value", async function() {
            expect((await BondingCalculator.getKValue(lp.address))).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for large upper bound on uniswap pool", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1010 // 1010 LP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply); 
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });
    });



    describe("Tests for different decimal tokens upper bound", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDCDepositedToTreasury = decimalRepresentation("5192296858534", USDCDecimals); // 51 trillion
                USDCDepositedToLP = decimalRepresentation("5192296858534", USDCDecimals); // 51 trillion
                USDCDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDCDepositedToLP, PANADecimals, USDCDecimals);

                // Mint 51 trillion USDC to reserveDepositor
                await USDC.mint(reserveDepositor.address, USDCDepositedToTreasury);
                await USDC.connect(reserveDepositor).approve(Treasury.address, USDCDepositedToTreasury);

                // Deposit 51 trillion USDC into treasury for testing purposes
                // Assume 100% profit
                // Mints 5 quadrillion Pana
                await Treasury.connect(reserveDepositor).deposit(USDCDepositedToTreasury, USDC.address, USDCDepositedToLPPANAEquivalent );

                // Initialize the Liquidity Pool with 51 trillion USDC and 5 quadrillion Pana
                // Mint 51 trillion USDC to liquidity pool for testing purposes
                // Mint 5 quadrillion PANA to liquidity pool for testing purposes
                await USDC.mint(lp.address, USDCDepositedToLP); // 51 trillion USDC
                await Treasury.connect(rewardManager).mint(lp.address, USDCDepositedToLPPANAEquivalent); // 5 quadrillion PANA
                lp.initialize(USDC.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 519 million LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDCDecimals;

                let lpUSDC = bigNumberRepresentation(USDCDepositedToLP);
                let lpPana = bigNumberRepresentation(USDCDepositedToLPPANAEquivalent);

                totalSupplyDecimals = (USDCDecimals + PANADecimals)/2;

                kVal = lpUSDC.mul(lpPana);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = decimalRepresentation("519229685", LPTokenDecimals); // 519 million
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });
    });

    describe("Tests for different decimal tokens normal pools", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDCDepositedToTreasury = decimalRepresentation("100", USDCDecimals); // 100 USDC
                USDCDepositedToLP = decimalRepresentation("100", USDCDecimals); // 100 USDC
                USDCDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDCDepositedToLP, PANADecimals, USDCDecimals);

                // Mint 100 USDC to reserveDepositor
                await USDC.mint(reserveDepositor.address, USDCDepositedToTreasury);
                await USDC.connect(reserveDepositor).approve(Treasury.address, USDCDepositedToTreasury);

                // Deposit 100 USDC into treasury for testing purposes
                // Assume 100% profit
                // Mints 10000 Pana
                await Treasury.connect(reserveDepositor).deposit(USDCDepositedToTreasury, USDC.address,  USDCDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 100 USDC and 10000 Pana
                // Mint 100 USDC to liquidity pool for testing purposes
                // Mint 10000 PANA to liquidity pool for testing purposes
                await USDC.mint(lp.address, USDCDepositedToLP); // 100 USDC
                await Treasury.connect(rewardManager).mint(lp.address, USDCDepositedToLPPANAEquivalent); // 10000 PANA
                lp.initialize(USDC.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 0.001 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDCDecimals;


                totalSupplyDecimals = (USDCDecimals + PANADecimals)/2;

                kVal = USDCDepositedToLP.mul(USDCDepositedToLPPANAEquivalent);

            }
        );

        it("Should get the correct k value", async function() {

            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = bigNumberRepresentation("1000000000000000"); // 0.001 tokens
            
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect((await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(tokenVal);
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply); 

            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });
    });

    describe("Tests for different decimal tokens lower bound with near minimum liquidity in the pool", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDCDepositedToTreasury = bigNumberRepresentation(101);
                USDCDepositedToLP = bigNumberRepresentation(101);
                USDCDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDCDepositedToLP, PANADecimals, USDCDecimals);

                // Mint 0.000101 USDC to reserveDepositor
                await USDC.mint(reserveDepositor.address, USDCDepositedToTreasury);
                await USDC.connect(reserveDepositor).approve(Treasury.address, USDCDepositedToTreasury);

                // Deposit 0.000101 USDC into treasury for testing purposes
                // Assume 100% profit
                // Mints 0.010100 Pana
                await Treasury.connect(reserveDepositor).deposit(USDCDepositedToTreasury, USDC.address, USDCDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 0.000101 USDC and 0.0101 Pana
                // Mint 0.000101 USDC to liquidity pool for testing purposes
                // Mint 0.010100 PANA to liquidity pool for testing purposes
                await USDC.mint(lp.address, USDCDepositedToLP);
                await Treasury.connect(rewardManager).mint(lp.address, USDCDepositedToLPPANAEquivalent);
                lp.initialize(USDC.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 0.00000000101 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + DAIDecimals;
                
                totalSupplyDecimals = (USDCDecimals + PANADecimals)/2;

                kVal = USDCDepositedToLP.mul(USDCDepositedToLPPANAEquivalent);
            }
        );

        it("Should get the correct k value", async function() {
            
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1010000000; // 0.00000000101 tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect((await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(((tokenVal)));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            let tokenVal = totalVal.mul(lpTokenAmount).mul(BASE_VALUE).mul(10**(18-(totalSupplyDecimals))).div(lpTokenTotalSupply);
            expect(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).to.equal(tokenVal);
        });
    });

    describe("Tests for worst case max odd decimal tokens upper bound", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC17DecimalDepositedToTreasury = bigNumberRepresentation("519229685853482762853049632922"); // 51 trillion
                USDC17DecimalDepositedToLP = bigNumberRepresentation("519229685853482762853049632922"); // 51 trillion
                USDC17DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC17DecimalDepositedToLP, PANADecimals, USDC17DecimalDecimals);

                // Mint 51 trillion USDC17Decimal to reserveDepositor
                await USDC17Decimal.mint(reserveDepositor.address, USDC17DecimalDepositedToTreasury);
                await USDC17Decimal.connect(reserveDepositor).approve(Treasury.address, USDC17DecimalDepositedToTreasury);

                // Deposit 51 trillion USDC17Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints 5 quadrillion Pana
                await Treasury.connect(reserveDepositor).deposit(USDC17DecimalDepositedToTreasury, USDC17Decimal.address,USDC17DecimalDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 51 trillion USDC17Decimal and 5 quadrillion Pana
                // Mint 51 trillion USDC17Decimal to liquidity pool for testing purposes
                // Mint 5 quadrillion PANA to liquidity pool for testing purposes
                await USDC17Decimal.mint(lp.address, USDC17DecimalDepositedToLP); // 51 trillion USDC17Decimal
                await Treasury.connect(rewardManager).mint(lp.address, USDC17DecimalDepositedToLPPANAEquivalent); // 5 quadrillion PANA
                lp.initialize(USDC17Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 164,194,843,607,071.412182328148996654 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC17DecimalDecimals;

                let lpUSDC17Decimal = bigNumberRepresentation(USDC17DecimalDepositedToLP);
                let lpPana = bigNumberRepresentation(USDC17DecimalDepositedToLPPANAEquivalent);

                totalSupplyDecimals = (USDC17DecimalDecimals + PANADecimals)/2;

                kVal = lpUSDC17Decimal.mul(lpPana);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = bigNumberRepresentation("164194843607071412182328148996654");
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });
    });

    describe("Tests for worst case max odd decimal tokens normal pools", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC17DecimalDepositedToTreasury = decimalRepresentation("100", USDC17DecimalDecimals); // 100 USDC17Decimal
                USDC17DecimalDepositedToLP = decimalRepresentation("100", USDC17DecimalDecimals); // 100 USDC17Decimal
                USDC17DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC17DecimalDepositedToLP, PANADecimals, USDC17DecimalDecimals);

                // Mint 100 USDC17Decimal to reserveDepositor
                await USDC17Decimal.mint(reserveDepositor.address, USDC17DecimalDepositedToTreasury);
                await USDC17Decimal.connect(reserveDepositor).approve(Treasury.address, USDC17DecimalDepositedToTreasury);

                // Deposit 100 USDC17Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints 10000 Pana
                await Treasury.connect(reserveDepositor).deposit(USDC17DecimalDepositedToTreasury, USDC17Decimal.address,  USDC17DecimalDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 100 USDC17Decimal and 10000 Pana
                // Mint 100 USDC17Decimal to liquidity pool for testing purposes
                // Mint 10000 PANA to liquidity pool for testing purposes
                await USDC17Decimal.mint(lp.address, USDC17DecimalDepositedToLP); // 100 USDC17Decimal
                await Treasury.connect(rewardManager).mint(lp.address, USDC17DecimalDepositedToLPPANAEquivalent); // 10000 PANA
                lp.initialize(USDC17Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 316.227766016837933199 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC17DecimalDecimals;


                totalSupplyDecimals = (USDC17DecimalDecimals + PANADecimals)/2;

                kVal = USDC17DecimalDepositedToLP.mul(USDC17DecimalDepositedToLPPANAEquivalent);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = bigNumberRepresentation("316227766016837933199");            
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });
    });

    describe("Tests for worst case max odd decimal tokens lower bound with near minimum liquidity in the pool", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC17DecimalDepositedToTreasury = bigNumberRepresentation(101);;
                USDC17DecimalDepositedToLP = bigNumberRepresentation(101);;
                USDC17DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC17DecimalDepositedToLP, PANADecimals, USDC17DecimalDecimals);


                // Mint 0.00000000000000101 USDC17Decimal to reserveDepositor
                await USDC17Decimal.mint(reserveDepositor.address, USDC17DecimalDepositedToTreasury);
                await USDC17Decimal.connect(reserveDepositor).approve(Treasury.address, USDC17DecimalDepositedToTreasury);

                // Deposit 0.00000000000000101 USDC17Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints   0.000000000000101000 Pana
                await Treasury.connect(reserveDepositor).deposit(USDC17DecimalDepositedToTreasury, USDC17Decimal.address, USDC17DecimalDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 0.00000000000000101 USDC and 0.000000000000101000 Pana
                // Mint 0.00000000000000101 USDC17Decimal to liquidity pool for testing purposes
                // Mint 0.000000000000101000 PANA to liquidity pool for testing purposes
                await USDC17Decimal.mint(lp.address, USDC17DecimalDepositedToLP);
                await Treasury.connect(rewardManager).mint(lp.address, USDC17DecimalDepositedToLPPANAEquivalent);
                lp.initialize(USDC17Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 0.000000000000003193 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC17DecimalDecimals;
                
                totalSupplyDecimals = (USDC17DecimalDecimals + PANADecimals)/2;

                kVal = USDC17DecimalDepositedToLP.mul(USDC17DecimalDepositedToLPPANAEquivalent);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal/BASE_VALUE)*2);
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 3193; // 0.000000000000003193 tokens
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
           console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });
    });

    describe("Tests for worst case minimum odd decimal tokens upper bound", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC1DecimalDepositedToTreasury =  decimalRepresentation("5192296858534", USDC1DecimalDecimals);  // 51 trillion
                USDC1DecimalDepositedToLP = decimalRepresentation("5192296858534", USDC1DecimalDecimals);  // 51 trillion
                USDC1DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC1DecimalDepositedToLP, PANADecimals, USDC1DecimalDecimals);

                // Mint 51 trillion USDC1Decimal to reserveDepositor
                await USDC1Decimal.mint(reserveDepositor.address, USDC1DecimalDepositedToTreasury);
                await USDC1Decimal.connect(reserveDepositor).approve(Treasury.address, USDC1DecimalDepositedToTreasury);

                // Deposit 51 trillion USDC1Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints 5 quadrillion Pana

                await Treasury.connect(reserveDepositor).deposit(USDC1DecimalDepositedToTreasury, USDC1Decimal.address, USDC1DecimalDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 51 trillion USDC1Decimal and 5 quadrillion Pana
                // Mint 51 trillion USDC1Decimal to liquidity pool for testing purposes
                // Mint 5 quadrillion PANA to liquidity pool for testing purposes
                await USDC1Decimal.mint(lp.address, USDC1DecimalDepositedToLP); // 51 trillion USDC1Decimal
                await Treasury.connect(rewardManager).mint(lp.address, USDC1DecimalDepositedToLPPANAEquivalent); // 5 quadrillion PANA
                lp.initialize(USDC1Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 1,641,948.436070705384914804 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC1DecimalDecimals;

                let lpUSDC1Decimal = bigNumberRepresentation(USDC1DecimalDepositedToLP); 
                let lpPana = bigNumberRepresentation(USDC1DecimalDepositedToLPPANAEquivalent); 

                totalSupplyDecimals = (USDC1DecimalDecimals + PANADecimals)/2;

                kVal = lpUSDC1Decimal.mul(lpPana);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = bigNumberRepresentation("1641948436070705384914804");
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = Number(totalVal*BASE_VALUE*lpTokenAmount*(10**(18-totalSupplyDecimals)))/Number(lpTokenTotalSupply);

            expect(Number(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Math.trunc(Number(tokenVal)));
        });
    });

    describe("Tests for worst case minimum odd decimal tokens normal pools", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC1DecimalDepositedToTreasury = decimalRepresentation("100", USDC1DecimalDecimals); // 100 USDC1Decimal
                USDC1DecimalDepositedToLP = decimalRepresentation("100", USDC1DecimalDecimals); // 100 USDC1Decimal
                USDC1DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC1DecimalDepositedToLP, PANADecimals, USDC1DecimalDecimals);

                // Mint 100 USDC1Decimal to reserveDepositor
                await USDC1Decimal.mint(reserveDepositor.address, USDC1DecimalDepositedToTreasury);
                await USDC1Decimal.connect(reserveDepositor).approve(Treasury.address, USDC1DecimalDepositedToTreasury);

                // Deposit 100 USDC1Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints 10000 Pana
                await Treasury.connect(reserveDepositor).deposit(USDC1DecimalDepositedToTreasury, USDC1Decimal.address,  USDC1DecimalDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 100 USDC1Decimal and 10000 Pana
                // Mint 100 USDC1Decimal to liquidity pool for testing purposes
                // Mint 10000 PANA to liquidity pool for testing purposes
                await USDC1Decimal.mint(lp.address, USDC1DecimalDepositedToLP); // 100 USDC1Decimal
                await Treasury.connect(rewardManager).mint(lp.address, USDC1DecimalDepositedToLPPANAEquivalent); // 10000 PANA
                lp.initialize(USDC1Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 0.000003162277660168 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC1DecimalDecimals;


                totalSupplyDecimals = (USDC1DecimalDecimals + PANADecimals)/2;

                kVal = USDC1DecimalDepositedToLP.mul(USDC1DecimalDepositedToLPPANAEquivalent);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 3162277660168 // 0.000003162277660168 tokens;
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            let tokenVal = Number(totalVal*BASE_VALUE*lpTokenAmount*(10**(18-totalSupplyDecimals)))/Number(lpTokenTotalSupply);

            expect(Number(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Math.trunc(tokenVal));
        });
    });

    describe("Tests for worst case minimim odd decimal tokens lower bound with near minimum liquidity in the pool", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC1DecimalDepositedToTreasury = bigNumberRepresentation(101);;
                USDC1DecimalDepositedToLP = bigNumberRepresentation(101);;
                USDC1DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC1DecimalDepositedToLP, PANADecimals, USDC1DecimalDecimals);

                // Mint 10.1 USDC1Decimal to reserveDepositor
                await USDC1Decimal.mint(reserveDepositor.address, USDC1DecimalDepositedToTreasury);
                await USDC1Decimal.connect(reserveDepositor).approve(Treasury.address, USDC1DecimalDepositedToTreasury);

                // Deposit 10.1 USDC1Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints 1010 Pana

                await Treasury.connect(reserveDepositor).deposit(USDC1DecimalDepositedToTreasury, USDC1Decimal.address, USDC1DecimalDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 10.1 USDC and 1010 Pana
                // Mint 10.1 USDC1Decimal to liquidity pool for testing purposes
                // Mint 1010 PANA to liquidity pool for testing purposes
                await USDC1Decimal.mint(lp.address, USDC1DecimalDepositedToLP);
                await Treasury.connect(rewardManager).mint(lp.address, USDC1DecimalDepositedToLPPANAEquivalent);
                lp.initialize(USDC1Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 0.000000319390043677 LP tokens to depositor


                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC1DecimalDecimals;
                
                totalSupplyDecimals = (USDC1DecimalDecimals + PANADecimals)/2;

                kVal = USDC1DecimalDepositedToLP.mul(USDC1DecimalDepositedToLPPANAEquivalent);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE))*2);
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 319390043677; // 0.000000319390043677 tokens
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });
    });

    describe("Tests for worst case average odd decimal tokens upper bound", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC9DecimalDepositedToTreasury = decimalRepresentation("5192296858534",USDC9DecimalDecimals ); // 51 trillion
                USDC9DecimalDepositedToLP =  decimalRepresentation("5192296858534",USDC9DecimalDecimals ); // 51 trillion
                USDC9DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC9DecimalDepositedToLP, PANADecimals, USDC9DecimalDecimals);

                // Mint 51 trillion USDC9Decimal to reserveDepositor
                await USDC9Decimal.mint(reserveDepositor.address, USDC9DecimalDepositedToTreasury);
                await USDC9Decimal.connect(reserveDepositor).approve(Treasury.address, USDC9DecimalDepositedToTreasury);

                // Deposit 51 trillion USDC9Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints 5 quadrillion Pana
                await Treasury.connect(reserveDepositor).deposit(USDC9DecimalDepositedToTreasury, USDC9Decimal.address,  USDC9DecimalDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 51 trillion USDC9Decimal and 5 quadrillion Pana
                // Mint 51 trillion USDC9Decimal to liquidity pool for testing purposes
                // Mint 5 quadrillion PANA to liquidity pool for testing purposes
                await USDC9Decimal.mint(lp.address, USDC9DecimalDepositedToLP); // 51 trillion USDC9Decimal
                await Treasury.connect(rewardManager).mint(lp.address, USDC9DecimalDepositedToLPPANAEquivalent); // 5 quadrillion PANA
                lp.initialize(USDC9Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 16,419,484,360.707053849148043076 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC9DecimalDecimals;

                let lpUSDC9Decimal = bigNumberRepresentation(USDC9DecimalDepositedToLP); 
                let lpPana = bigNumberRepresentation(USDC9DecimalDepositedToLPPANAEquivalent); 

                totalSupplyDecimals = (USDC9DecimalDecimals + PANADecimals)/2;

                kVal = lpUSDC9Decimal.mul(lpPana);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = bigNumberRepresentation("16419484360707053849148043076");
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });
    });

    describe("Tests for worst case average odd decimal tokens normal pools", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC9DecimalDepositedToTreasury = decimalRepresentation("100", USDC9DecimalDecimals); // 100 USDC9Decimal (100 *100 *10^9 *10^18/10^9)
                USDC9DecimalDepositedToLP = decimalRepresentation("100", USDC9DecimalDecimals); // 100 USDC9Decimal
                USDC9DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC9DecimalDepositedToLP, PANADecimals, USDC9DecimalDecimals);

                // Mint 100 USDC9Decimal to reserveDepositor
                await USDC9Decimal.mint(reserveDepositor.address, USDC9DecimalDepositedToTreasury);
                await USDC9Decimal.connect(reserveDepositor).approve(Treasury.address, USDC9DecimalDepositedToTreasury);

                // Deposit 100 USDC9Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints 10000 Pana
                await Treasury.connect(reserveDepositor).deposit(USDC9DecimalDepositedToTreasury, USDC9Decimal.address,  USDC9DecimalDepositedToLPPANAEquivalent);

                // Initialize the Liquidity Pool with 100 USDC9Decimal and 10000 Pana
                // Mint 100 USDC9Decimal to liquidity pool for testing purposes
                // Mint 10000 PANA to liquidity pool for testing purposes
                await USDC9Decimal.mint(lp.address, USDC9DecimalDepositedToLP); // 100 USDC9Decimal
                await Treasury.connect(rewardManager).mint(lp.address, USDC9DecimalDepositedToLPPANAEquivalent); // 10000 PANA
                lp.initialize(USDC9Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 0.031622776601683793 LP tokens to depositor

                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC9DecimalDecimals;


                totalSupplyDecimals = (USDC9DecimalDecimals + PANADecimals)/2;

                kVal = USDC9DecimalDepositedToLP.mul(USDC9DecimalDepositedToLPPANAEquivalent);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE)).mul(2));
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = bigNumberRepresentation(31622776601683793); // 0.031622776601683793 tokens;
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));

        });
    });

    describe("Tests for worst case average odd decimal tokens lower bound with near minimum liquidity in the pool", async function() {
        let totalSupplyDecimals: any;

        beforeEach(
            async function() {
                USDC9DecimalDepositedToTreasury = bigNumberRepresentation(101);;
                USDC9DecimalDepositedToLP = bigNumberRepresentation(101);;
                USDC9DecimalDepositedToLPPANAEquivalent = panaIntrinsicValBigNumber(USDC9DecimalDepositedToLP, PANADecimals, USDC9DecimalDecimals);


                // Mint 10.1 USDC9Decimal to reserveDepositor
                await USDC9Decimal.mint(reserveDepositor.address, USDC9DecimalDepositedToTreasury);
                await USDC9Decimal.connect(reserveDepositor).approve(Treasury.address, USDC9DecimalDepositedToTreasury);

                // Deposit 10.1 USDC9Decimal into treasury for testing purposes
                // Assume 100% profit
                // Mints 1010 Pana

                await Treasury.connect(reserveDepositor).deposit(USDC9DecimalDepositedToTreasury, USDC9Decimal.address, USDC9DecimalDepositedToLPPANAEquivalent); // 10100000000000

                // Initialize the Liquidity Pool with 10.1 USDC and 1010 Pana
                // Mint 10.1 USDC9Decimal to liquidity pool for testing purposes
                // Mint 1010 PANA to liquidity pool for testing purposes
                await USDC9Decimal.mint(lp.address, USDC9DecimalDepositedToLP);
                await Treasury.connect(rewardManager).mint(lp.address, USDC9DecimalDepositedToLPPANAEquivalent);
                lp.initialize(USDC9Decimal.address, PANA.address);

                // Mint LP Tokens to deployer for testing
                await lp.mint(deployer.address); // Mints 0.000000319390043677 LP tokens to depositor


                LPTokenDecimals = await lp.decimals();
                kValueDecimals = PANADecimals + USDC9DecimalDecimals;
                
                totalSupplyDecimals = (USDC9DecimalDecimals + PANADecimals)/2;

                kVal = USDC9DecimalDepositedToLPPANAEquivalent.mul(USDC9DecimalDepositedToLP);
            }
        );

        it("Should get the correct k value", async function() {
            expect(await BondingCalculator.getKValue(lp.address)).to.equal(kVal);
        });
    
        it("Should get the correct total valuation of all LP Tokens", async function() {
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE))*2);
            expect(Number(await BondingCalculator.getTotalValue(lp.address, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))))).to.equal(Number(totalVal));
        });
    
        it("Should valuate LP token correctly for largest possible number of digits for LP token amount", async function() {
            let lpTokenTotalSupply: any = await lp.totalSupply();
            let lpTokenAmount = 31939004; // 0.000000000031939004 tokens
            let totalVal = bigNumberRepresentation(sqrt(kVal.div(BASE_VALUE))*2);
            let tokenVal = (totalVal*(lpTokenAmount/lpTokenTotalSupply)*BASE_VALUE)*(10**(18-totalSupplyDecimals)); 

            expect(Number((await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9)))).div(1e10))).to.equal(Math.trunc(Number(tokenVal/1e10)));
        });

        it("Should valuate LP token correctly for smallest possible number of digits for LP token amount", async function() {
            let lpTokenAmount = 1; // 0.000000000000000001 SLP tokens
            console.log(await BondingCalculator.valuation(lp.address, lpTokenAmount, bigNumberRepresentation(decimalRepresentation(BASE_VALUE, 9))));
        });
    });
});