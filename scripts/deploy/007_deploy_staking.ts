import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import {
    CONTRACTS,
    EPOCH_LENGTH_IN_BLOCKS,
    FIRST_EPOCH_TIME,
    FIRST_EPOCH_NUMBER,
} from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const sPanaDeployment = await deployments.get(CONTRACTS.sPana);
    const karshaDeployment = await deployments.get(CONTRACTS.karsha);
    //let first_epoch_time = parseInt((new Date().getTime() / 1000).toString()) + 28800;

    await deploy(CONTRACTS.staking, {
        from: deployer,
        args: [
            panaDeployment.address,
            sPanaDeployment.address,
            karshaDeployment.address,
            authorityDeployment.address,
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.staking, "staking", "core"];
func.dependencies = [CONTRACTS.pana, CONTRACTS.sPana, CONTRACTS.karsha];

export default func;
