import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, DAI_ADDRESS, getDEXFactoryAddress} from "../constants";
import {
PanaSlidingWindowOracle__factory
} from "../../types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, getChainId } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const chainId = await getChainId();
    const uniswapFactory = getDEXFactoryAddress(chainId);

    const windowSize = 86400;
    const granuality = 24;

    await deploy(CONTRACTS.slidingWindowOracle, {
        from: deployer,
        args: [uniswapFactory, windowSize, granuality],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.slidingWindowOracle, "misc"];
export default func;
