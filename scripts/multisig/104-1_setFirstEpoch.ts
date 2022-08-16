import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getChainId } from "hardhat";
import { CONTRACTS, EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER } from "../constants";
import { MultisigHelper } from "./multisigHelper";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main() {

    /* SET THIS PARAMS TO RUN SCRIPT */
    const FIRST_EPOCH_TIME = 28800; //secs from now, after which first rebase will start.
    
    const { daoMultisig } = await getNamedAccounts();
    
    const stakingDeployment = await deployments.get(CONTRACTS.staking);

    console.log("Staking Contract: ", stakingDeployment.address);

    const ABI = (await ethers.getContractFactory(CONTRACTS.staking)).interface.fragments;

    const multisigHelper = new MultisigHelper(daoMultisig, await getChainId(), process.env.PRIVATE_KEY?.toString());
    
    let currentTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    let firstEpochTimeStamp = currentTimeStamp + FIRST_EPOCH_TIME;
    await multisigHelper.executeTransaction(ABI, stakingDeployment.address, "setFirstEpoch", [EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER, firstEpochTimeStamp]);
    
    console.log("Transaction Executed Successfully, Please get it approved on Gnosis Safe");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
