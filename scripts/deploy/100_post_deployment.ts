import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitFor } from "../txHelper";
import { CONTRACTS, INITIAL_REWARD_RATE, INITIAL_INDEX, getDAIAddress, INITIAL_BASE_VALUE } from "../constants";
import {
    PanaAuthority__factory,
    Distributor__factory,
    PanaERC20Token__factory,
    PanaStaking__factory,
    SPana__factory,
    Karsha__factory,
    PanaTreasury__factory,
    PanaBondDepository__factory
} from "../../types";

// TODO: Shouldn't run setup methods if the contracts weren't redeployed.
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers, getChainId } = hre;
    const { deployer, daoMultisig, daoPolicy } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);
    const chainId = await getChainId();
    const DAI = getDAIAddress(chainId);

    console.log("DAI Being Used -- " + DAI);

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const sPanaDeployment = await deployments.get(CONTRACTS.sPana);
    const karshaDeployment = await deployments.get(CONTRACTS.karsha);
    const distributorDeployment = await deployments.get(CONTRACTS.distributor);
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const stakingDeployment = await deployments.get(CONTRACTS.staking);
    const bondDepoDeployment = await deployments.get(CONTRACTS.bondDepo);

    const authorityContract = await PanaAuthority__factory.connect(
        authorityDeployment.address,
        signer
    );
    const pana = PanaERC20Token__factory.connect(panaDeployment.address, signer);
    const sPana = SPana__factory.connect(sPanaDeployment.address, signer);
    const karsha = Karsha__factory.connect(karshaDeployment.address, signer);
    const distributor = Distributor__factory.connect(distributorDeployment.address, signer);
    const staking = PanaStaking__factory.connect(stakingDeployment.address, signer);
    const treasury = PanaTreasury__factory.connect(treasuryDeployment.address, signer);
    const bondDepo = PanaBondDepository__factory.connect(bondDepoDeployment.address, signer);

    // Step 1: Set treasury as vault on authority
    await waitFor(authorityContract.pushVault(treasury.address, true));
    console.log("Setup -- authorityContract.pushVault: set vault on authority");

    // Step 2: Set bonding contract as treasury depositor
    await waitFor(treasury.enable(0, bondDepo.address, ethers.constants.AddressZero, ethers.constants.AddressZero)); // Allows bonding contract to deposit reserves.
    console.log("Setup -- treasury.enable(0):  bonding contractor enabled to deposit reserves to treasury");

    // Step 2.1: Set DAO Wallet as treasury depositor
    await waitFor(treasury.enable(0, daoMultisig, ethers.constants.AddressZero, ethers.constants.AddressZero)); // Allows bonding contract to deposit reserves.
    console.log("Setup -- treasury.enable(0):  DAO wallet enabled to deposit reserves to treasury");

    // Step 3: Add DAI as reserve token for treasury
    await waitFor(treasury.enable(2, DAI, ethers.constants.AddressZero, ethers.constants.AddressZero)); // Allows DAI to be declared as reserve token.
    console.log("Setup -- treasury.enable(2):  DAI enabled as reserve token for treasury");

    // Step 4: Set bonding contract as LP depositor to treasury
    await waitFor(treasury.enable(4, bondDepo.address, ethers.constants.AddressZero, ethers.constants.AddressZero)); // Allows bonding contract to deposit LP reserves.
    console.log("Setup -- treasury.enable(4):  bonding contractor enabled to deposit LP reserves to treasury");

    // Step 5: Add LP token as reserve token for treasury
    //await waitFor(treasury.enable(5, <LP token address>, ethers.constants.AddressZero)); // Allows LP token to be declared as reserve token.
    //console.log("Setup -- treasury.enable(2):  LP token enabled as reserve token for treasury");

    // Step 6: Set distributor and Bond Depo as minter on treasury
    await waitFor(treasury.enable(8, distributor.address, ethers.constants.AddressZero, ethers.constants.AddressZero)); // Allows distributor to mint Pana.
    await waitFor(treasury.enable(8, bondDepo.address, ethers.constants.AddressZero, ethers.constants.AddressZero)); // Allows bond Depo to mint Pana.
    console.log("Setup -- treasury.enable(8):  distributor and bondDepo enabled to mint PANA on treasury");

    // Step 7: Add sPana address
    await waitFor(treasury.enable(9, sPana.address, ethers.constants.AddressZero, ethers.constants.AddressZero)); // Adds sPana address.
    console.log("Setup -- treasury.enable(2):  sPana address configured for treasury");

    await waitFor(treasury.setBaseValue(INITIAL_BASE_VALUE));
    console.log("Setup -- Initial Base Value is set");

    // Step 8: Initialize treasury
    await waitFor(treasury.initialize());
    console.log("Setup -- treasury initialized");

    // Step 9: Set distributor on staking
    await waitFor(staking.setDistributor(distributor.address));
    console.log("Setup -- staking.setDistributor:  distributor set on staking");

    // Step 10: Set bond depositor on staking
    await waitFor(staking.setBondDepositor(bondDepo.address));
    console.log("Setup -- staking.setBondDepositor: depositor set on staking");
    
    // Step 11: Initialize sPana and set the index
    //if ((await sPana.KARSHA()) == ethers.constants.AddressZero) {
    await waitFor(sPana.setIndex(INITIAL_INDEX));
    await waitFor(sPana.setKarsha(karsha.address));
    await waitFor(sPana.initialize(staking.address, treasuryDeployment.address, daoMultisig));
    console.log("Setup -- sPana initialized (staking, treasury)");

    await waitFor(karsha.migrate(staking.address, sPana.address));
    console.log("Setup -- karsha migrate (staking, sPana)");

    // Step 12: Set up distributor with bounty and recipient
    // await waitFor(distributor.setBounty(BOUNTY_AMOUNT));
    await waitFor(distributor.addRecipient(staking.address, INITIAL_REWARD_RATE));
    console.log("Setup -- distributor.addRecipient");

    // Step 13: Set Dao MultiSig as Policy Owner on authority
    // This is set first before governor so we dont need separate signer for setting it
    await waitFor(authorityContract.pushPolicy(daoPolicy, true));
    console.log("Setup -- authorityContract.pushPolicy: set policy owner on authority");
    await waitFor(authorityContract.pushGuardian(daoMultisig, true));
    console.log("Setup -- authorityContract.pushGuardian: set guardian on authority");

    await waitFor(authorityContract.pushGuardian(daoMultisig, true));
    console.log("Setup -- authorityContract.pushGuardian: set guardian on authority");

    // Step 14: Set 30% Treasury Rewards on each Bond Issue
    await waitFor(bondDepo.setRewards(0, 0, "3000"));
    console.log("Setup -- bondDepo.setRewards: set dao rewards");

    // Step 15: Set Dao MultiSig as Governor on authority
    await waitFor(authorityContract.pushPanaGovernor(daoMultisig, true));
    console.log("Setup -- authorityContract.pushPanaGovernor: set governor on authority");


    // Approve staking contact to spend deployer's PANA
    // TODO: Is this needed?
    // await pana.approve(staking.address, LARGE_APPROVAL);
};

func.tags = ["setup", "core"];
func.dependencies = [CONTRACTS.pana, CONTRACTS.sPana, CONTRACTS.karsha];

export default func;
