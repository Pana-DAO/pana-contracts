import { MockContract } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { USDC, PanaAuthority, PanaERC20Token, PanaTreasury } from "../../types";

const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { expect } = require("chai");

const decimalRepresentation = (value: any, decimals: number) => {
    return value*(10**decimals);
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const panaValBigNumber = (value: any, PANADecimals: number, tokDecimals: number,base_value:number = 100) => {
    return bigNumberRepresentation(value.toString()).mul(base_value).mul(bigNumberRepresentation(10 ** PANADecimals ).div(bigNumberRepresentation( 10 ** tokDecimals )));
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
        USDC: MockContract,
        sPANA: MockContract,
        PanaAuthority: PanaAuthority,
        PANADecimals: number,
        USDCDecimals: number,
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
            PanaAuthority = await panaAuthorityContract.deploy(governor.address, guardian.address, policy.address, vault.address, ZERO_ADDRESS);

            let panaTokenContract = await ethers.getContractFactory("PanaERC20Token");
            PANA = await panaTokenContract.deploy(PanaAuthority.address);

            let sPanaTokenContract = await ethers.getContractFactory("sPana");
            sPANA = await sPanaTokenContract.deploy(PanaAuthority.address);

            let usdcTokenContract = await ethers.getContractFactory("USDC");
            USDC = await usdcTokenContract.deploy(0);

            let treasuryContract = await ethers.getContractFactory("PanaTreasury");
            Treasury = await treasuryContract.deploy(PANA.address, blocksNeededForQueue, PanaAuthority.address);

            // Push authority addresses for different authorities
            PanaAuthority.connect(governor).pushPanaGovernor(governor.address, true);
            PanaAuthority.connect(governor).pushGuardian(guardian.address, true);
            PanaAuthority.connect(governor).pushPolicy(policy.address, true);
            PanaAuthority.connect(governor).pushVault(Treasury.address, true);

            PANADecimals = await PANA.decimals();
            USDCDecimals = await USDC.decimals();
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
                .enable(0, reserveDepositor.address, ZERO_ADDRESS))
                .to.be.revertedWith('UNAUTHORIZED');
        });

        it("Should add reserve depositor", async function() {

            // Add new participant
            await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS);  
            
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
                .enable(1, reserveSpender.address, ZERO_ADDRESS);            

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
                .enable(2, USDC.address, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            // expect(await Treasury.registry(2,0))
            //    .to.equal(USDC.address);

            // Check if the token is enabled
            expect(await Treasury.permissions(2,USDC.address))
                .to.equal(true); 
        });

        it("Should add reserve manager", async function() {

            // Add new participant
            await Treasury.connect(governor)
                .enable(3, reserveManager.address, ZERO_ADDRESS);            

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
                .enable(4, liquidityDepositor.address, ZERO_ADDRESS);            

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
                .enable(5, testLiquidityToken.address, ZERO_ADDRESS);            

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
                .enable(6, liquidityManager.address, ZERO_ADDRESS);            

            // Check if the participant is added to registry
            expect(await Treasury.registry(6,0))
                .to.equal(liquidityManager.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(6,liquidityManager.address))
                .to.equal(true); 
        });

        // it("Should add debtor", async function() {
            
        //     // Add new participant
        //     await Treasury.connect(governor)
        //         .enable(7, reserveDebtor.address, ZERO_ADDRESS);            

        //     // Check if the participant is added to registry
        //     expect(await Treasury.registry(7,0))
        //         .to.equal(reserveDebtor.address);

        //     // Check if the participant is enabled
        //     expect(await Treasury.permissions(7,reserveDebtor.address))
        //         .to.equal(true); 
        // });

        it("Should add reward manager", async function() {

            // Add new participant
            await Treasury.connect(governor)
                .enable(8, rewardManager.address, ZERO_ADDRESS);            

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
                .enable(7, sPANA.address, ZERO_ADDRESS);            

            // Check if the sPana is added to registry
            expect(await Treasury.sPANA())
                .to.equal(sPANA.address);

        });

        // it("Should add pana debtor", async function() {
            
        //     // Add new participant
        //     await Treasury.connect(governor)
        //         .enable(10, panaDebtor.address, ZERO_ADDRESS);            

        //     // Check if the participant is added to registry
        //     expect(await Treasury.registry(10,0))
        //         .to.equal(panaDebtor.address);

        //     // Check if the participant is enabled
        //     expect(await Treasury.permissions(10,panaDebtor.address))
        //         .to.equal(true); 
        // });

        // it("Should be able to disable participants", async function() {
            
        //     // Add new participant
        //     await Treasury.connect(governor)
        //         .enable(10, panaDebtor.address, ZERO_ADDRESS);  
                
        //     await Treasury.connect(governor).disable(10, panaDebtor.address);

        //     // Check if the participant is disabled
        //     expect(await Treasury.permissions(10,panaDebtor.address))
        //         .to.equal(false); 
        // });

        // it("Should only allow governor or guardian to disable participants", async function() {
            
        //     // Add new participant
        //     await Treasury.connect(governor)
        //         .enable(10, panaDebtor.address, ZERO_ADDRESS);  
                
        //     await expect(Treasury.disable(10, panaDebtor.address))
        //             .to.be.revertedWith('Only governor or guardian');

        // });
    });

    describe("Delayed participant addition", function() {
        beforeEach(
            async function() {
                await Treasury.connect(governor).initialize();

                // Add new participant
                await Treasury.connect(governor)
                .queueTimelock(2, reserveManager.address, ZERO_ADDRESS); 
            
            }
        );

        it("Should allow queuing of participants", async function() {

            // Add new participant
            await Treasury.connect(governor)
            .queueTimelock(0, reserveDepositor.address, ZERO_ADDRESS); 

            // Check if the participant is added to queue
            expect((await Treasury.permissionQueue(1)).managing)
                .to.equal(0);
        });

        it("Should set double delay for reserve and liquidity managers", async function() {                   
                
            let rmExpectedLockEnd = (await ethers.provider.getBlockNumber()) + (blocksNeededForQueue*2);    
               
            // Add new participant
            await Treasury.connect(governor)
                .queueTimelock(5, liquidityManager.address, ZERO_ADDRESS);   

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
            expect(await Treasury.registry(2,0))
                .to.equal(reserveManager.address);

            // Check if the participant is enabled
            expect(await Treasury.permissions(2,reserveManager.address))
                .to.equal(true); 
        });
    });
    

    describe("Deposit To Treasury", function() {
        let USDCBonded: any,
            payoutValue: any,
            bonderPayout,
            bondingFees,
            profits: any,
            panaSupply: any,
            depBalance: any,
            baseValue: any;

        beforeEach(
            async function() {

                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(1, USDC.address, ZERO_ADDRESS);

                // Bond 1 USDC
                // Assumes 1 USDC = 1 USD = 100 pseudo INR
                // Hence, 1 USDC should ideally mint 100 PANAs including DAO profits and other fees
                USDCBonded = bigNumberRepresentation(decimalRepresentation(1, USDCDecimals));
                baseValue = bigNumberRepresentation(100);
                
                payoutValue = bigNumberRepresentation(panaValBigNumber(USDCBonded, PANADecimals, USDCDecimals,baseValue));
                
                // Payout 80 PANAs to the bonder 
                bonderPayout = bigNumberRepresentation(decimalRepresentation(80, PANADecimals));

                // Bond Fees 20 PANAs
                bondingFees = bigNumberRepresentation(decimalRepresentation(20, PANADecimals));

                // Profit 0 PANAs
                profits = payoutValue.sub(bonderPayout).sub(bondingFees);

                panaSupply = await PANA.totalSupply();
                depBalance = await PANA.balanceOf(reserveDepositor.address);

                // Transfer some USDC to respective accounts for testing and approve treasury as spender
                await USDC.mint(deployer.address, USDCBonded);
                await USDC.approve(Treasury.address, USDCBonded);
                await USDC.mint(reserveDepositor.address, USDCBonded);
                await USDC.connect(reserveDepositor).approve(Treasury.address, USDCBonded);
            }
        );


        it("Should only accept approved tokens", async function() {
            await expect(Treasury.connect(reserveDepositor).deposit(USDCBonded, testAddress.address, profits))
                    .to.be.revertedWith('Treasury: invalid token');
        });

        it("Should only allow approved reserve depositors to deposit", async function() {
            await expect(Treasury.deposit(USDCBonded, USDC.address, profits))
                    .to.be.revertedWith('Treasury: not approved');
        });

        it("Should deposit 1 USDC to treasury", async function() {
            await Treasury.connect(reserveDepositor).deposit(USDCBonded, USDC.address, payoutValue);
            
            // Treasury should get 1 USDC
            expect(await USDC.balanceOf(Treasury.address))
                .to.equal(USDCBonded);
        });


        it("Should increase PANA total supply", async function() {
            await Treasury.connect(reserveDepositor).deposit(USDCBonded, USDC.address, payoutValue);
            let finalPanaSupply = panaSupply.add(payoutValue).sub(profits);
            expect(await PANA.totalSupply())
                .to.equal(finalPanaSupply);
        });

        it("Should increase depositor PANA balance", async function() {
            await Treasury.connect(reserveDepositor).deposit(USDCBonded, USDC.address, payoutValue);
            let finaldepBalance = depBalance.add(payoutValue).sub(profits);
            expect(await PANA.balanceOf(reserveDepositor.address))
                .to.equal(finaldepBalance);
        });

    });

    describe("Withdrawal From Treasury", function() {
        let USDCDeposited,
            USDCToWithdraw: any,
            USDCWithdrawnPANAEquivalent: any,
            panaSupply: any,
            treasuryUSDCBalance: any,
            spenderUSDCBalance: any,
            spenderPANABalance: any,
            payoutValue: any,
            totalReserves: any;

        beforeEach(
            async function() {
                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS);

                // // Add reserve spender for testing purposes
                // await Treasury.connect(governor)
                // .enable(1, reserveSpender.address, ZERO_ADDRESS);

                // Add reward manager for testing purposes
                await Treasury.connect(governor)
                .enable(6, rewardManager.address, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(1, USDC.address, ZERO_ADDRESS);

                USDCDeposited = bigNumberRepresentation(decimalRepresentation(8, USDCDecimals));
                USDCToWithdraw = bigNumberRepresentation(decimalRepresentation(2, USDCDecimals));
                USDCWithdrawnPANAEquivalent = bigNumberRepresentation(panaValBigNumber(USDCToWithdraw, PANADecimals, USDCDecimals));

                // Mint 8 USDCs to reserveDepositor and deployer for testing purposes and approve treasury as spender
                await USDC.mint(deployer.address, USDCDeposited);
                await USDC.approve(Treasury.address, USDCDeposited);
                await USDC.mint(reserveDepositor.address, USDCDeposited);
                await USDC.connect(reserveDepositor).approve(Treasury.address, USDCDeposited);

                // Deposit 8 USDCs into treasury for testing purposes
                // Assume price 1:100 then 800 for minting to spender
                payoutValue = bigNumberRepresentation(panaValBigNumber(USDCDeposited, PANADecimals, USDCDecimals, 100));
                await Treasury.connect(reserveDepositor).deposit(USDCDeposited, USDC.address, payoutValue);

                // Mint 200 PANA to reserve spender for testing purposes
                //PANA.setVault(deployer.address);
                await Treasury.connect(rewardManager).mint(reserveSpender.address, bigNumberRepresentation(decimalRepresentation(200, PANADecimals)));

                // approve treasury to burn 200 PANA from spender balances
                PANA.connect(reserveSpender)
                    .approve(
                        Treasury.address, 
                        bigNumberRepresentation(decimalRepresentation(200, PANADecimals))
                    );

                panaSupply = await PANA.balanceOf(Treasury.address);
                treasuryUSDCBalance = await USDC.balanceOf(Treasury.address);
                spenderUSDCBalance = await USDC.balanceOf(reserveSpender.address);
                spenderPANABalance = await PANA.balanceOf(reserveSpender.address);
            }
        );

        // it("Should allow only approved tokens to be withdrawn", async function() {
        //     await expect(Treasury.withdraw(USDCToWithdraw, testAddress.address))
        //             .to.be.revertedWith('Treasury: not accepted');
        // });

        // it("Should only allow approved spenders to withdraw", async function() {
        //     await expect(Treasury.withdraw(USDCToWithdraw, USDC.address))
        //             .to.be.revertedWith('Treasury: not approved');
        // });

        // it("Should transfer 2 USDCs to reserve spender", async function() {
        //     await Treasury.connect(reserveSpender).withdraw(USDCToWithdraw, USDC.address);
        //     expect(await USDC.balanceOf(reserveSpender.address)).to.equal(USDCToWithdraw);
        // });


        // it("Should decrease treasury USDCs balance by USDC withdrawn", async function() {
        //     await Treasury.connect(reserveSpender).withdraw(USDCToWithdraw, USDC.address);
        //     let finalTreasuryUSDCBalance = treasuryUSDCBalance.sub(USDCToWithdraw);
        //     expect(await USDC.balanceOf(Treasury.address)).to.equal(finalTreasuryUSDCBalance);
        // });

        // it("Should burn PANA from spenders balance", async function() {
        //     await Treasury.connect(reserveSpender).withdraw(USDCToWithdraw, USDC.address);
        //     let finalSpenderPANABalance = spenderPANABalance.sub(USDCWithdrawnPANAEquivalent);
        //     expect(await PANA.balanceOf(reserveSpender.address)).to.equal(finalSpenderPANABalance);
        // });

        // it("Should reduce PANA from reserve spender and add to treasury", async function() {
        //     await Treasury.connect(reserveSpender).withdraw(USDCToWithdraw, USDC.address);
        //     // let finalSupply = panaSupply.sub(USDCWithdrawnPANAEquivalent);

        //     expect(await PANA.balanceOf(Treasury.address)).to.equal(USDCWithdrawnPANAEquivalent);
        //     expect(await PANA.balanceOf(reserveSpender.address)).to.equal(spenderPANABalance.sub(USDCWithdrawnPANAEquivalent));

        // });
    });


    describe("Mint Rewards", function() {
        let USDCDeposited,
            rewardeePANABalance: any,
            rewardAmount: any,
            panaSupply: any,
            DAOProfit: any,
            payoutValue,
            totalReserves;

        beforeEach(
            async function() {
                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS);

                // Add reward manager for testing purposes
                await Treasury.connect(governor)
                .enable(6, rewardManager.address, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(1, USDC.address, ZERO_ADDRESS);

                USDCDeposited = bigNumberRepresentation(decimalRepresentation(2, USDCDecimals));
                DAOProfit = bigNumberRepresentation(decimalRepresentation(200, PANADecimals));

                // Mint 2 USDCs to reserveDepositor and deployer for testing purposes and approve treasury as spender
                await USDC.mint(deployer.address, USDCDeposited);
                await USDC.approve(Treasury.address, USDCDeposited);
                await USDC.mint(reserveDepositor.address, USDCDeposited);
                await USDC.connect(reserveDepositor).approve(Treasury.address, USDCDeposited);

                // Deposit 2 USDCs into treasury for testing purposes
                // Assume 2 USDCs as profit to treasury for creating excess reserves which are then used for rewards
                //payoutValue = bigNumberRepresentation(panaIntrinsicValBigNumber(USDCDeposited, PANADecimals, USDCDecimals));
                //await Treasury.connect(reserveDepositor).deposit(USDCDeposited, USDC.address, DAOProfit);
                await USDC.connect(reserveDepositor).transferFrom(reserveDepositor.address, Treasury.address, USDCDeposited);
                //await Treasury.updateReserves();
                //console.log(await USDC.balanceOf(Treasury.address));

                panaSupply = await PANA.totalSupply();
                rewardeePANABalance = await PANA.balanceOf(rewardee.address);
                rewardAmount = bigNumberRepresentation(decimalRepresentation(100, PANADecimals));               
            }
        );

        it('Should allow only reward manager to mint rewards', async function() {
            await expect(Treasury.mint(rewardee.address, rewardAmount))
                    .to.be.revertedWith('Treasury: not approved');
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
        let USDCDeposited,
            USDCToWithdraw: any,
            USDCWithdrawnPANAEquivalent: any,
            payoutValue,
            panaSupply,
            treasuryUSDCBalance: any,
            managerUSDCBalance: any;

        beforeEach(
            async function() {
                //Add reserve depositor for testing purposes
                await Treasury.connect(governor)
                .enable(0, reserveDepositor.address, ZERO_ADDRESS);

                // Add reserve manager for testing purposes
                await Treasury.connect(governor)
                .enable(2, reserveManager.address, ZERO_ADDRESS);

                //Add reserve token for testing purposes
                await Treasury.connect(governor)
                .enable(1, USDC.address, ZERO_ADDRESS);

                USDCDeposited = bigNumberRepresentation(decimalRepresentation(8, USDCDecimals));
                USDCToWithdraw = bigNumberRepresentation(decimalRepresentation(2, USDCDecimals));
                USDCWithdrawnPANAEquivalent = bigNumberRepresentation(panaValBigNumber(USDCToWithdraw, PANADecimals, USDCDecimals));

                // Mint 8 USDCs to reserveDepositor for testing purposes and approve treasury as spender
                await USDC.mint(reserveDepositor.address, USDCDeposited);
                await USDC.connect(reserveDepositor).approve(Treasury.address, USDCDeposited);

                // Deposit 8 USDCs into treasury for testing purposes
                // Assume profits=200
                payoutValue = bigNumberRepresentation(panaValBigNumber(USDCDeposited, PANADecimals, USDCDecimals));
                await Treasury.connect(reserveDepositor).deposit(USDCDeposited, USDC.address,  bigNumberRepresentation(decimalRepresentation(200, PANADecimals)));

                panaSupply = await PANA.totalSupply();
                treasuryUSDCBalance = await USDC.balanceOf(Treasury.address);
                managerUSDCBalance = await USDC.balanceOf(reserveManager.address);
            }
        );

        it("Should allow only reserve manager to withdraw tokens", async function() {
            await expect(Treasury.manage(USDC.address, USDCToWithdraw))
                    .to.be.revertedWith('Treasury: not approved');
        });

        it("Should decrease treasury USDC balance", async function() {
            await Treasury.connect(reserveManager).manage(USDC.address, USDCToWithdraw);
            let finalTreasuryUSDCBalance = treasuryUSDCBalance.sub(USDCToWithdraw);
            expect(await USDC.balanceOf(Treasury.address)).to.equal(finalTreasuryUSDCBalance.toString());
        });

        it("Should increase manager USDC balance", async function() {
            await Treasury.connect(reserveManager).manage(USDC.address, USDCToWithdraw);
            let finalManagerUSDCBalance = managerUSDCBalance.add(USDCToWithdraw);
            expect(await USDC.balanceOf(reserveManager.address)).to.equal(finalManagerUSDCBalance.toString());
        });

        /*it("Should only allow reserve tokens to be withdrawn", async function() {
            await expect(Treasury.connect(reserveManager).manage(testAddress.address, USDCToWithdraw))
                    .to.be.revertedWith('Treasury: not approved');
        });*/

        /*it("Should audit reserves", async function() {

            let USDCMinted = bigNumberRepresentation(decimalRepresentation(2, USDCDecimals));

            console.log(await Treasury.totalReserves());

            // Mint 2 USDCs directly to treasury for testing purposes
            await USDC.mint(Treasury.address, USDCMinted);

            console.log(await Treasury.totalReserves());

            let USDCMintedPANAEquivalent = bigNumberRepresentation(panaIntrinsicValBigNumber(USDCMinted, PANADecimals, USDCDecimals));

            console.log(await Treasury.totalReserves());

            await Treasury.connect(governor).auditReserves();

            console.log(await Treasury.totalReserves());

            let finalTreasuryReserves = totalReserves.add(USDCMintedPANAEquivalent);
            expect(await Treasury.totalReserves()).to.equal(finalTreasuryReserves.toString());
        });*/
    });

});