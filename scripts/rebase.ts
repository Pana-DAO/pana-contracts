import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { CONTRACTS, EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER } from "./constants";
const { BigNumber } = ethers;
import {
    PanaStaking__factory
} from "../types";


async function main() {
    

    const { daoMultisig } = await getNamedAccounts();
    
    //const stakingDeployment = await deployments.get(CONTRACTS.staking);
    const dao = await ethers.getSigner(daoMultisig);

    const STAKING = await ethers.getContractFactory(CONTRACTS.staking);
    let staking = await STAKING.attach("0x77263B0149433080Ba8FDeeEa0d3D802a3F24FC9");
    // let staking = PanaStaking__factory.connect("", dao);

    console.log("Staking Contract Address - " + staking.address);
    
    let tx = await staking.rebase();
    await tx.wait();

    console.log("Transaction - " + tx.hash);    
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
