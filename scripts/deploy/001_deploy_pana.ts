import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const authorityDeployment = await deployments.get(CONTRACTS.authority);

    await deploy(CONTRACTS.pana, {
        from: deployer,
        args: [authorityDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.pana, "tokenlaunch"];
func.dependencies = [CONTRACTS.authority];
export default func;
