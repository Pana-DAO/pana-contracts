import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { CONTRACTS, DAI_ADDRESS, EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER, getDAIAddress, getPANADAILPToken } from "./constants";
const { BigNumber } = ethers;
import {
    PanaBondDepository__factory
} from "../types";


async function main() {
    
    /* SET THIS PARAMS TO RUN SCRIPT */
    const CAPACITY = 200000; // Pana
    const PRICE = 0.065;
    const DEBT_BUFFER = 100000; // 100%
    const CAPACITY_IN_QUOTE = false;
    const QUOTE_IS_RESERVED = true;
    const FIXED_TERM = true;
    const VESTING_TERM = 86400; // 1 Day
    const CONCULSION_LENTH = 1728000; // 20 days
    const DEPOSIT_INTERVAL = 21600; // 6 hrs
    const TUNE_INTERVAL = 86400; // 1 day

    const QUOTE_IS_LP = true;
    let tokenAddress = getPANADAILPToken((await ethers.provider.getNetwork()).chainId.toString());

    // ====== IF NAKED (DAI) BOND THEN UNCOMMENT THIS
    // const QUOTE_IS_LP = false;
    // let tokenAddress = getDAIAddress((await ethers.provider.getNetwork()).chainId.toString());

    const { daoMultisig } = await getNamedAccounts();
    
    const bondDepoDeployment = await deployments.get(CONTRACTS.bondDepo);
    const dao = await ethers.getSigner(daoMultisig);

    let bondDepository = PanaBondDepository__factory.connect(bondDepoDeployment.address, dao);

    console.log("Bond Depository Contract Address - " + bondDepoDeployment.address);

    let capacity = ethers.utils.parseUnits(CAPACITY.toString(), 18);
    let price = ethers.utils.parseUnits(PRICE.toString(), 18);
    let currentTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    let conclusion = currentTimeStamp + CONCULSION_LENTH;
    console.log(conclusion);
    
    let tx = await bondDepository.create(tokenAddress, 
        [capacity, price, DEBT_BUFFER],
        [CAPACITY_IN_QUOTE, QUOTE_IS_RESERVED, QUOTE_IS_LP, FIXED_TERM],
        [VESTING_TERM , conclusion],
        [DEPOSIT_INTERVAL, TUNE_INTERVAL]); 
    await tx.wait();
    
    console.log("Transaction - " + tx.hash);
    
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
