import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { CONTRACTS, EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER } from "./constants";
const { BigNumber } = ethers;
import {
    ProportionalSupplyController__factory
} from "../types";


async function main() {

    const LOSS_RATIO = 2250;
    const CF = 50;
    const CC = 50;
    const SAMPLING_TIME = 3600;
    
    const { daoMultisig } = await getNamedAccounts();
    
    const supplyControlDeployment = await deployments.get(CONTRACTS.proportionalSupplyController);
    const dao = await ethers.getSigner(daoMultisig);

    let supplyController = ProportionalSupplyController__factory.connect(supplyControlDeployment.address, dao);

    console.log("Supply Control Contract Address - " + supplyControlDeployment.address);

    const setupTx = await supplyController.setSupplyControlParams(
        LOSS_RATIO, CF, CC, SAMPLING_TIME
    );
    console.log("SupplyController - Set Params: " + setupTx.hash);

    const isSupplyControlEnabled = await supplyController.supplyControlEnabled();
    
    if (!isSupplyControlEnabled) {
        let tx = await supplyController.enableSupplyControl();
        await tx.wait();
        console.log("Transaction - " + tx.hash);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
