import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, getUSDCAddress} from "../constants";
import {
PPanaRedeem__factory
} from "../../types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, getChainId } = hre;
    const { deploy } = deployments;
    const { deployer, daoMultisig } = await getNamedAccounts();

    const chainId = await getChainId();
    const USDC = getUSDCAddress(chainId);

    const pPanaDeployment = await deployments.get(CONTRACTS.pPana);
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);

    await deploy(CONTRACTS.pPanaRedeem, {
        from: deployer,
        args: [pPanaDeployment.address, panaDeployment.address,
            USDC, treasuryDeployment.address, daoMultisig],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.pPanaRedeem, "misc"];
func.dependencies = [CONTRACTS.pana, CONTRACTS.treasury];
export default func;
