import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber"

import {
    PPanaERC20,
    PPanaERC20__factory
  } from '../../types';


describe("pPANA Token contract", function() {
    let deployer: SignerWithAddress;
    let panaAdmin: SignerWithAddress;
    let buyer1: SignerWithAddress;
    let buyer2: SignerWithAddress;
    let pPANA: PPanaERC20;

    beforeEach(
        async function() {
            [ deployer, panaAdmin, buyer1, buyer2 ] = await ethers.getSigners();

            // initialize only run once
            pPANA = await (new PPanaERC20__factory(deployer).deploy(panaAdmin.address));
        }
    );

    describe("Deployment", function() {
        it("Should set the right owner", async () => {
            expect(await pPANA.owner()).to.equal(panaAdmin.address);
        });
    })

    describe("Check permission settings", function() {

        it("Confirm owner is not seller approved", async () => {
            expect( await pPANA.isApprovedSeller(deployer.address)).to.equal(false);
        });

        it("Confirm panaadmin is seller approved", async () => {
            expect( await pPANA.isApprovedSeller(panaAdmin.address)).to.equal(true);
        });

        it("Confirm adhoc user is not seller approved", async () => {
            expect( await pPANA.isApprovedSeller(buyer1.address)).to.equal(false);
        });

        it("Confirm owner balance is 0", async () => {            
            expect( await pPANA.balanceOf(deployer.address)).to.equal(0);
        });

        it("Confirm panaaadmin balance is equal to total supply", async () => {
            const panaAdminBalance = await pPANA.balanceOf(panaAdmin.address);
            expect( await pPANA.totalSupply()).to.equal(panaAdminBalance);
        });
    })

    describe("Check minting details", function() {
        it("The decimal point should be 18", async () => {
            expect(await pPANA.decimals()).to.equals(18);
        });
        it("The total number of tokens minted should be 1 billion", async () => {
            expect( await pPANA.totalSupply() ).to.equal( ethers.utils.parseUnits( String( 1000000000 ), "ether" ) );
        });
    })

    describe("Ownership and transfer settings", function() {
        it("check balance is 0 before transfer and then check after transfer", async () => {
            const balanceBuyer1 = await pPANA.balanceOf(buyer1.address);           
            await pPANA.connect(panaAdmin).transfer(buyer1.address, ethers.utils.parseUnits( String( 10000 ), "ether" ) );
            const balanceNowBuyer1 = await pPANA.balanceOf(buyer1.address);
            const balanceNowPanaAdmin = await pPANA.balanceOf(panaAdmin.address);
            expect( balanceBuyer1).to.equal(0);
            expect( balanceNowBuyer1).to.equal(ethers.utils.parseUnits( String( 10000 ), "ether" ) );
            expect( balanceNowPanaAdmin).to.equal(ethers.utils.parseUnits( String( 999990000 ), "ether" ) );
        });

        it("check 0 balance account cannot transfer pPana", async () => {
            await expect (pPANA.connect(buyer1).transfer(buyer2.address, ethers.utils.parseUnits( String( 100 ), "ether" )))
                .to.be.revertedWith("Account not approved to transfer pPANA.");
        });

        it("check non 0 balance account cannot transfer pPana without approval", async () => {      
            await pPANA.connect(panaAdmin).transfer(buyer1.address, ethers.utils.parseUnits( String( 10000 ), "ether" ) );
            const balanceNowBuyer1 = await pPANA.balanceOf(buyer1.address);
            const balanceNowPanaAdmin = await pPANA.balanceOf(panaAdmin.address);
            expect( balanceNowBuyer1).to.equal(ethers.utils.parseUnits( String( 10000 ), "ether" ) );
            expect( balanceNowPanaAdmin).to.equal(ethers.utils.parseUnits( String( 999990000 ), "ether" ) );
            await expect (pPANA.connect(buyer1).transfer(buyer2.address, ethers.utils.parseUnits( String( 100 ), "ether" )))
                .to.be.revertedWith("Account not approved to transfer pPANA.");
        });

        it("check non 0 balance account can transfer pPana with approval", async () => {      
            await pPANA.connect(panaAdmin).transfer(buyer1.address, ethers.utils.parseUnits( String( 10000 ), "ether" ) );
            const balanceNowBuyer1 = await pPANA.balanceOf(buyer1.address);
            const balanceNowPanaAdmin = await pPANA.balanceOf(panaAdmin.address);
            expect( balanceNowBuyer1).to.equal(ethers.utils.parseUnits( String( 10000 ), "ether" ) );
            expect( balanceNowPanaAdmin).to.equal(ethers.utils.parseUnits( String( 999990000 ), "ether" ) );
            await pPANA.connect(panaAdmin).allowOpenTrading();
            await pPANA.connect(buyer1).transfer(buyer2.address, ethers.utils.parseUnits( String( 1000 ), "ether" ));
            expect (await pPANA.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits( String( 9000 ), "ether" ));
            expect (await pPANA.balanceOf(buyer2.address)).to.equal(ethers.utils.parseUnits( String( 1000 ), "ether" ));
        });

        it("check non 0 balance account can transfer pPana with approved seller back", async () => {      
            await pPANA.connect(panaAdmin).transfer(buyer1.address, ethers.utils.parseUnits( String( 10000 ), "ether" ) );
            const balanceNowBuyer1 = await pPANA.balanceOf(buyer1.address);
            const balanceNowPanaAdmin = await pPANA.balanceOf(panaAdmin.address);
            expect( balanceNowBuyer1).to.equal(ethers.utils.parseUnits( String( 10000 ), "ether" ) );
            expect( balanceNowPanaAdmin).to.equal(ethers.utils.parseUnits( String( 999990000 ), "ether" ) );
            await pPANA.connect(panaAdmin).addApprovedSeller(buyer1.address);
            await pPANA.connect(buyer1).transfer(buyer2.address, ethers.utils.parseUnits( String( 1000 ), "ether" ));
            expect (await pPANA.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits( String( 9000 ), "ether" ));
            expect (await pPANA.balanceOf(buyer2.address)).to.equal(ethers.utils.parseUnits( String( 1000 ), "ether" ));
            await pPANA.connect(buyer2).transfer(buyer1.address, ethers.utils.parseUnits( String( 500 ), "ether" ));
            expect (await pPANA.balanceOf(buyer1.address)).to.equal(ethers.utils.parseUnits( String( 9500 ), "ether" ));
            expect (await pPANA.balanceOf(buyer2.address)).to.equal(ethers.utils.parseUnits( String( 500 ), "ether" ));
        });

    })
});