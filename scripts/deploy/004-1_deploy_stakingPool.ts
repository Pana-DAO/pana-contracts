import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const panaDeployment = await deployments.get(CONTRACTS.pana);

    const panaPerSeconds = 18;

    let currentTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    const startTime = currentTimeStamp;
    const endTime = currentTimeStamp + 31536000 // in seconds, +1 year from start time

    await deploy(CONTRACTS.stakingPools, {
        from: deployer,
        args: [panaDeployment.address, 
            ethers.utils.parseUnits(panaPerSeconds.toString(), 18), 
            startTime, 
            endTime, 
            authorityDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.stakingPools, "launch"];
func.dependencies = [CONTRACTS.authority, CONTRACTS.pana];
export default func;
