import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { CONTRACTS } from "./constants";
const { BigNumber } = ethers;
import {
    PanaStaking__factory,
    PanaTreasury__factory,
    USDC__factory
} from "../types";

const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");


async function main() {
    
    /* SET THIS PARAMS TO RUN SCRIPT */
    const USDC_TO_DEPOSIT = 20;
    
    const { daoMultisig } = await getNamedAccounts();


    const usdcDeployment = await deployments.get(CONTRACTS.USDC);
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const dao = await ethers.getSigner(daoMultisig);

    let usdc = USDC__factory.connect(usdcDeployment.address, dao);
    let treasury = PanaTreasury__factory.connect(treasuryDeployment.address, dao);

    console.log("USDC Address - " + usdcDeployment.address);
    console.log("Treasury Address - " + treasuryDeployment.address);

    let usdcValue = ethers.utils.parseUnits(USDC_TO_DEPOSIT.toString(), 18);

    //Setting profit such way that, 1 Pana minted for 1 USDC, rest goes to excess reserve
    let profit = ethers.utils.parseUnits(((USDC_TO_DEPOSIT * 100) - USDC_TO_DEPOSIT).toString(), 18);

    console.log("USDC Deposited - " + USDC_TO_DEPOSIT);

    await usdc.approve(treasuryDeployment.address, usdcValue);
    let tx = await treasury.deposit(usdcValue, usdcDeployment.address, profit);

    console.log("Transaction - " + tx.hash);

    console.log("Treasury: Total Reserves - " + ethers.utils.formatUnits(await treasury.totalReserves(), 18));
    console.log("Treasury: Excess Reserves - " + ethers.utils.formatUnits(await treasury.excessReserves(), 18));

    // let first_epoch_time = parseInt((new Date().getTime() / 1000).toString()) + 28800;
    // await staking.setFirstEpoch(EPOCH_LENGTH_IN_BLOCKS, FIRST_EPOCH_NUMBER, )

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
