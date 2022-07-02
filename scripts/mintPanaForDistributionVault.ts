import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { CONTRACTS, EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER } from "./constants";
const { BigNumber } = ethers;
import {
    PanaERC20Token__factory
} from "../types";


async function main() {
    
    /* SET THIS PARAMS TO RUN SCRIPT */
    const PANA_TO_BE_MINTED = 1000; //secs from now, after which first rebase will start.

    const { daoMultisig } = await getNamedAccounts();
    
    const panaDeployment = await deployments.get(CONTRACTS.pana);
    const dao = await ethers.getSigner(daoMultisig);

    let pana = PanaERC20Token__factory.connect(panaDeployment.address, dao);

    console.log("Pana Token Contract Address - " + panaDeployment.address);

    const panaAmount = ethers.utils.parseUnits(PANA_TO_BE_MINTED.toString(), 18);
    
    let tx = await pana.mintForDistribution(panaAmount);
    await tx.wait();

    console.log("Transaction - " + tx.hash);
    
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
