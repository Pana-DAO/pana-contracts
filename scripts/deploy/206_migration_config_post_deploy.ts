import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitFor } from "../txHelper";
import { CONTRACTS,  getUSDCAddress,  getPANAUSDCLPToken, INITIAL_REWARD_RATE, FIXED_APY } from "../constants";
import {
    PanaAuthority__factory,
    Distributor__factory,
    PanaERC20Token__factory,
    PanaStaking__factory,
    SPana__factory,
    Karsha__factory,
    PanaTreasuryV2__factory,
    PanaBondDepository__factory,
    TreasuryMigrator__factory
} from "../../types";

// TODO: Shouldn't run setup methods if the contracts weren't redeployed.
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers, getChainId } = hre;
    const { deployer, daoMultisig, daoPolicy } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);
    const chainId = await getChainId();
    const USDC = getUSDCAddress(chainId);
    let lpTokenAddress = getPANAUSDCLPToken(chainId);

    
    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const sPanaDeployment = await deployments.get(CONTRACTS.sPana);
    const karshaDeployment = await deployments.get(CONTRACTS.karsha);
    const distributorV2Deployment = await deployments.get(CONTRACTS.distributorV2);    
    
    
    const stakingDeployment = await deployments.get(CONTRACTS.staking);
    const bondDepoDeployment = await deployments.get(CONTRACTS.bondDepo);

    const treasuryV2Deployment = await deployments.get(CONTRACTS.treasuryV2);
    const treasuryMigratorDeployment = await deployments.get(CONTRACTS.treasuryMigrator);

    const supplyControllerDeployment = await deployments.get(CONTRACTS.proportionalSupplyController);

    const authorityContract = await PanaAuthority__factory.connect(
        authorityDeployment.address,
        signer
    );
    const pana = PanaERC20Token__factory.connect(panaDeployment.address, signer);
    const sPana = SPana__factory.connect(sPanaDeployment.address, signer);
    const karsha = Karsha__factory.connect(karshaDeployment.address, signer);
    const distributorV2 = Distributor__factory.connect(distributorV2Deployment.address, signer);
    const staking = PanaStaking__factory.connect(stakingDeployment.address, signer);    
    const bondDepo = PanaBondDepository__factory.connect(bondDepoDeployment.address, signer);
    const oracleDeployment = await deployments.get(CONTRACTS.priceOracle);

    const treasuryV2 = PanaTreasuryV2__factory.connect(treasuryV2Deployment.address, signer);
    const treasuryMigrator = TreasuryMigrator__factory.connect(treasuryMigratorDeployment.address, signer);


    // Step 1: Set bonding contract as treasury depositor
    await waitFor(treasuryV2.enable(0, bondDepo.address, ethers.constants.AddressZero)); // Allows bonding contract to deposit reserves.
    console.log("Setup -- treasury.enable(0):  bonding contractor enabled to deposit reserves to treasury");

    // Step 2: Set DAO Wallet as treasury depositor
    await waitFor(treasuryV2.enable(0, daoMultisig, ethers.constants.AddressZero));
    console.log("Setup -- treasury.enable(0):  DAO wallet enabled to deposit reserves to treasury");

    // Step 3: Add USDC as reserve token for treasury
    //await waitFor(treasury.enable(1, USDC, ethers.constants.AddressZero, ethers.constants.AddressZero)); // Allows USDC to be declared as reserve token.
    //console.log("Setup -- treasury.enable(1): USDC enabled as reserve token for treasury");

    // Step 4: Set bonding contract as LP depositor to treasury
    await waitFor(treasuryV2.enable(3, bondDepo.address, ethers.constants.AddressZero)); // Allows bonding contract to deposit LP reserves.
    console.log("Setup -- treasury.enable(3):  bonding contractor enabled to deposit LP reserves to treasury");

    // Step 5: Add LP token as reserve token for treasury
    await waitFor(treasuryV2.enable(4, lpTokenAddress, supplyControllerDeployment.address)); // Allows LP token to be declared as reserve token.
    console.log("Setup -- treasury.enable(4):  LP token enabled as reserve token for treasury");

    // Step 6: Set distributor and Bond Depo as minter on treasury
    await waitFor(treasuryV2.enable(6, distributorV2.address, ethers.constants.AddressZero)); // Allows distributor to mint Pana.
    await waitFor(treasuryV2.enable(6, bondDepo.address, ethers.constants.AddressZero)); // Allows bond Depo to mint Pana.
    console.log("Setup -- treasury.enable(6):  distributor and bondDepo enabled to mint PANA on treasury");

    // Step 7: Add sPana address
    await waitFor(treasuryV2.enable(7, sPana.address, ethers.constants.AddressZero)); // Adds sPana address.
    console.log("Setup -- treasury.enable(7):  sPana address configured for treasury");

    // Step 7.1: Set distributor on staking
    await waitFor(staking.setDistributor(distributorV2.address));
    console.log("Setup -- staking.setDistributor:  distributorV2 set on staking");

    // Step 7.2: Initialize treasury
    await waitFor(treasuryV2.setTreasuryPanaUsageFlag(true));
    console.log("Setup -- treasury setTreasuryPanaUsageFlag");

    // Step 8: Initialize treasury
    await waitFor(treasuryV2.initialize());
    console.log("Setup -- treasury initialized");

    // Step 9: Set up distributor with bounty and recipient
    await waitFor(distributorV2.addRecipient(staking.address, INITIAL_REWARD_RATE, FIXED_APY));
    console.log("Setup -- distributor.addRecipient");
    

    // Step 10: Set distributor on staking
    await waitFor(staking.setDistributor(distributorV2.address));
    console.log("Setup -- staking.setDistributor:  distributor set on staking");

    // Step 11: Remove old bond depositor on staking
    await waitFor(staking.removeApprovedDepositor("0xB140D19b4946c96666A2EaF1e79D9F9BdF1D317e"));
    console.log("Setup -- staking.removeApprovedDepositor: remove old bond depositor on staking");

    // Step 12: Set bond depositor on staking
    await waitFor(staking.addApprovedDepositor(bondDepo.address));
    console.log("Setup -- staking.setBondDepositor: depositor set on staking");
    
    // Step 13: Set 30% Treasury Rewards on each Bond Issue
    await waitFor(bondDepo.setRewards(0, "3000"));
    console.log("Setup -- bondDepo.setRewards: set Treasury rewards");

    // Step 14: Set price oracle for bond depo
    await bondDepo.setPriceOracle(oracleDeployment.address);
    console.log("Setup -- Price Oracle Contract Address Set on Bond Depo");

    // Step 15: Set treasury v2 as vault on authority
    await waitFor(authorityContract.pushVault(treasuryV2.address, true));
    console.log("Setup -- authorityContract.pushVault: set vault on authority");

    // Step 16: Initialize new treasury to migrator
    await waitFor(treasuryMigrator.migrateContracts(treasuryV2.address));
    console.log("Setup --update new treasury to migrator");

    // Step 17: migrate LP token to new Treasury
    await waitFor(treasuryMigrator.migrateToken(lpTokenAddress));
    console.log("Setup --migrate lp from old to new treasury");

    // Step 18: migrate Pana token to new Treasury
    await waitFor(treasuryMigrator.migrateToken(pana.address));
    console.log("Setup --migrate pana from old to new treasury");


    
};

func.tags = ["treasuryV2-setup-config"];
func.dependencies = [CONTRACTS.pana, CONTRACTS.sPana, CONTRACTS.karsha];

export default func;
