import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const karshaDeployment = await deployments.get(CONTRACTS.karsha);
    const stakingDeployment = await deployments.get(CONTRACTS.staking);
    const treasuryV2Deployment = await deployments.get(CONTRACTS.treasuryV2);

    await deploy(CONTRACTS.bondDepo, {
        from: deployer,
        args: [
            authorityDeployment.address,
            panaDeployment.address,
            karshaDeployment.address,
            stakingDeployment.address,
            treasuryV2Deployment.address
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.bondDepo, "treasuryv2migration"];
func.dependencies = [
    CONTRACTS.authority,
    CONTRACTS.pana,
    CONTRACTS.karsha,
    CONTRACTS.treasuryV2
];

export default func;