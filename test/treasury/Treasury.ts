import { MockContract } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DAI, PanaAuthority, PanaERC20Token, PanaTreasury } from "../../types";

const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { expect } = require("chai");

const decimalRepresentation = (value: any, decimals: number) => {
    return value*(10**decimals);
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const panaIntrinsicVal = (value: any, PANADecimals: number, tokDecimals: number) => {
    return value*100*(10 ** PANADecimals )/( 10 ** tokDecimals );
};

const bigNumberRepresentation = (number: number) => {
    return ethers.BigNumber.from(number.toString());
};

describe("PANA Treasury Test Suite", async function() {
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
        reserveDebtor: SignerWithAddress,
        rewardManager: SignerWithAddress,
        rewardee: SignerWithAddress,
        testAddress: SignerWithAddress,
        testLiquidityToken: SignerWithAddress,
        panaDebtor: SignerWithAddress,
        PANA: PanaERC20Token,
        DAI: MockContract,
        sPANA: MockContract,
        PanaAuthority: PanaAuthority,
        PANADecimals: number,
        DAIDecimals: number,
        Treasury: PanaTreasury;

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
                testLiquidityToken,
                liquidityDepositor,
                reserveManager,
                liquidityManager,
                reserveDebtor,
                rewardManager,
                panaDebtor,
                rewardee,
                testAddress 
            ] = await ethers.getSigners();

            // Initialize all contracts
            let panaAuthorityContract = await ethers.getContractFactory("PanaAuthority");
            PanaAuthority = await panaAuthorityContract.deploy(governor.address, guardian.address, policy.address, vault.address);

            let panaTokenContract = await ethers.getContractFactory("PanaERC20Token");
            PANA = await panaTokenContract.deploy(PanaAuthority.address);

            let sPanaTokenContract = await ethers.getContractFactory("sPana");
            sPANA = await sPanaTokenContract.deploy();

            let daiTokenContract = await ethers.getContractFactory("DAI");
            DAI = await daiTokenContract.deploy(0);

            let treasuryContract = await ethers.getContractFactory("PanaTreasury");
            Treasury = await treasuryContract.deploy(PANA.address, blocksNeededForQueue, PanaAuthority.address);

            // Push authority addresses for different authorities
            PanaAuthority.connect(governor).pushPanaGovernor(governor.address, true);
            PanaAuthority.connect(governor).pushGuardian(guardian.address, true);
            PanaAuthority.connect(governor).pushPolicy(policy.address, true);
            PanaAuthority.connect(governor).pushVault(Treasury.address, true);

            PANADecimals = await PANA.decimals();
            DAIDecimals = await DAI.decimals();
        }
    );

    describe("Treasury Initialization", function() {
        beforeEach(
            async function() {
                await Treasury.connect(governor).initialize();
            }
        );

        it("Should set PANA Token address correctly", async function() {
            expect(await Treasury.PANA()).to.equal(PANA.address);
        });

        it("Should set correct number of blocks needed for queue", async function() {
            expect(await Treasury.blocksNeededForQueue()).to.equal(blocksNeededForQueue);
        });

        it("Should enable timelock", async function() {
            expect(await Treasury.timelockEnabled()).to.equal(true);
        });

        it("Should disallow reinitialization", async function() {
            expect(Treasury.connect(governor).initialize()).to.be.revertedWith('Already initialized');
        });
    });

    describe("Add treasury participants", function() {

        it("Should only allow governor to add participants", async function() {
            await expect(Treasury.connect(testAddress)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS))
                .to.be.revertedWith('UNAUTHORIZED');
        });

        it("Should add reserve depositor", async function() {

            // Add new participant
            await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS);  
            
            // Check if the participant is added to registry
            expect(await Treasury.registry(0,0))
                .to.equal(reserveDepositor.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(0, reserveDepositor.address))
                .to.equal(true);    
        });

        it("Should add reserve spender", async function() {

            // Add new participant
            await Treasury.connect(governor)
                .enable(1, reserveSpender.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            expect(await Treasury.registry(1,0))
                .to.equal(reserveSpender.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(1,reserveSpender.address))
                .to.equal(true);  
        });

        it("Should add reserve token", async function() {
            
            // Add new participant
            await Treasury.connect(governor)
                .enable(2, DAI.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            // expect(await Treasury.registry(2,0))
            //    .to.equal(DAI.address);

            // Check if the token is enabled
            expect(await Treasury.permissions(2,DAI.address))
                .to.equal(true); 
        });

        it("Should add reserve manager", async function() {

            // Add new participant
            await Treasury.connect(governor)
                .enable(3, reserveManager.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            expect(await Treasury.registry(3,0))
                .to.equal(reserveManager.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(3,reserveManager.address))
                .to.equal(true); 
        });

        it("Should add liquidity depositor", async function() {

            // Add new participant
            await Treasury.connect(governor)
                .enable(4, liquidityDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            expect(await Treasury.registry(4,0))
                .to.equal(liquidityDepositor.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(4,liquidityDepositor.address))
                .to.equal(true); 
        });

        it("Should add liquidity token", async function() {
            
            // Add new participant
            await Treasury.connect(governor)
                .enable(5, testLiquidityToken.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            // expect(await Treasury.registry(5,0))
            //    .to.equal(testLiquidityToken.address);

            // Check if the token is enabled
            expect(await Treasury.permissions(5, testLiquidityToken.address))
                .to.equal(true); 
        });

        it("Should add liquidity manager", async function() {
            
            // Add new participant
            await Treasury.connect(governor)
                .enable(6, liquidityManager.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            expect(await Treasury.registry(6,0))
                .to.equal(liquidityManager.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(6,liquidityManager.address))
                .to.equal(true); 
        });

        it("Should add debtor", async function() {
            
            // Add new participant
            await Treasury.connect(governor)
                .enable(7, reserveDebtor.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            expect(await Treasury.registry(7,0))
                .to.equal(reserveDebtor.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(7,reserveDebtor.address))
                .to.equal(true); 
        });

        it("Should add reward manager", async function() {

            // Add new participant
            await Treasury.connect(governor)
                .enable(8, rewardManager.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            expect(await Treasury.registry(8,0))
                .to.equal(rewardManager.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(8,rewardManager.address))
                .to.equal(true); 
        });

        it("Should add sPANA token", async function() {
            
            // Add new participant
            await Treasury.connect(governor)
                .enable(9, sPANA.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the sPana is added to registry
            expect(await Treasury.sPANA())
                .to.equal(sPANA.address);

        });

        it("Should add pana debtor", async function() {
            
            // Add new participant
            await Treasury.connect(governor)
                .enable(10, panaDebtor.address, ZERO_ADDRESS, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            expect(await Treasury.registry(10,0))
                .to.equal(panaDebtor.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(10,panaDebtor.address))
                .to.equal(true); 
        });

        it("Should be able to disable participants", async function() {
            
            // Add new participant
            await Treasury.connect(governor)
                .enable(10, panaDebtor.address, ZERO_ADDRESS, ZERO_ADDRESS);  
                
            await Treasury.connect(governor).disable(10, panaDebtor.address);

            // Check if the participant is disabled
            expect(await Treasury.permissions(10,panaDebtor.address))
                .to.equal(false); 
        });

        it("Should only allow governor or guardian to disable participants", async function() {
            
            // Add new participant
            await Treasury.connect(governor)
                .enable(10, panaDebtor.address, ZERO_ADDRESS, ZERO_ADDRESS);  
                
            await expect(Treasury.disable(10, panaDebtor.address))
                    .to.be.revertedWith('Only governor or guardian');

        });
    });

    describe("Delayed participant addition", function() {
        beforeEach(
            async function() {
                await Treasury.connect(governor).initialize();

                // Add new participant
                await Treasury.connect(governor)
                .queueTimelock(3, reserveManager.address, ZERO_ADDRESS, ZERO_ADDRESS); 
            
            }
        );

        it("Should allow queuing of participants", async function() {

            // Add new participant
            await Treasury.connect(governor)
            .queueTimelock(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS); 

            // Check if the participant is added to queue
            expect((await Treasury.permissionQueue(1)).managing)
                .to.equal(0);
        });

        it("Should set double delay for reserve and liquidity managers", async function() {                   
                
            let rmExpectedLockEnd = (await ethers.provider.getBlockNumber()) + (blocksNeededForQueue*2);    
               
            // Add new participant
            await Treasury.connect(governor)
                .queueTimelock(6, liquidityManager.address, ZERO_ADDRESS, ZERO_ADDRESS);   

            let lmExpectedLockEnd = (await ethers.provider.getBlockNumber()) + (blocksNeededForQueue*2);

            // Check if timelock set to double delay
            expect((await Treasury.permissionQueue(0)).timelockEnd).to.equal(rmExpectedLockEnd);
            expect((await Treasury.permissionQueue(1)).timelockEnd).to.equal(lmExpectedLockEnd);
        });

        it("Should disallow enabling queued permission before timelock ends", async function() {
        
            await expect(Treasury.execute(0)).to.be.revertedWith('Timelock not complete');
        });

        it("Should allow enabling queued permission after timelock ends", async function() {
            await ethers.provider.send("evm_mine");
            await ethers.provider.send("evm_mine");

            await Treasury.execute(0);

            // Check if the participant is added to registry
            expect(await Treasury.registry(3,0))
                .to.equal(reserveManager.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(3,reserveManager.address))
                .to.equal(true); 
        });
    });
    

    describe("Deposit To Treasury", function() {
        let DAIBonded: any,
            intrinsicValue: any,
            bonderPayout,
            bondingFees,
            profits: any,
            panaSupply: any,
            depBalance: any,
            totalReserves: any;

        beforeEach(
            async function() {

                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(2, DAI.address, ZERO_ADDRESS, ZERO_ADDRESS);

                await Treasury.connect(governor).setBaseValue(bigNumberRepresentation(decimalRepresentation(100, 9)));

                // Bond 1 DAI
                // Assumes 1 DAI = 1 USD = 100 pseudo INR
                // Hence, 1 DAI should ideally mint 100 PANAs including DAO profits and other fees
                DAIBonded = bigNumberRepresentation(decimalRepresentation(1, DAIDecimals));
                
                intrinsicValue = bigNumberRepresentation(panaIntrinsicVal(DAIBonded, PANADecimals, DAIDecimals));
                
                // Payout 80 PANAs to the bonder 
                bonderPayout = bigNumberRepresentation(decimalRepresentation(80, PANADecimals));

                // Bond Fees 5 PANAs
                bondingFees = bigNumberRepresentation(decimalRepresentation(5, PANADecimals));

                // Profit 15 PANAs
                profits = intrinsicValue.sub(bonderPayout).sub(bondingFees);

                panaSupply = await PANA.totalSupply();
                depBalance = await PANA.balanceOf(reserveDepositor.address);
                totalReserves = await Treasury.totalReserves();

                // Transfer some DAI to respective accounts for testing and approve treasury as spender
                await DAI.mint(deployer.address, DAIBonded);
                await DAI.approve(Treasury.address, DAIBonded);
                await DAI.mint(reserveDepositor.address, DAIBonded);
                await DAI.connect(reserveDepositor).approve(Treasury.address, DAIBonded);
            }
        );

        it("Should intrinsically valuate DAI correctly", async function() {
            expect(await Treasury.tokenValue(DAI.address, DAIBonded)).to.be.equal(DAIBonded.mul(100));
        });

        it("Should only accept approved tokens", async function() {
            await expect(Treasury.connect(reserveDepositor).deposit(DAIBonded, testAddress.address, profits))
                    .to.be.revertedWith('Treasury: invalid token');
        });

        it("Should only allow approved reserve depositors to deposit", async function() {
            await expect(Treasury.deposit(DAIBonded, DAI.address, profits))
                    .to.be.revertedWith('Treasury: not approved');
        });

        it("Should deposit 1 DAI to treasury", async function() {
            await Treasury.connect(reserveDepositor).deposit(DAIBonded, DAI.address, profits.toString());
            
            // Treasury should get 1 DAI
            expect(await DAI.balanceOf(Treasury.address))
                .to.equal(DAIBonded);
        });

        it("Should increase treasury PANA Reserves", async function() {
            await Treasury.connect(reserveDepositor).deposit(DAIBonded, DAI.address, profits.toString());
            let finalTreasuryBalance = totalReserves.add(intrinsicValue);
            expect(await Treasury.totalReserves())
                .to.equal(finalTreasuryBalance);
        });

        it("Should increase PANA total supply", async function() {
            await Treasury.connect(reserveDepositor).deposit(DAIBonded, DAI.address, profits.toString());
            let finalPanaSupply = panaSupply.add(intrinsicValue).sub(profits);
            expect(await PANA.totalSupply())
                .to.equal(finalPanaSupply);
        });

        it("Should increase depositor PANA balance", async function() {
            await Treasury.connect(reserveDepositor).deposit(DAIBonded, DAI.address, profits.toString());
            let finaldepBalance = depBalance.add(intrinsicValue).sub(profits);
            expect(await PANA.balanceOf(reserveDepositor.address))
                .to.equal(finaldepBalance);
        });

    });

    describe("Withdrawal From Treasury", function() {
        let DAIDeposited,
            DAIToWithdraw: any,
            DAIWithdrawnPANAEquivalent: any,
            panaSupply: any,
            treasuryDAIBalance: any,
            spenderDAIBalance: any,
            spenderPANABalance: any,
            intrinsicValue: any,
            totalReserves: any;

        beforeEach(
            async function() {
                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS);

                // Add reserve spender for testing purposes
                await Treasury.connect(governor)
                .enable(1, reserveSpender.address, ZERO_ADDRESS, ZERO_ADDRESS);

                // Add reward manager for testing purposes
                await Treasury.connect(governor)
                .enable(8, rewardManager.address, ZERO_ADDRESS, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(2, DAI.address, ZERO_ADDRESS, ZERO_ADDRESS);

                await Treasury.connect(governor).setBaseValue(bigNumberRepresentation(decimalRepresentation(100, 9)));

                DAIDeposited = bigNumberRepresentation(decimalRepresentation(8, DAIDecimals));
                DAIToWithdraw = bigNumberRepresentation(decimalRepresentation(2, DAIDecimals));
                DAIWithdrawnPANAEquivalent = bigNumberRepresentation(panaIntrinsicVal(DAIToWithdraw, PANADecimals, DAIDecimals));

                // Mint 8 DAIs to reserveDepositor and deployer for testing purposes and approve treasury as spender
                await DAI.mint(deployer.address, DAIDeposited);
                await DAI.approve(Treasury.address, DAIDeposited);
                await DAI.mint(reserveDepositor.address, DAIDeposited);
                await DAI.connect(reserveDepositor).approve(Treasury.address, DAIDeposited);

                // Deposit 8 DAIs into treasury for testing purposes
                // Assume profits=200 for minting to spender
                intrinsicValue = bigNumberRepresentation(panaIntrinsicVal(DAIDeposited, PANADecimals, DAIDecimals));
                await Treasury.connect(reserveDepositor).deposit(DAIDeposited, DAI.address,  bigNumberRepresentation(decimalRepresentation(200, PANADecimals)));

                // Mint 200 PANA to reserve spender for testing purposes
                //PANA.setVault(deployer.address);
                await Treasury.connect(rewardManager).mint(reserveSpender.address, bigNumberRepresentation(decimalRepresentation(200, PANADecimals)));

                // approve treasury to burn 200 PANA from spender balances
                PANA.connect(reserveSpender)
                    .approve(
                        Treasury.address, 
                        bigNumberRepresentation(decimalRepresentation(200, PANADecimals))
                    );

                panaSupply = await PANA.totalSupply();
                treasuryDAIBalance = await DAI.balanceOf(Treasury.address);
                spenderDAIBalance = await DAI.balanceOf(reserveSpender.address);
                spenderPANABalance = await PANA.balanceOf(reserveSpender.address);
                totalReserves = await Treasury.totalReserves();                
            }
        );

        it("Should allow only approved tokens to be withdrawn", async function() {
            await expect(Treasury.withdraw(DAIToWithdraw, testAddress.address))
                    .to.be.revertedWith('Treasury: not accepted');
        });

        it("Should only allow approved spenders to withdraw", async function() {
            await expect(Treasury.withdraw(DAIToWithdraw, DAI.address))
                    .to.be.revertedWith('Treasury: not approved');
        });

        it("Should transfer 2 DAIs to reserve spender", async function() {
            await Treasury.connect(reserveSpender).withdraw(DAIToWithdraw, DAI.address);
            expect(await DAI.balanceOf(reserveSpender.address)).to.equal(DAIToWithdraw);
        });

        it("Should decrease treasury reserve KARSHA by equivalent amount of DAI withdrawn", async function() {
            await Treasury.connect(reserveSpender).withdraw(DAIToWithdraw, DAI.address);
            let finalTreasuryBalance = totalReserves.sub(DAIWithdrawnPANAEquivalent);
            expect(await Treasury.totalReserves()).to.equal(finalTreasuryBalance);
        });

        it("Should decrease treasury DAIs balance by DAI withdrawn", async function() {
            await Treasury.connect(reserveSpender).withdraw(DAIToWithdraw, DAI.address);
            let finalTreasuryDAIBalance = treasuryDAIBalance.sub(DAIToWithdraw);
            expect(await DAI.balanceOf(Treasury.address)).to.equal(finalTreasuryDAIBalance);
        });

        it("Should burn PANA from spenders balance", async function() {
            await Treasury.connect(reserveSpender).withdraw(DAIToWithdraw, DAI.address);
            let finalSpenderPANABalance = spenderPANABalance.sub(DAIWithdrawnPANAEquivalent);
            expect(await PANA.balanceOf(reserveSpender.address)).to.equal(finalSpenderPANABalance);
        });

        it("Should reduce PANA total supply", async function() {
            await Treasury.connect(reserveSpender).withdraw(DAIToWithdraw, DAI.address);
            let finalSupply = panaSupply.sub(DAIWithdrawnPANAEquivalent);
            expect(await PANA.totalSupply()).to.equal(finalSupply.toString());
        });
    });


    describe("Mint Rewards", function() {
        let DAIDeposited,
            rewardeePANABalance: any,
            rewardAmount: any,
            panaSupply: any,
            DAOProfit: any,
            intrinsicValue,
            totalReserves;

        beforeEach(
            async function() {
                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS);

                // Add reward manager for testing purposes
                await Treasury.connect(governor)
                .enable(8, rewardManager.address, ZERO_ADDRESS, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(2, DAI.address, ZERO_ADDRESS, ZERO_ADDRESS);

                await Treasury.connect(governor).setBaseValue(bigNumberRepresentation(decimalRepresentation(100, 9)));

                DAIDeposited = bigNumberRepresentation(decimalRepresentation(2, DAIDecimals));
                DAOProfit = bigNumberRepresentation(decimalRepresentation(200, PANADecimals));

                // Mint 2 DAIs to reserveDepositor and deployer for testing purposes and approve treasury as spender
                await DAI.mint(deployer.address, DAIDeposited);
                await DAI.approve(Treasury.address, DAIDeposited);
                await DAI.mint(reserveDepositor.address, DAIDeposited);
                await DAI.connect(reserveDepositor).approve(Treasury.address, DAIDeposited);

                // Deposit 2 DAIs into treasury for testing purposes
                // Assume 2 DAIs as profit to treasury for creating excess reserves which are then used for rewards
                //intrinsicValue = bigNumberRepresentation(panaIntrinsicVal(DAIDeposited, PANADecimals, DAIDecimals));
                //await Treasury.connect(reserveDepositor).deposit(DAIDeposited, DAI.address, DAOProfit);
                await DAI.connect(reserveDepositor).transferFrom(reserveDepositor.address, Treasury.address, DAIDeposited);
                //await Treasury.updateReserves();
                //console.log(await DAI.balanceOf(Treasury.address));

                panaSupply = await PANA.totalSupply();
                rewardeePANABalance = await PANA.balanceOf(rewardee.address);
                totalReserves = await Treasury.totalReserves(); 
                rewardAmount = bigNumberRepresentation(decimalRepresentation(100, PANADecimals));               
            }
        );

        it('Should allow only reward manager to mint rewards', async function() {
            await expect(Treasury.mint(rewardee.address, rewardAmount))
                    .to.be.revertedWith('Treasury: not approved');
        });

        it('Should calculate excess reserves correctly', async function() {
            expect(await Treasury.excessReserves()).to.be.equal(0);
        });

        it('Should mint rewards only if enough excess reserves available', async function() {
            rewardAmount = rewardAmount.mul(4); // overflow
            await expect(Treasury.connect(rewardManager).mint(rewardee.address, rewardAmount))
                    .to.be.revertedWith('Treasury: insufficient reserves');
        });

        it('Should increase Pana supply by amount rewarded', async function() {
            await Treasury.connect(rewardManager).mint(rewardee.address, rewardAmount);
            let finalPanaSupply = panaSupply.add(rewardAmount);
            expect(await PANA.totalSupply()).to.equal(finalPanaSupply);
        });

        it('Should increase rewardee PANA balances', async function() {
            await Treasury.connect(rewardManager).mint(rewardee.address, rewardAmount);
            let finalPanaBal = rewardeePANABalance.add(rewardAmount);
            expect(await PANA.balanceOf(rewardee.address)).to.equal(finalPanaBal);
        });
    });

    describe("Manage Reserves", function() {
        let DAIDeposited,
            DAIToWithdraw: any,
            DAIWithdrawnPANAEquivalent: any,
            intrinsicValue,
            panaSupply,
            treasuryDAIBalance: any,
            managerDAIBalance: any,
            totalReserves: any;

        beforeEach(
            async function() {
                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS);

                // Add reserve manager for testing purposes
                await Treasury.connect(governor)
                .enable(3, reserveManager.address, ZERO_ADDRESS, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(2, DAI.address, ZERO_ADDRESS, ZERO_ADDRESS);

                await Treasury.connect(governor).setBaseValue(bigNumberRepresentation(decimalRepresentation(100, 9)));

                DAIDeposited = bigNumberRepresentation(decimalRepresentation(8, DAIDecimals));
                DAIToWithdraw = bigNumberRepresentation(decimalRepresentation(2, DAIDecimals));
                DAIWithdrawnPANAEquivalent = bigNumberRepresentation(panaIntrinsicVal(DAIToWithdraw, PANADecimals, DAIDecimals));

                // Mint 8 DAIs to reserveDepositor for testing purposes and approve treasury as spender
                await DAI.mint(reserveDepositor.address, DAIDeposited);
                await DAI.connect(reserveDepositor).approve(Treasury.address, DAIDeposited);

                // Deposit 8 DAIs into treasury for testing purposes
                // Assume profits=200
                intrinsicValue = bigNumberRepresentation(panaIntrinsicVal(DAIDeposited, PANADecimals, DAIDecimals));
                await Treasury.connect(reserveDepositor).deposit(DAIDeposited, DAI.address,  bigNumberRepresentation(decimalRepresentation(200, PANADecimals)));

                panaSupply = await PANA.totalSupply();
                treasuryDAIBalance = await DAI.balanceOf(Treasury.address);
                managerDAIBalance = await DAI.balanceOf(reserveManager.address);
                totalReserves = await Treasury.totalReserves();                
            }
        );

        it("Should allow only reserve manager to withdraw tokens", async function() {
            await expect(Treasury.manage(DAI.address, DAIToWithdraw))
                    .to.be.revertedWith('Treasury: not approved');
        });

        it("Should allow only withdrawal only if excess reserves are available", async function() {
            await expect(Treasury.connect(reserveManager).manage(DAI.address, DAIToWithdraw.mul(2)))
                    .to.be.revertedWith('Treasury: insufficient reserves');
        });

        it("Should decrease total reserves", async function() {
            await Treasury.connect(reserveManager).manage(DAI.address, DAIToWithdraw);
            let finalReserves = totalReserves.sub(DAIWithdrawnPANAEquivalent);
            expect(await Treasury.totalReserves()).to.equal(finalReserves.toString());
        });

        it("Should decrease treasury DAI balance", async function() {
            await Treasury.connect(reserveManager).manage(DAI.address, DAIToWithdraw);
            let finalTreasuryDAIBalance = treasuryDAIBalance.sub(DAIToWithdraw);
            expect(await DAI.balanceOf(Treasury.address)).to.equal(finalTreasuryDAIBalance.toString());
        });

        it("Should increase manager DAI balance", async function() {
            await Treasury.connect(reserveManager).manage(DAI.address, DAIToWithdraw);
            let finalManagerDAIBalance = managerDAIBalance.add(DAIToWithdraw);
            expect(await DAI.balanceOf(reserveManager.address)).to.equal(finalManagerDAIBalance.toString());
        });

        /*it("Should only allow reserve tokens to be withdrawn", async function() {
            await expect(Treasury.connect(reserveManager).manage(testAddress.address, DAIToWithdraw))
                    .to.be.revertedWith('Treasury: not approved');
        });*/

        /*it("Should audit reserves", async function() {

            let DAIMinted = bigNumberRepresentation(decimalRepresentation(2, DAIDecimals));

            console.log(await Treasury.totalReserves());

            // Mint 2 DAIs directly to treasury for testing purposes
            await DAI.mint(Treasury.address, DAIMinted);

            console.log(await Treasury.totalReserves());

            let DAIMintedPANAEquivalent = bigNumberRepresentation(panaIntrinsicVal(DAIMinted, PANADecimals, DAIDecimals));

            console.log(await Treasury.totalReserves());

            await Treasury.connect(governor).auditReserves();

            console.log(await Treasury.totalReserves());

            let finalTreasuryReserves = totalReserves.add(DAIMintedPANAEquivalent);
            expect(await Treasury.totalReserves()).to.equal(finalTreasuryReserves.toString());
        });*/
    });


    describe("Dynamic Base Valuation", function() {
        let DAIDeposited: any,
            DAIToWithdraw: any,
            DAIWithdrawnPANAEquivalent: any,
            intrinsicValue,
            panaSupply,
            treasuryDAIBalance: any,
            managerDAIBalance: any,
            totalReserves: any;

        beforeEach(
            async function() {
                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS, ZERO_ADDRESS);

                // Add reserve manager for testing purposes
                await Treasury.connect(governor)
                .enable(3, reserveManager.address, ZERO_ADDRESS, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(2, DAI.address, ZERO_ADDRESS, ZERO_ADDRESS);

                DAIDeposited = bigNumberRepresentation(decimalRepresentation(1, DAIDecimals));
                DAIToWithdraw = bigNumberRepresentation(decimalRepresentation(2, DAIDecimals));
                DAIWithdrawnPANAEquivalent = bigNumberRepresentation(panaIntrinsicVal(DAIToWithdraw, PANADecimals, DAIDecimals));

                // Mint 8 DAIs to reserveDepositor for testing purposes and approve treasury as spender
                await DAI.mint(reserveDepositor.address, DAIDeposited);
                await DAI.connect(reserveDepositor).approve(Treasury.address, DAIDeposited);

                // Deposit 8 DAIs into treasury for testing purposes
                // Assume profits=200
                // intrinsicValue = bigNumberRepresentation(panaIntrinsicVal(DAIDeposited, PANADecimals, DAIDecimals));
                // await Treasury.connect(reserveDepositor).deposit(DAIDeposited, DAI.address,  bigNumberRepresentation(decimalRepresentation(200, PANADecimals)));

                panaSupply = await PANA.totalSupply();
                treasuryDAIBalance = await DAI.balanceOf(Treasury.address);
                managerDAIBalance = await DAI.balanceOf(reserveManager.address);
                totalReserves = await Treasury.totalReserves();                
            }
        );

        it("Should not allow valuation if base value is not set", async function() {
            //expect(await Treasury.tokenValue(DAI.address, DAIDeposited)).to.be.equal(DAIDeposited.mul(100));
            expect(Treasury.tokenValue(DAI.address, DAIDeposited)).to.be.revertedWith('Base value is not set');

        });

        it("Should have correct token value per base value", async function() {
            let baseValue = 100;
            await Treasury.connect(governor).setBaseValue(bigNumberRepresentation(decimalRepresentation(baseValue, 9)));
            expect(await Treasury.tokenValue(DAI.address, DAIDeposited)).to.be.equal(DAIDeposited.mul(baseValue));

            baseValue = 200;
            await Treasury.connect(governor).setBaseValue(bigNumberRepresentation(decimalRepresentation(baseValue, 9)));
            expect(await Treasury.tokenValue(DAI.address, DAIDeposited)).to.be.equal(DAIDeposited.mul(baseValue));
        });
    });
});