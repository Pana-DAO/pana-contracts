// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { FakeContract, smock } from '@defi-wonderland/smock'
// import {
//   IStaking,
//   SPana,
//   SPana__factory,
//   Karsha,
//   Karsha__factory,
//   PanaAuthority__factory,
//   ITreasury,
//   IsPana,
// } from '../../types';

// const bigNumberRepresentation = (number:any) => {
//   return ethers.BigNumber.from(number.toString());
// };
// const decimalRepresentation = (value:any, decimals:any) => {
//   return bigNumberRepresentation(value*(10**decimals));
// };
// const decimalRepresentation_1 = (value:any, decimals:any) => {
//   return (value*(10**decimals));
// };

// const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

// describe("Karsha-transfer-debt", () => {
//   let deployer: SignerWithAddress;
//   let vault: SignerWithAddress;
//   let bob: SignerWithAddress;
//   let alice: SignerWithAddress;
//   let initializer: SignerWithAddress;
//   let stakingAddress: SignerWithAddress;
//   let karsha: Karsha;
//   let sPanaFake: FakeContract<IsPana>;
//   let stakingFake: FakeContract<IStaking>;
//   let treasuryFake: FakeContract<ITreasury>;
//   let indexDecimal = 18;
//   beforeEach(async () => {
//     [deployer, vault, bob, alice,initializer,stakingAddress] = await ethers.getSigners();
//     const authority = await (new PanaAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address, ZERO_ADDRESS);
//     await authority.deployed();
//     treasuryFake = await smock.fake<ITreasury>('ITreasury');
//     stakingFake = await smock.fake<IStaking>('IStaking');
//     stakingFake.attach(stakingAddress.address);    
//     sPanaFake = await smock.fake<IsPana>("contracts/interfaces/IsPana.sol:IsPana");
//     karsha = await (new Karsha__factory(deployer)).deploy(deployer.address,sPanaFake.address);
//     await karsha.migrate(stakingAddress.address,sPanaFake.address);
//     sPanaFake.index.returns(ethers.utils.parseUnits( String( 2 ), "ether" ));
//     await karsha.connect(stakingAddress).mint(bob.address, ethers.utils.parseUnits( String( 100 ), "ether" ));  
//     await karsha.connect(stakingAddress).mint(stakingAddress.address, ethers.utils.parseUnits( String( 10000 ), "ether" ));  
//   });


//   describe("debt balance checking", () => {
//     it("transfer karsha", async () => {
//         await karsha.connect(bob).transfer(alice.address, ethers.utils.parseUnits( String( 50 ), "ether" ));  
//         expect(await karsha.balanceOf(alice.address)).to.equal(ethers.utils.parseUnits( String( 50 ), "ether" )); 
//         expect(await karsha.balanceOf(bob.address)).to.equal(ethers.utils.parseUnits( String( 50 ), "ether" ));    
//     });
//     it("revert transfer karsha with debt", async () => {
//         sPanaFake.debtBalances.whenCalledWith(bob.address).returns(ethers.utils.parseUnits( String( 101 ), "ether" ));
//         await expect(karsha.connect(bob).transfer(alice.address, ethers.utils.parseUnits( String( 50 ), "ether" ))).
//         to.be.revertedWith("KARSHA: insufficient balance due to debt"); 
//         expect(await karsha.balanceOf(alice.address)).to.equal(0); 
//         expect(await karsha.balanceOf(bob.address)).to.equal(ethers.utils.parseUnits( String( 100 ), "ether" ));    
//     });
//     it("transfer karsha with less debt", async () => {
//         sPanaFake.debtBalances.whenCalledWith(bob.address).returns(ethers.utils.parseUnits( String( 45 ), "ether" ));
//         await karsha.connect(bob).transfer(alice.address, ethers.utils.parseUnits( String( 50 ), "ether" ));  
//     });
//     it("revert transfer karsha with greater then balance", async () => {
//         await expect(karsha.connect(bob).transfer(alice.address, ethers.utils.parseUnits( String( 150 ), "ether" ))).
//         to.be.revertedWith("ERC20: transfer amount exceeds balance"); 
//     });
//     it("reverted burn karsha with debt", async () => {
//         sPanaFake.debtBalances.whenCalledWith(bob.address).returns(ethers.utils.parseUnits( String( 101 ), "ether" ));
//         await expect(karsha.connect(stakingAddress).burn(bob.address, ethers.utils.parseUnits( String( 50 ), "ether" ))).
//         to.be.revertedWith("KARSHA: insufficient balance due to debt"); 
//     });
//     it("burn karsha with less debt", async () => {
//         sPanaFake.debtBalances.whenCalledWith(bob.address).returns(ethers.utils.parseUnits( String( 45 ), "ether" ));
//         await karsha.connect(stakingAddress).burn(bob.address, ethers.utils.parseUnits( String( 50 ), "ether" ));  
//     });
   
//   });
// });