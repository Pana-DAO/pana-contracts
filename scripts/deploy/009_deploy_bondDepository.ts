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
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);

    await deploy(CONTRACTS.bondDepo, {
        from: deployer,
        args: [
            authorityDeployment.address,
            panaDeployment.address,
            karshaDeployment.address,
            stakingDeployment.address,
            treasuryDeployment.address
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.bondDepo, "bonding", "core"];
func.dependencies = [
    CONTRACTS.authority,
    CONTRACTS.pana,
    CONTRACTS.karsha,
    CONTRACTS.treasury
];

export default func;