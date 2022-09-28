import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const sPanaDeployment = await deployments.get(CONTRACTS.sPana);
    const authorityDeployment = await deployments.get(CONTRACTS.authority);

    await deploy(CONTRACTS.karsha, {
        from: deployer,
        args: [deployer, sPanaDeployment.address, authorityDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.karsha, "core"];

export default func;
