import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer, daoMultisig } = await getNamedAccounts();

    await deploy(CONTRACTS.authority, {
        from: deployer,
        args: [deployer, deployer, deployer, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.authority, "migration", "staking", "core"];

export default func;
