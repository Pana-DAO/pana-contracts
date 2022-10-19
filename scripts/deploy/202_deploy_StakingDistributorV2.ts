import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const treasuryV2Deployment = await deployments.get(CONTRACTS.treasuryV2);
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const stakingDeployment = await deployments.get(CONTRACTS.staking);
    const authorityDeployment = await deployments.get(CONTRACTS.authority);

    // TODO: firstEpochBlock is passed in but contract constructor param is called _nextEpochBlock
    await deploy(CONTRACTS.distributorV2, {
        from: deployer,
        args: [
            treasuryV2Deployment.address,
            panaDeployment.address,
            stakingDeployment.address,
            authorityDeployment.address,
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.distributorV2, "treasuryv2migration"];
func.dependencies = [
    CONTRACTS.treasuryV2,
    CONTRACTS.pana,
    CONTRACTS.authority,
];

export default func;
