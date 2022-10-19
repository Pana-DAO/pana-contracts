import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitFor } from "../txHelper";
import { CONTRACTS } from "../constants";
import {
    PanaTreasury__factory,
    TreasuryMigrator__factory
} from "../../types";

// TODO: Shouldn't run setup methods if the contracts weren't redeployed.
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);


    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const treasuryMigratorDeployment = await deployments.get(CONTRACTS.treasuryMigrator);


    const treasury = PanaTreasury__factory.connect(treasuryDeployment.address, signer);
    const treasuryMigrator = TreasuryMigrator__factory.connect(treasuryMigratorDeployment.address, signer);

    // Step 1: Set up migrator as LP manager - for migrating LPs
    await waitFor(treasury.queueTimelock(5, treasuryMigrator.address, ethers.constants.AddressZero));
    console.log("Setup -- treasury.queueTimelock(5):  Treasury Migrator as LP Manager");

    // Step 1.1
    await waitFor(treasury.execute(0));

    // Step 2: Set up migrator as Reserver manager - for migrating Pana
    await waitFor(treasury.queueTimelock(2, treasuryMigrator.address, ethers.constants.AddressZero));
    console.log("Setup -- treasury.queueTimelock(2):  Treasury Migrator as Reserve Manager");

    // Step 2.1
    await waitFor(treasury.execute(1));


};

func.tags = ["treasuryV2-setup"];

export default func;
