import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { CONTRACTS, EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER } from "./constants";
const { BigNumber } = ethers;
import {
    PanaStaking__factory
} from "../types";


async function main() {
    
    /* SET THIS PARAMS TO RUN SCRIPT */
    const FIRST_EPOCH_TIME = 28800; //secs from now, after which first rebase will start.

    const { daoMultisig } = await getNamedAccounts();
    
    const stakingDeployment = await deployments.get(CONTRACTS.staking);
    const dao = await ethers.getSigner(daoMultisig);

    let staking = PanaStaking__factory.connect(stakingDeployment.address, dao);

    console.log("Staking Contract Address - " + stakingDeployment.address);
    
    // This is not going to work node env. will give diff timestamp, so pass it exclusively while calling it
    let currentTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    let firstEpochTimeStamp = currentTimeStamp + FIRST_EPOCH_TIME;
    let tx = await staking.setFirstEpoch(EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER, firstEpochTimeStamp);
    await tx.wait();

    console.log("Transaction - " + tx.hash);
    
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
