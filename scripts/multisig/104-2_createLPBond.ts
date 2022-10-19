import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getChainId } from "hardhat";
import { CONTRACTS, getPANAUSDCLPToken } from "../constants";
import { MultisigHelper } from "./multisigHelper";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main() {

    /* SET THIS PARAMS TO RUN SCRIPT */
    const CAPACITY = 1500000; // Pana
    const PRICE = '47395154984';
    const DEBT_BUFFER = 100000; // 100%
    const CAPACITY_IN_QUOTE = false;
    const QUOTE_IS_RESERVED = true;
    const FIXED_TERM = true;
    const VESTING_TERM = 432000; // 5 Days
    const CONCULSION_LENTH = 2592000; // 30 days
    const DEPOSIT_INTERVAL = 86400; // 1 day
    const TUNE_INTERVAL = 86400; // 1 day

    const QUOTE_IS_LP = true;
    let tokenAddress = getPANAUSDCLPToken((await ethers.provider.getNetwork()).chainId.toString());;

    if (tokenAddress === '') {
        console.error("\x1b[31m", 'Please provide LP token address');
        return;
    }
    /* 
        deployer is default to 0th position in hardhat config, so anyone executing a multisig transaction, 
        having its private key placed in .env file will be picked first at zeroth position, so deployer is executor in this case
    */
    const { daoPolicy } = await getNamedAccounts();
    
    const bondDepoDeployment = await deployments.get(CONTRACTS.bondDepo);


    let capacity = ethers.utils.parseUnits(CAPACITY.toString(), 18);
    let price = PRICE; //ethers.utils.parseUnits(PRICE.toString(), 18);
    let currentTimeStamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    let conclusion = currentTimeStamp + CONCULSION_LENTH;
    console.log(conclusion);
    
    
    const ABI = (await ethers.getContractFactory(CONTRACTS.bondDepo)).interface.fragments;
    const multisigHelper = new MultisigHelper(daoPolicy, await getChainId(), process.env.PRIVATE_KEY?.toString());

    await multisigHelper.executeTransaction(ABI, bondDepoDeployment.address, "create", 
    [
        tokenAddress, 
        [capacity, price, DEBT_BUFFER],
        [CAPACITY_IN_QUOTE, QUOTE_IS_RESERVED, QUOTE_IS_LP, FIXED_TERM],
        [VESTING_TERM , conclusion],
        [DEPOSIT_INTERVAL, TUNE_INTERVAL]
    ]);
    
    console.log("Transaction Executed Successfully, Please get it approved on Gnosis Safe");
    
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
