import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { CONTRACTS, EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER } from "./constants";
const { BigNumber } = ethers;
import {
    PanaBondDepository__factory
} from "../types";


async function main() {

    const { daoMultisig } = await getNamedAccounts();
    
    const bondDepoDeployment = await deployments.get(CONTRACTS.bondDepo);
    const oracleDeployment = await deployments.get(CONTRACTS.slidingWindowOracle);
    const dao = await ethers.getSigner(daoMultisig);

    let bondDepo = PanaBondDepository__factory.connect(bondDepoDeployment.address, dao);

    console.log("Bond Depository Contract Address - " + bondDepoDeployment.address);
    console.log("Price Oracle Contract Address - " + oracleDeployment.address);
    
    let tx = await bondDepo.setPriceOracle(oracleDeployment.address);
    await tx.wait();

    console.log("Transaction - " + tx.hash);
    
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
