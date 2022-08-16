import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getChainId } from "hardhat";
import { CONTRACTS, getUSDCAddress } from "../constants";
import { MultisigHelper } from "./multisigHelper";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main() {

    /* SET THIS PARAMS TO RUN SCRIPT */
    const USDC_TO_DEPOSIT = 20; // NOTE: Minting of Pana will be 1 USDC - 1 Pana.
    const usdcAddress = getUSDCAddress(await getChainId());
    
    const { daoMultisig } = await getNamedAccounts();
    
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    
    console.log("USDC Contract: ", usdcAddress);
    console.log("Treasury Contract: ", treasuryDeployment.address);

    let usdcValue = ethers.utils.parseUnits(USDC_TO_DEPOSIT.toString(), 6);

    
    const ABI = (await ethers.getContractFactory(CONTRACTS.USDC)).interface.fragments;

    const multisigHelper = new MultisigHelper(daoMultisig, await getChainId(), process.env.PRIVATE_KEY?.toString());

    await multisigHelper.executeTransaction(ABI, usdcAddress, "approve", [treasuryDeployment.address, usdcValue]);
    
    console.log("Transaction Executed Successfully, Please get it approved on Gnosis Safe");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
