import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getChainId } from "hardhat";
import { CONTRACTS, getPANAUSDCLPToken } from "../constants";
import { MultisigHelper } from "./multisigHelper";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main() {

    // Address of the LP token
    let tokenAddress = getPANAUSDCLPToken((await ethers.provider.getNetwork()).chainId.toString());

    /* 
        deployer is default to 0th position in hardhat config, so anyone executing a multisig transaction, 
        having its private key placed in .env file will be picked first at zeroth position, so deployer is executor in this case
    */
    const { daoMultisig } = await getNamedAccounts();
    
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const bondCalcDeployment = await deployments.get(CONTRACTS.bondingCalculator);
    const PanaSupplyControllerDeployment = await deployments.get(CONTRACTS.PanaSupplyController);

    console.log("Treasury Contract: ", treasuryDeployment.address);
    
    const ABI = (await ethers.getContractFactory(CONTRACTS.treasury)).interface.fragments;

    const multisigHelper = new MultisigHelper(daoMultisig, await getChainId(), process.env.PRIVATE_KEY?.toString());

    await multisigHelper.executeTransaction(ABI, treasuryDeployment.address, "queueTimelock", [5, tokenAddress, bondCalcDeployment.address, PanaSupplyControllerDeployment.address]);
    
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
