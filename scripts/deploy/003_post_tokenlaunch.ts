import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitFor } from "../txHelper";
import { CONTRACTS } from "../constants";
import {
    PanaAuthority__factory
} from "../../types";

// TODO: Shouldn't run setup methods if the contracts weren't redeployed.
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer, daoMultisig, daoPolicy } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const authorityDeployment = await deployments.get(CONTRACTS.authority);

    const authorityContract = await PanaAuthority__factory.connect(
        authorityDeployment.address,
        signer
    );

    await waitFor(authorityContract.pushPolicy(daoPolicy, true));
    console.log("Token Launch Setup -- authorityContract.pushPolicy: set policy owner on authority");
    
    await waitFor(authorityContract.pushVault(daoMultisig, true));
    console.log("Token Launch Setup -- authorityContract.pushVault: set vault on authority");

    await waitFor(authorityContract.pushGuardian(daoMultisig, true));
    console.log("Token Launch Setup -- authorityContract.pushGuardian: set guardian on authority");

    await waitFor(authorityContract.pushDistributionVault(daoMultisig, true));
    console.log("Token Launch Setup -- authorityContract.pushDistributionVault: set dist vault as staking pools contract on authority");

    await waitFor(authorityContract.pushPanaGovernor(daoMultisig, true));
    console.log("Token Launch Setup -- authorityContract.pushPanaGovernor: set governor on authority");
};

func.tags = ["tokenlaunch"];

export default func;
