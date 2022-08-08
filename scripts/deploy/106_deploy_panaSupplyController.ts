import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, getDEXRouterAddress, getPANAUSDCLPToken } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, getChainId } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const pairContractAddress = getPANAUSDCLPToken(chainId);
    
    const uniswapRouter = getDEXRouterAddress(chainId);

    await deploy(CONTRACTS.PanaSupplyController, {
        from: deployer,
        args: [
            panaDeployment.address,
            pairContractAddress,
            uniswapRouter,
            treasuryDeployment.address,
            authorityDeployment.address
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.PanaSupplyController];
func.dependencies = [
    CONTRACTS.authority,
    CONTRACTS.pana,
    CONTRACTS.treasury
];

export default func;
