import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import {
PPanaUpgradeableERC20__factory
} from "../../types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { upgrades, getNamedAccounts, ethers, deployments } = hre;
    const { deploy } = deployments;
    const { deployProxy } = upgrades;
    const { deployer, daoMultisig } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    await deploy( CONTRACTS.pPana, {
        contract: CONTRACTS.pPanaUpgradeable,
        from: deployer,
        proxy: {
          owner: daoMultisig,
          proxyContract: 'OpenZeppelinTransparentProxy',
          execute: {
            init: {
              methodName: 'initialize',
              args: [daoMultisig],
            }
          }
        },
        log: true,
    });

    //let pPana = await deployProxy(new PPanaUpgradeableERC20__factory(signer), [daoMultisig], {initializer: 'initialize'});
    //let pPanaDeployed = await pPana.deployed();
    //console.log(CONTRACTS.pPana + " deployed at " + pPanaDeployed.address);

};

func.tags = [CONTRACTS.pPana, "misc"];

export default func;
