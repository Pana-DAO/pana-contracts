import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, getDEXRouterAddress, getPANAUSDCLPToken, KP } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, getChainId } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const treasuryV2Deployment = await deployments.get(CONTRACTS.treasuryV2);
    const pairContractAddress = getPANAUSDCLPToken(chainId);
    
    const uniswapRouter = getDEXRouterAddress(chainId);

    await deploy(CONTRACTS.proportionalSupplyController, {
        from: deployer,
        args: [
            KP,
            panaDeployment.address,
            pairContractAddress,
            uniswapRouter,
            treasuryV2Deployment.address,
            authorityDeployment.address
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.proportionalSupplyController];
func.dependencies = [
    CONTRACTS.authority,
    CONTRACTS.pana,
    CONTRACTS.treasuryV2
];

export default func;
