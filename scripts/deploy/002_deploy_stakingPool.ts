import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, daoMultisig } = await getNamedAccounts();
    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const panaDeployment = await deployments.get(CONTRACTS.pana);

    const panaPerSeconds = 0.5787037037037;

    //let currentTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    const startTime = 1660579200; //15th Aug, 2022, 4 PM GMT (12 pm EST)
    const endTime = 1665849600; //15th Oct, 2022, 4 PM GMT (12 pm EST)

    await deploy(CONTRACTS.stakingPools, {
        from: deployer,
        args: [panaDeployment.address,
            daoMultisig,
            ethers.utils.parseUnits(panaPerSeconds.toString(), 18), 
            startTime, 
            endTime, 
            authorityDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.stakingPools, "tokenlaunch"];
func.dependencies = [CONTRACTS.authority, CONTRACTS.pana];
export default func;
