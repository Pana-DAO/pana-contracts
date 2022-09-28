import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai, { expect } from "chai";
import { ethers, network } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import {
    PanaERC20Token,
    PanaERC20Token__factory,    
    PanaAuthority__factory,
    PPanaERC20,
    PPanaERC20__factory,
    PPanaRedeem,
    PPanaRedeem__factory,
    PanaTreasury,
    USDC
  } from '../../types';

chai.use(smock.matchers);

async function moveTimestamp(seconds:number) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("PPana redemption", () => {

    let deployerOwner: SignerWithAddress; 
    let governor: SignerWithAddress;
    let pPANARedeem: PPanaRedeem; 
    let pPANA: PPanaERC20;
    let teamMember: SignerWithAddress;
    let teamMember1: SignerWithAddress;
    let teamMember2: SignerWithAddress;
    let idoParticipant : SignerWithAddress;
    let idoParticipant1 : SignerWithAddress;
    let idoParticipant2: SignerWithAddress;
    let panaUser1: SignerWithAddress;
    let panaUser2: SignerWithAddress;
    let daoMultisig: SignerWithAddress;
    let pana: PanaERC20Token;    
    let treasury: PanaTreasury;    
    let usdc: USDC;

    beforeEach(async () => {
        [ deployerOwner, daoMultisig, governor,
            teamMember, teamMember1, teamMember2, 
            idoParticipant, idoParticipant1, idoParticipant2, 
            panaUser1, panaUser2 ] = await ethers.getSigners();

        // For authority
        const authority = await (new PanaAuthority__factory(deployerOwner)).deploy(governor.address, deployerOwner.address, 
            deployerOwner.address, daoMultisig.address, ZERO_ADDRESS);
        await authority.deployed(); 

        // For PANA   
        pana = await (new PanaERC20Token__factory(deployerOwner)).deploy(authority.address);        
        //BEGIN--The below code is to set the total supply of pana (30 Million in total supply (user1 + user2 + treasury))
        pana.connect(daoMultisig).mint(panaUser1.address, ethers.utils.parseUnits( String( 10000000 ), "ether" ));
        pana.connect(daoMultisig).mint(panaUser2.address, ethers.utils.parseUnits( String( 10000000 ), "ether" ));
        //END
        
        // For pPANA
        pPANA = await (new PPanaERC20__factory(deployerOwner).deploy(daoMultisig.address));

        // For Treasury
        let treasuryContract = await ethers.getContractFactory("PanaTreasury");
        const blocksNeededForQueue = 1;    
        treasury = await treasuryContract.deploy(pana.address, blocksNeededForQueue, authority.address) as PanaTreasury;
        // minting balance for treasury
        pana.connect(daoMultisig).mint(treasury.address, ethers.utils.parseUnits( String( 10000000 ), "ether" ));


        // for USDC
        let usdcTokenContract = await ethers.getContractFactory("USDC");
        usdc = await usdcTokenContract.deploy(0) as USDC;
        
        // For pPANARedeem
        pPANARedeem = await (new PPanaRedeem__factory(deployerOwner)).deploy(pPANA.address, pana.address, 
                usdc.address, treasury.address, daoMultisig.address);
        await pPANARedeem.deployed();

        // teamMember has usdc and pPana
        // teamMember1 does not have both usdc and pPana
        // teamMember2 has pPana alone.

        await usdc.mint(teamMember.address, ethers.utils.parseUnits( String( 5000000 ), "mwei" ) );
        await pPANA.connect(daoMultisig).transfer(teamMember.address, ethers.utils.parseUnits( String( 40000000 ), "ether" ));
        await pPANA.connect(daoMultisig).transfer(teamMember2.address, ethers.utils.parseUnits( String( 40000000 ), "ether" )); 
        await pPANA.connect(daoMultisig).addApprovedSeller(teamMember.address);
        
        await usdc.mint(idoParticipant.address, ethers.utils.parseUnits( String( 5000000 ), "mwei" ) );
        await pPANA.connect(daoMultisig).transfer(idoParticipant.address, ethers.utils.parseUnits( String( 60000 ), "ether" ));
        await pPANA.connect(daoMultisig).transfer(idoParticipant1.address, ethers.utils.parseUnits( String( 50000 ), "ether" ));
        await pPANA.connect(daoMultisig).addApprovedSeller(idoParticipant.address); 
        
        await authority.connect(governor).pushVault(treasury.address, true);
        await treasury.connect(governor).enable(0, pPANARedeem.address, ethers.constants.AddressZero); 
        await treasury.connect(governor).enable(1, usdc.address, ethers.constants.AddressZero);
        await treasury.connect(governor).enable(8, pPANARedeem.address, ethers.constants.AddressZero);
        await treasury.connect(governor).setRedemptionLimit(10000);

        
    });
    
    describe("Checking if everything is minted" , function () {
        it("Should set the right owner", async () => {
            expect(await pPANA.owner()).to.equal(daoMultisig.address);
            expect(await pPANARedeem.owner()).to.equal(daoMultisig.address);
        });

        it("Make sure Team member has pPana and USDC", async () => {
            expect (await usdc.balanceOf(teamMember.address)).to.equal(ethers.utils.parseUnits( String( 5000000 ), "mwei" ));
            expect (await pPANA.balanceOf(teamMember.address)).to.equal(ethers.utils.parseUnits( String( 40000000 ), "ether" ));
        });

        it("Make sure Team member redeemable is throwing error without vesting terms setup", async () => {
            await expect(pPANARedeem.redeemableFor(teamMember.address)).to.be.revertedWith("Account not setup as pPana redemption");
        });

        describe("with vesting setup for team member" , function () {
            beforeEach(
                async function (){
                    await pPANARedeem.connect(daoMultisig).setTerms(teamMember.address, ethers.utils.parseUnits( String( 40000000 ), "ether" ), 3120, 432000);  // 7.8% * 4%
                    await pPANARedeem.connect(daoMultisig).setTerms(teamMember1.address, ethers.utils.parseUnits( String( 40000000 ), "ether" ), 3120, 432000);  // 7.8% * 4%
                    await pPANARedeem.connect(daoMultisig).setTerms(teamMember2.address, ethers.utils.parseUnits( String( 40000000 ), "ether" ), 3120, 432000);  // 7.8% * 4%
                }
            )

            it("Make sure Team member redeemable is showing correct pPana count", async () => {
                expect (await pPANARedeem.redeemableFor(teamMember.address)).to.equal(ethers.utils.parseUnits( String( 936 ), "ether" ));  // 936 pPana (circulatingSupply * rate)
                expect (await pPANARedeem.redeemableFor(teamMember2.address)).to.equal(ethers.utils.parseUnits( String( 936 ), "ether" ));  // 936 pPana
                expect (await pPANARedeem.redeemableFor(teamMember1.address)).to.equal(ethers.utils.parseUnits( String( 0 ), "ether" ));  
            });

            it("Make sure Team member is not allowed to exercise more than redeemable", async () => {
                await expect(
                    pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 937 ), "ether" ))
                ).to.be.revertedWith("Not enough vested");
            });

            it("Make sure pPana holder is not allowed to call deposit for redemption in treasury", async () => {
                await expect(
                    treasury.connect(teamMember).depositForRedemption(ethers.utils.parseUnits( String( 936 ), "mwei" ), usdc.address)
                ).to.be.revertedWith("Treasury: not approved");
            });          


            it("Make sure Team member can lock the pPana for redemption", async () => {
                const teamMember_pPanaBalance_preExercise = await pPANA.balanceOf(teamMember.address);    
                const teamMember_USDCBalance_preExercise = await usdc.balanceOf(teamMember.address);

                await usdc.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 936 ), "mwei" )); 
                await pPANA.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 936 ), "ether" )); 

                await pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 936 ), "ether" ));
                
                const teamMember_pPanaBalance_postExercise = await pPANA.balanceOf(teamMember.address);
                const teamMember_USDCBalance_postExercise = await usdc.balanceOf(teamMember.address);

                expect(teamMember_pPanaBalance_postExercise).to.equal(teamMember_pPanaBalance_preExercise.sub(ethers.utils.parseUnits( String( 936 ), "ether" )));
                expect(teamMember_USDCBalance_postExercise).to.equal(teamMember_USDCBalance_preExercise.sub(ethers.utils.parseUnits( String( 936 ), "mwei" )));
            });

            it("Make sure an error is thrown if team member try to redeem before lock duration", async () => {
    
                await usdc.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 936 ), "mwei" )); 
                await pPANA.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 936 ), "ether" )); 

                await pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 936 ), "ether" ));

                await moveTimestamp(400000); // pass some time
                await expect(
                    pPANARedeem.connect(teamMember).claimRedeemable()
                ).to.be.revertedWith("Pana is in lock period");
            });

            it("Make sure an error is thrown if team member try to redeem without locking pPana", async () => {
                await expect(
                    pPANARedeem.connect(teamMember2).claimRedeemable()
                ).to.be.revertedWith("Account does not have locked or unclaimed pana");               
            });

            it("Make sure Team member can claim the Pana after lock period", async () => {
                const teamMember_panaBalance_preExercise = await pana.balanceOf(teamMember.address);
    
                await usdc.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 936 ), "mwei" )); 
                await pPANA.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 936 ), "ether" )); 
                await pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 936 ), "ether" ));

                await moveTimestamp(432000); // pass lock duration.
                const panaRedeemed = await pPANARedeem.connect(teamMember).claimRedeemable();
                //expect (panaRedeemed).to.equal(ethers.utils.parseUnits( String( 93600 ), "ether" ));

                const teamMember_panaBalance_postExercise = await pana.balanceOf(teamMember.address);
                expect(teamMember_panaBalance_postExercise).to.equal(teamMember_panaBalance_preExercise.add(ethers.utils.parseUnits( String( 93600 ), "ether" )));
            }); 

            it("should claim the Pana per pPana by 1:100 irrespective of intrinsic value", async () => {
                const teamMember_panaBalance_preExercise = await pana.balanceOf(teamMember.address);
                
                await usdc.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 936 ), "mwei" )); 
                await pPANA.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 936 ), "ether" )); 
                await pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 936 ), "ether" ));

                await moveTimestamp(432000); // pass lock duration.
                await pPANARedeem.connect(teamMember).claimRedeemable();

                const teamMember_panaBalance_postExercise = await pana.balanceOf(teamMember.address);
                expect(teamMember_panaBalance_postExercise).to.equal(teamMember_panaBalance_preExercise.add(ethers.utils.parseUnits( String( 93600 ), "ether" )));
            });
            
        });

        /*
        describe("with vesting setup for IDO participants" , function () {
            beforeEach(
                async function (){
                    await pPANARedeem.connect(daoMultisig).setLaunchParticipantTerms(idoParticipant.address, 432000);
                    await pPANARedeem.connect(daoMultisig).setLaunchParticipantTerms(idoParticipant1.address, 432000);
                    await pPANARedeem.connect(daoMultisig).setLaunchParticipantTerms(idoParticipant2.address, 432000);
                }
            )

            it("Make sure IDO participants redeemable is showing correct pPana count", async () => {
                expect (await pPANARedeem.redeemableFor(idoParticipant.address)).to.equal(ethers.utils.parseUnits( String( 60000 ), "ether" ));  
                expect (await pPANARedeem.redeemableFor(idoParticipant1.address)).to.equal(ethers.utils.parseUnits( String( 50000 ), "ether" )); 
                expect (await pPANARedeem.redeemableFor(idoParticipant2.address)).to.equal(ethers.utils.parseUnits( String( 0 ), "ether" ));  
            });

            it("Make sure IDO participant is not allowed to exercise more than redeemable", async () => {
                await expect(
                    pPANARedeem.connect(idoParticipant).exercise(ethers.utils.parseUnits( String( 60001 ), "ether" ))
                ).to.be.revertedWith("Not enough vested");
            });

            it("Make sure IDO participant can lock the pPana for redemption", async () => {
                const idoMember_pPanaBalance_preExercise = await pPANA.balanceOf(idoParticipant.address);    
                const idoMember_USDCBalance_preExercise = await usdc.balanceOf(idoParticipant.address);

                await usdc.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 
                await pPANA.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 

                await pPANARedeem.connect(idoParticipant).exercise(ethers.utils.parseUnits( String( 60000 ), "ether" ));
                
                const idoMember_pPanaBalance_postExercise = await pPANA.balanceOf(idoParticipant.address);
                const idoMember_USDCBalance_postExercise = await usdc.balanceOf(idoParticipant.address);

                expect(idoMember_pPanaBalance_postExercise).to.equal(idoMember_pPanaBalance_preExercise.sub(ethers.utils.parseUnits( String( 60000 ), "ether" )));
                expect(idoMember_USDCBalance_postExercise).to.equal(idoMember_USDCBalance_preExercise.sub(ethers.utils.parseUnits( String( 60000 ), "ether" )));
            });

            it("Make sure IDO participants cannot redeem if treasury doesn't have enough balance of pana", async () => {
                await usdc.mint(idoParticipant.address, ethers.utils.parseUnits( String( 20000000 ), "ether" ));
                await pPANA.connect(daoMultisig).transfer(idoParticipant.address, ethers.utils.parseUnits( String( 20000000 ), "ether" ));
                
                await usdc.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 20000000 ), "ether" )); 
                await pPANA.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 20000000 ), "ether" )); 
                await expect(
                    pPANARedeem.connect(idoParticipant).exercise(ethers.utils.parseUnits( String( 20000000 ), "ether" ))
                    ).to.be.revertedWith("Not enough PANA reserves");
            }); 

            it("Make sure an error is thrown if IDO participants try to redeem before lock duration", async () => {
    
                await usdc.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 
                await pPANA.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 

                await pPANARedeem.connect(idoParticipant).exercise(ethers.utils.parseUnits( String( 60000 ), "ether" ));

                await moveTimestamp(400000); // pass some time
                await expect(
                    pPANARedeem.connect(idoParticipant).claimRedeemable()
                ).to.be.revertedWith("Pana is in lock period");
            });

            it("Make sure an error is thrown if ido participants try to redeem without locking pPana", async () => {
                await expect(
                    pPANARedeem.connect(idoParticipant1).claimRedeemable()
                ).to.be.revertedWith("Account does not have locked or unclaimed pana");               
            });

            it("Make sure IDO participants can claim the Pana after lock period", async () => {
                const idoMember_panaBalance_preExercise = await pana.balanceOf(idoParticipant.address);
    
                await usdc.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 
                await pPANA.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 
                await pPANARedeem.connect(idoParticipant).exercise(ethers.utils.parseUnits( String( 60000 ), "ether" ));

                await moveTimestamp(432000); // pass lock duration.
                const panaRedeemed = await pPANARedeem.connect(idoParticipant).claimRedeemable();
                //expect (panaRedeemed).to.equal(ethers.utils.parseUnits( String( 93600 ), "ether" ));

                const idoMember_panaBalance_postExercise = await pana.balanceOf(idoParticipant.address);
                expect(idoMember_panaBalance_postExercise).to.equal(idoMember_panaBalance_preExercise.add(ethers.utils.parseUnits( String( 6000000 ), "ether" )));
            });                
        });
        */
    });
})