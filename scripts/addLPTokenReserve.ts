import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { CONTRACTS, DAI_ADDRESS, EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER, getDAIAddress, getPANADAILPToken } from "./constants";
const { BigNumber } = ethers;
import {
    PanaTreasury__factory
} from "../types";


async function main() {
    
    // Address of the LP token
    let tokenAddress = getPANADAILPToken((await ethers.provider.getNetwork()).chainId.toString());

    const { daoMultisig } = await getNamedAccounts();
    
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const bondCalcDeployment = await deployments.get(CONTRACTS.bondingCalculator);
    const PanaSupplyControllerDeployment = await deployments.get(CONTRACTS.PanaSupplyController);
    const dao = await ethers.getSigner(daoMultisig);

    let treasury = PanaTreasury__factory.connect(treasuryDeployment.address, dao);

    console.log("Treasury Contract Address - " + treasuryDeployment.address);
    
    let tx = await treasury.queueTimelock(5, tokenAddress, bondCalcDeployment.address, PanaSupplyControllerDeployment.address);
    await tx.wait();
    console.log("Transaction queueTimelock - " + tx.hash);


    /** ===================== 
     * NOTE: we need to execute "execute" method of treasury with proper index to set LP as token post above script 
     * =====================
     * */
    
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
