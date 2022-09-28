import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, getDEXFactoryAddress} from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, getChainId } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const chainId = await getChainId();
    const uniswapFactory = getDEXFactoryAddress(chainId);

    await deploy(CONTRACTS.priceOracle, {
        from: deployer,
        args: [uniswapFactory],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.priceOracle, "core"];
export default func;
