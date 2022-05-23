import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai, { expect } from "chai";
import { ethers, upgrades, network } from "hardhat";
const { BigNumber } = ethers;
import { smock, MockContract } from "@defi-wonderland/smock";
import {
    PanaERC20Token,
    PanaERC20Token__factory,    
    PanaAuthority__factory,
    PPanaUpgradeableERC20,
    PPanaUpgradeableERC20__factory,
    PPanaRedeem,
    PPanaRedeem__factory,
    PanaTreasury,
    DAI
  } from '../../types';

chai.use(smock.matchers);

async function moveTimestamp(seconds:number) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
}

describe("PPana redemption", () => {

    let deployerOwner: SignerWithAddress; 
    let governor: SignerWithAddress;
    let pPANARedeem: PPanaRedeem; 
    let pPANA: PPanaUpgradeableERC20;
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
    let dai: DAI;

    beforeEach(async () => {
        [ deployerOwner, daoMultisig, governor,
            teamMember, teamMember1, teamMember2, 
            idoParticipant, idoParticipant1, idoParticipant2, 
            panaUser1, panaUser2 ] = await ethers.getSigners();

        // For authority
        const authority = await (new PanaAuthority__factory(deployerOwner)).deploy(governor.address, deployerOwner.address, 
            deployerOwner.address, daoMultisig.address);
        await authority.deployed(); 

        // For PANA   
        pana = await (new PanaERC20Token__factory(deployerOwner)).deploy(authority.address);        
        //BEGIN--The below code is to set the total supply of pana (20 Million in total supply)
        pana.connect(daoMultisig).mint(panaUser1.address, ethers.utils.parseUnits( String( 10000000 ), "ether" ));
        pana.connect(daoMultisig).mint(panaUser2.address, ethers.utils.parseUnits( String( 10000000 ), "ether" ));
        //END
        
        // For pPANA
        pPANA = await upgrades.deployProxy(new PPanaUpgradeableERC20__factory(deployerOwner), [daoMultisig.address], 
                {initializer: 'initialize'}) as PPanaUpgradeableERC20;
        await pPANA.deployed();

        // For Treasury
        let treasuryContract = await ethers.getContractFactory("PanaTreasury");
        const blocksNeededForQueue = 1;    
        treasury = await treasuryContract.deploy(pana.address, blocksNeededForQueue, authority.address) as PanaTreasury;

        // for DAI
        let daiTokenContract = await ethers.getContractFactory("DAI");
        dai = await daiTokenContract.deploy(0) as DAI;
        
        // For pPANARedeem
        pPANARedeem = await (new PPanaRedeem__factory(deployerOwner)).deploy(pPANA.address, pana.address, 
                dai.address, treasury.address, daoMultisig.address);
        await pPANARedeem.deployed();

        // teamMember has dai and pPana
        // teamMember1 does not have both dai and pPana
        // teamMember2 has pPana alone.

        await dai.mint(teamMember.address, ethers.utils.parseUnits( String( 5000000 ), "ether" ) );
        await pPANA.connect(daoMultisig).transfer(teamMember.address, ethers.utils.parseUnits( String( 40000000 ), "ether" ));
        await pPANA.connect(daoMultisig).transfer(teamMember2.address, ethers.utils.parseUnits( String( 40000000 ), "ether" )); 
        await pPANA.connect(daoMultisig).addApprovedSeller(teamMember.address);
        
        await dai.mint(idoParticipant.address, ethers.utils.parseUnits( String( 5000000 ), "ether" ) );
        await pPANA.connect(daoMultisig).transfer(idoParticipant.address, ethers.utils.parseUnits( String( 60000 ), "ether" ));
        await pPANA.connect(daoMultisig).transfer(idoParticipant1.address, ethers.utils.parseUnits( String( 50000 ), "ether" ));
        await pPANA.connect(daoMultisig).addApprovedSeller(idoParticipant.address); 
        
        await authority.connect(governor).pushVault(treasury.address, true);
        await treasury.connect(governor).enable(0, pPANARedeem.address, ethers.constants.AddressZero, ethers.constants.AddressZero); 
        await treasury.connect(governor).enable(2, dai.address, ethers.constants.AddressZero, ethers.constants.AddressZero);
        
        await treasury.connect(governor).setBaseValue("100000000000");
    });

    
    describe("Checking if everything is minted" , function () {
        it("Should set the right owner", async () => {
            expect(await pPANA.owner()).to.equal(daoMultisig.address);
            expect(await pPANARedeem.owner()).to.equal(daoMultisig.address);
        });

        it("Make sure Team member has pPana and DAI", async () => {
            expect (await dai.balanceOf(teamMember.address)).to.equal(ethers.utils.parseUnits( String( 5000000 ), "ether" ));
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
                expect (await pPANARedeem.redeemableFor(teamMember.address)).to.equal(ethers.utils.parseUnits( String( 624 ), "ether" ));  // 624 pPana
                expect (await pPANARedeem.redeemableFor(teamMember2.address)).to.equal(ethers.utils.parseUnits( String( 624 ), "ether" ));  // 624 pPana
                expect (await pPANARedeem.redeemableFor(teamMember1.address)).to.equal(ethers.utils.parseUnits( String( 0 ), "ether" ));  
            });

            it("Make sure Team member is not allowed to exercise more than redeemable", async () => {
                await expect(
                    pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 625 ), "ether" ))
                ).to.be.revertedWith("Not enough vested");
            });

            it("Make sure Team member can lock the pPana for redemption", async () => {
                const teamMember_pPanaBalance_preExercise = await pPANA.balanceOf(teamMember.address);    
                const teamMember_DAIBalance_preExercise = await dai.balanceOf(teamMember.address);

                await dai.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 624 ), "ether" )); 
                await pPANA.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 624 ), "ether" )); 

                await pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 624 ), "ether" ));
                
                const teamMember_pPanaBalance_postExercise = await pPANA.balanceOf(teamMember.address);
                const teamMember_DAIBalance_postExercise = await dai.balanceOf(teamMember.address);

                expect(teamMember_pPanaBalance_postExercise).to.equal(teamMember_pPanaBalance_preExercise.sub(ethers.utils.parseUnits( String( 624 ), "ether" )));
                expect(teamMember_DAIBalance_postExercise).to.equal(teamMember_DAIBalance_preExercise.sub(ethers.utils.parseUnits( String( 624 ), "ether" )));
            });

            it("Make sure an error is thrown if team member try to redeem before lock duration", async () => {
    
                await dai.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 624 ), "ether" )); 
                await pPANA.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 624 ), "ether" )); 

                await pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 624 ), "ether" ));

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
    
                await dai.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 624 ), "ether" )); 
                await pPANA.connect(teamMember).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 624 ), "ether" )); 
                await pPANARedeem.connect(teamMember).exercise(ethers.utils.parseUnits( String( 624 ), "ether" ));

                await moveTimestamp(432000); // pass lock duration.
                const panaRedeemed = await pPANARedeem.connect(teamMember).claimRedeemable();
                //expect (panaRedeemed).to.equal(ethers.utils.parseUnits( String( 62400 ), "ether" ));

                const teamMember_panaBalance_postExercise = await pana.balanceOf(teamMember.address);
                expect(teamMember_panaBalance_postExercise).to.equal(teamMember_panaBalance_preExercise.add(ethers.utils.parseUnits( String( 62400 ), "ether" )));
            });                
        });

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
                const idoMember_DAIBalance_preExercise = await dai.balanceOf(idoParticipant.address);

                await dai.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 
                await pPANA.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 

                await pPANARedeem.connect(idoParticipant).exercise(ethers.utils.parseUnits( String( 60000 ), "ether" ));
                
                const idoMember_pPanaBalance_postExercise = await pPANA.balanceOf(idoParticipant.address);
                const idoMember_DAIBalance_postExercise = await dai.balanceOf(idoParticipant.address);

                expect(idoMember_pPanaBalance_postExercise).to.equal(idoMember_pPanaBalance_preExercise.sub(ethers.utils.parseUnits( String( 60000 ), "ether" )));
                expect(idoMember_DAIBalance_postExercise).to.equal(idoMember_DAIBalance_preExercise.sub(ethers.utils.parseUnits( String( 60000 ), "ether" )));
            });

            it("Make sure an error is thrown if IDO participants try to redeem before lock duration", async () => {
    
                await dai.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 
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
    
                await dai.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 
                await pPANA.connect(idoParticipant).approve(pPANARedeem.address, ethers.utils.parseUnits( String( 60000 ), "ether" )); 
                await pPANARedeem.connect(idoParticipant).exercise(ethers.utils.parseUnits( String( 60000 ), "ether" ));

                await moveTimestamp(432000); // pass lock duration.
                const panaRedeemed = await pPANARedeem.connect(idoParticipant).claimRedeemable();
                //expect (panaRedeemed).to.equal(ethers.utils.parseUnits( String( 62400 ), "ether" ));

                const idoMember_panaBalance_postExercise = await pana.balanceOf(idoParticipant.address);
                expect(idoMember_panaBalance_postExercise).to.equal(idoMember_panaBalance_preExercise.add(ethers.utils.parseUnits( String( 6000000 ), "ether" )));
            });                
        });
    });
})