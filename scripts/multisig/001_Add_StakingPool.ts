import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getChainId } from "hardhat";
import { CONTRACTS, STAKING_POOLS } from "../constants";
import { MultisigHelper } from "./multisigHelper";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main() {
    let index: number;

    
    /* SET THIS PARAMS TO RUN SCRIPT */
    index = -1;
    
    if (index < 0) {
        console.error('please provide correct inputs');
        return;
    }

    const ALLOCATION_POINT = STAKING_POOLS[index].allocationPoint;
    const TOKEN: string = STAKING_POOLS[index].tokenAddress;
    
    const { daoMultisig } = await getNamedAccounts();
    
    const stakingPoolsDeployment = await deployments.get(CONTRACTS.stakingPools);
    
    console.log("Staking Pools Contract: ", stakingPoolsDeployment.address);

    const ABI = (await ethers.getContractFactory(CONTRACTS.stakingPools)).interface.fragments;

    const multisigHelper = new MultisigHelper(daoMultisig, await getChainId(), process.env.PRIVATE_KEY?.toString());

    await multisigHelper.executeTransaction(ABI, stakingPoolsDeployment.address, "add", [ALLOCATION_POINT, TOKEN]);
    
    console.log("Transaction Executed Successfully, Please get it approved on Gnosis Safe");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
