import * as fs from "fs";
import * as path from "path";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { CONTRACTS } from "./constants";
import  csv from 'csvtojson'

import {
    PPanaRedeem__factory,
    PPanaERC20__factory
} from "../types";

async function main() {
    
    const csvFilePath = path.resolve(__dirname, 'pPanaHoldersInfo.csv');

    const users = await csv().fromFile(csvFilePath);
    //console.log(users);

    const pPanaDeployment = await deployments.get(CONTRACTS.pPana);
    const pPanaRedeemDeployment = await deployments.get(CONTRACTS.pPanaRedeem);

    const { daoMultisig } = await getNamedAccounts();
    const dao = await ethers.getSigner(daoMultisig);

    let pPanaRedeem = await PPanaRedeem__factory.connect(pPanaRedeemDeployment.address, dao);
    let pPana = await PPanaERC20__factory.connect(pPanaDeployment.address, dao);

    for (let i = 0; i < users.length; i++) {        
        const user = users[i];
        console.log("Start processing record for", user.address);
        user.idoParticipant = user.idoParticipant.toLowerCase();
        user.approvedSeller = user.approvedSeller.toLowerCase();

        // Validate record.
        let validRecord:boolean = true;
        if(!user.hasOwnProperty('address') || !user.hasOwnProperty('idoParticipant') || !user.hasOwnProperty('pPanaTokenCount') ||
                !user.hasOwnProperty('lockDurationInSeconds') || !user.hasOwnProperty('approvedSeller') || !user.hasOwnProperty('vestingRate')){
           validRecord = false
           console.log("Invalid record check#:", 1);
        }
        if((user.idoParticipant != 'true' && user.idoParticipant != 'false') ||
                (user.approvedSeller != 'true' && user.approvedSeller != 'false')){
            validRecord = false;
            console.log("Invalid record check#:", 2)
        }
        if(isNaN(Number(user.pPanaTokenCount)) || isNaN(Number(user.lockDurationInSeconds))) {
            validRecord = false
            console.log("Invalid record check#:", 3)
        }
        if( !JSON.parse(user.idoParticipant) && isNaN(Number(user.vestingRate))){
            validRecord = false;
            console.log("Invalid record check#:", 4)
        }
        if(!validRecord) {
            console.log("Invalid record at row:", (i+1))
            continue;
        }

        //Transfer pPana
        let tx =  await pPana.transfer(user.address, ethers.utils.parseUnits( user.pPanaTokenCount, "ether" ));
        let receipt = await tx.wait();
        if(receipt==null || receipt.status == 0){
            console.log("Error processing record for", user.address);
            console.log("Error Transfer Transaction - " + tx.hash);
        } else {
            console.log("Transfer Transaction - " + tx.hash);
        }

        // Set ApprovedSeller 
        if(JSON.parse(user.approvedSeller)){
            let tx = await pPana.addApprovedSeller(user.address); 
            let receipt = await tx.wait();
            if(receipt==null || receipt.status == 0){
                console.log("Error processing record for", user.address);
                console.log("Error set approved seller Transaction - " + tx.hash);
            } else {
                console.log("set approved seller Transaction - " + tx.hash);
            }
        }

        // set redeem terms
        if(JSON.parse(user.idoParticipant)) {
            let tx = await pPanaRedeem.setLaunchParticipantTerms(user.address, user.lockDurationInSeconds);
            let receipt = await tx.wait();
            if(receipt==null || receipt.status == 0){
                console.log("Error processing record for", user.address);
                console.log("Error set IDO participant redeem terms Transaction - " + tx.hash);
            } else {
                console.log("set IDO participant redeem terms Transaction - " + tx.hash);
            }
        } else {
            let tx = await pPanaRedeem.setTerms(user.address, ethers.utils.parseUnits( user.pPanaTokenCount, "ether" ),
            user.vestingRate, user.lockDurationInSeconds);
            let receipt = await tx.wait();
            if(receipt==null || receipt.status == 0){
                console.log("Error processing record for", user.address);
                console.log("Error set team redeem terms Transaction - " + tx.hash);
            } else {
                console.log("set team redeem terms Transaction - " + tx.hash);
            }
        }
        
        let balance = await pPana.balanceOf(user.address);
        console.log(balance);
        console.log("============================");
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
