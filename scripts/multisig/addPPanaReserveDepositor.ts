import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getChainId } from "hardhat";
import { CONTRACTS } from "../constants";
import { MultisigHelper } from "./multisigHelper";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main() {


    /* 
        deployer is default to 0th position in hardhat config, so anyone executing a multisig transaction, 
        having its private key placed in .env file will be picked first at zeroth position, so deployer is executor in this case
    */
    const { deployer, daoMultisig } = await getNamedAccounts();
    
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const pPanaRedeemDeployment = await deployments.get(CONTRACTS.pPanaRedeem);
    
    const ABI = (await ethers.getContractFactory(CONTRACTS.treasury)).interface.fragments;
    const multisigHelper = new MultisigHelper(daoMultisig, await getChainId(), process.env.PRIVATE_KEY?.toString());

    await multisigHelper.executeTransaction(ABI, treasuryDeployment.address, "queueTimelock", [0, pPanaRedeemDeployment.address, ethers.constants.AddressZero, ethers.constants.AddressZero]);
    
    console.log("Transaction Executed Successfully, Please get it approved on Gnosis Safe");

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
