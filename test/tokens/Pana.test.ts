import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  PanaERC20Token,
  PanaERC20Token__factory,
  PanaAuthority__factory
} from '../../types';

const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

describe("Pana-Token-Test", () => {
  let deployer: SignerWithAddress;
  let vault: SignerWithAddress;
  let bob: SignerWithAddress;
  let alice: SignerWithAddress;
  let pana: PanaERC20Token;

  beforeEach(async () => {
    [deployer, vault, bob, alice] = await ethers.getSigners();

    const authority = await (new PanaAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address, ZERO_ADDRESS);
    await authority.deployed();

    pana = await (new PanaERC20Token__factory(deployer)).deploy(authority.address);

  });

  it("correctly constructs an ERC20", async () => {
    expect(await pana.name()).to.equal("Pana DAO");
    expect(await pana.symbol()).to.equal("PANA");
    expect(await pana.decimals()).to.equal(18);
  });

  describe("mint", () => {
    it("must be done by vault", async () => {
      await expect(pana.connect(deployer).mint(bob.address, 100)).
        to.be.revertedWith("UNAUTHORIZED");
    });

    it("increases total supply", async () => {
      let supplyBefore = await pana.totalSupply();
      await pana.connect(vault).mint(bob.address, 100);
      expect(supplyBefore.add(100)).to.equal(await pana.totalSupply());
    });
  });

  describe("burn", () => {
    beforeEach(async () => {
      await pana.connect(vault).mint(bob.address, 100);
    });

    it("reduces the total supply", async () => {
      let supplyBefore = await pana.totalSupply();
      await pana.connect(bob).burn(10);
      expect(supplyBefore.sub(10)).to.equal(await pana.totalSupply());
    });

    it("reduces the bob balance", async () => {      
      let bobBalance = await pana.balanceOf(bob.address);
      await pana.connect(bob).burn(10);
      let bobNewBalance = await pana.balanceOf(bob.address);
      expect(bobBalance.toNumber()-10).to.equal(bobNewBalance.toNumber());
    });
    it("cannot exceed total supply", async () => {
      let supply = await pana.totalSupply();
      await expect(pana.connect(bob).burn(supply.add(1))).
        to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("cannot exceed bob's balance", async () => {
      await pana.connect(vault).mint(alice.address, 15);
      await expect(pana.connect(alice).burn(16)).
        to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });
});