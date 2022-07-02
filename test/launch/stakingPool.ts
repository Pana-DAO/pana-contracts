import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
    PanaERC20Token,
    PanaERC20Token__factory,
    PanaAuthority__factory,
    DAI,
    DAI__factory,
    PanaAuthority,
    StakingPools,
    StakingPools__factory,
    USDC,
    USDC__factory,

} from '../../types';

const LARGE_APPROVAL = "100000000000000000000000000000000";
let startTime : number;
let endTime : number;

const moveTimestamp = async(seconds:any) =>    {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
};
const bigNumberRepresentation = (number:any) => {
    return ethers.BigNumber.from(number.toString());
};
const decimalRepresentation = (value:any, decimals:number=18) => {
    return bigNumberRepresentation(value.toString()).mul(bigNumberRepresentation(10).pow(decimals));
};


describe("Pana Launch StakingPool contract", () => {
    // initializing variables
    let deployer: SignerWithAddress;
    let vault: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let distributionVault : SignerWithAddress;
    let pana: PanaERC20Token;
    let stakingPool : StakingPools;
    let dai : DAI;
    let usdc : USDC;
    let authority:PanaAuthority;
    let block: any;
    
    // contract deployment
    beforeEach(async () => {
        [deployer, vault, user1,user2, distributionVault] = await ethers.getSigners();
        
        block = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
        
        dai = await (new DAI__factory(deployer)).deploy(0);
        usdc = await (new USDC__factory(deployer)).deploy(0);
        
        authority = await (new PanaAuthority__factory(deployer))
            .deploy(deployer.address, deployer.address, deployer.address, vault.address, distributionVault.address);
        await authority.deployed();
        
        pana = await (new PanaERC20Token__factory(deployer)).deploy(authority.address);

        await usdc.mint(user1.address,decimalRepresentation("20000"));
        await dai.mint(user1.address,decimalRepresentation("20000"));
        await usdc.mint(user2.address,decimalRepresentation("10000"));
        
        startTime = parseInt(block.timestamp);
        endTime = startTime + 86400;
        stakingPool = await (new StakingPools__factory(deployer)).deploy(pana.address,
            decimalRepresentation(18), startTime, endTime, authority.address);
            
        await pana.connect(vault).mint(stakingPool.address, decimalRepresentation("500000"));
        await stakingPool.connect(deployer).add(100,usdc.address);
        await usdc.connect(user1).approve(stakingPool.address,LARGE_APPROVAL);
        await usdc.connect(user2).approve(stakingPool.address,LARGE_APPROVAL);
        await dai.connect(user1).approve(stakingPool.address,LARGE_APPROVAL);
        await dai.connect(user2).approve(stakingPool.address,LARGE_APPROVAL);

    });

    describe("initialization of stakingPool",async() => {
        it("should initialize staking liquidity pools",async() => {
            await stakingPool.connect(deployer).add(100,dai.address);
            let [poolAddress, allocPoint, lastRewardTime, accPanaPerShare] = await stakingPool.poolInfo(1);

            expect(dai.address).to.be.equal(poolAddress);
            expect(allocPoint).to.be.equal(100);
            expect(accPanaPerShare).to.be.equal(0);
        });

        it("should allow only governor to add Liquidity pool",async() => {
            await expect(stakingPool.connect(user1).add(100,dai.address)).to.be.revertedWith("UNAUTHORIZED");
        });

        it("should not allow to add duplicate pools",async() => {
            await expect(stakingPool.connect(deployer).add(100,usdc.address)).to.be.revertedWith("Pool already exists!");
        });

        it("should return correct length of pools",async() => {
            await stakingPool.connect(deployer).add(100,dai.address);
            expect(await stakingPool.poolLength()).to.be.equal(2);
        });

        it("should return correct allocation points",async() => {
            await stakingPool.connect(deployer).add(100,dai.address);
            expect(await stakingPool.totalAllocPoint()).to.be.equal(200);
        });

        // set functions
        it("should set correct start time",async() => {
            expect(await stakingPool.startTime()).to.be.equal(startTime);
            moveTimestamp(-1000);
            let newStartTime = parseInt(block.timestamp) + 1000;
            await stakingPool.setStartTime(newStartTime);
            expect(await stakingPool.startTime()).to.be.equal(newStartTime);
        });

        it("should set correct end time",async() => {
            expect(await stakingPool.endTime()).to.be.equal(endTime);
            let newEndTime = startTime + 172800; // 2 days
            await stakingPool.setEndTime(newEndTime);
            expect(await stakingPool.endTime()).to.be.equal(newEndTime);
        });

        it("should set correct pana per second",async() => {
            expect(await stakingPool.panaPerSecond()).to.be.equal(decimalRepresentation(18));
            await stakingPool.setPanaPerSecond(decimalRepresentation(50));
            expect(await stakingPool.panaPerSecond()).to.be.equal(decimalRepresentation(50));
        });

        it("should stake correct amount of tokens",async() => {
            let balanceBefore = await usdc.balanceOf(user1.address);
            let stakedBefore = await usdc.balanceOf(stakingPool.address);

            await stakingPool.connect(user1).deposit(0, decimalRepresentation("100"));
            let balanceAfter = await  usdc.balanceOf(user1.address);
            let stakedAfter = await usdc.balanceOf(stakingPool.address);


            expect(balanceAfter).to.be.equal(balanceBefore.sub(decimalRepresentation("100")));
            expect(stakedAfter).to.be.equal(stakedBefore.add(decimalRepresentation("100")));

        });
    });

    describe("distribution minting of pana",async() => {

        it("should mint pana for distribution",async() => {

            let panaBalanceBefore = await pana.balanceOf(distributionVault.address);
            await pana.connect(deployer).mintForDistribution(decimalRepresentation("5000"));
            let panaBalanceAfter = await pana.balanceOf(distributionVault.address);

            expect(Number(panaBalanceAfter)).to.be.equal(Number(panaBalanceBefore.add(decimalRepresentation("5000"))));

        });

        it("should mint pana for distribution only by governor",async() => {
            await expect(pana.connect(user1).mintForDistribution(decimalRepresentation("5000"))).to.be.revertedWith("UNAUTHORIZED");
        });

        it("should conclude minting pana for distribution ",async() => {
            expect(await pana.distributionConcluded()).to.be.equal(false);
            await pana.connect(deployer).concludeDistribution();
            expect(await pana.distributionConcluded()).to.be.equal(true);
        });

        it("should conclude minting pana for distribution only by governor",async() => {
            await expect(pana.connect(user1).concludeDistribution()).to.be.revertedWith("UNAUTHORIZED");
        });

        it("should not allow minting pana for distribution after it's concluded",async() => {
            await pana.connect(deployer).concludeDistribution();
            await expect(pana.connect(deployer).mintForDistribution(decimalRepresentation("5000"))).to.be.revertedWith("Distribution concluded");
        });

    });

    let panaPerSecond = decimalRepresentation("18");

    describe("StakingPool launch harvesting pana",async() => {
        beforeEach(async() => {
            await stakingPool.connect(user1).deposit(0, decimalRepresentation("1000"));
        });

        it("should return correct amount of pana",async() => {

            moveTimestamp(100); // moving 100 seconds
            await stakingPool.updatePool(0);
            let balanceAmount = await stakingPool.pendingPana(0,user1.address);
            let upperBound = panaPerSecond.mul(102); // checking with 102 seconds since time has passed from the point of calling function
            let lowerBound = panaPerSecond.mul(100);
            expect(Number(balanceAmount)).to.be.greaterThanOrEqual(Number(lowerBound));
            expect(Number(balanceAmount)).to.be.lessThanOrEqual(Number(upperBound));

        });

        it("should update balance after unstake of tokens",async() => {

            let balanceBeforeUser = await usdc.balanceOf(user1.address);
            let stakedBefore = await usdc.balanceOf(stakingPool.address);
            await stakingPool.connect(user1).withdraw(0, decimalRepresentation("100"));
            let balanceAfterUser = await usdc.balanceOf(user1.address);
            let stakedAfter = await usdc.balanceOf(stakingPool.address);

            expect(balanceAfterUser).to.be.equal(balanceBeforeUser.add(decimalRepresentation("100")));
            expect(stakedAfter).to.be.equal(stakedBefore.sub(decimalRepresentation("100")));

        });

        it("should return correct pending pana on stakingPool",async() => {

            let balanceBefore = await pana.balanceOf(user1.address);
            moveTimestamp(100); // moving 100 seconds
            await stakingPool.connect(user1).deposit(0, decimalRepresentation("100"));
            let upperBound = panaPerSecond.mul(102); // checking with 102 seconds since time has passed from the point of calling function
            let lowerBound = panaPerSecond.mul(100);
            let balanceAfter = await pana.balanceOf(user1.address);

            expect(Number(balanceAfter)).to.be.lessThanOrEqual(Number(balanceBefore.add(upperBound)));
            expect(Number(balanceAfter)).to.be.greaterThanOrEqual(Number(balanceBefore.add(lowerBound)));

        });

        it("should return correct pending pana on unstakingPool",async() => {

            let balanceBefore = await pana.balanceOf(user1.address);
            moveTimestamp(100); // moving 100 seconds
            await stakingPool.connect(user1).withdraw(0, decimalRepresentation("100"));
            let upperBound = panaPerSecond.mul(102); // checking with 102 seconds since time has passed from the point of calling function
            let lowerBound = panaPerSecond.mul(100);
            let balanceAfter = await pana.balanceOf(user1.address);

            expect(Number(balanceAfter)).to.be.lessThanOrEqual(Number(balanceBefore.add(upperBound)));
            expect(Number(balanceAfter)).to.be.greaterThanOrEqual(Number(balanceBefore.add(lowerBound)));
        });

        it("should return correct pana on harvesting",async() => {
            
            let balanceBefore = await pana.balanceOf(user1.address);
            moveTimestamp(100); // moving 100 seconds
            await stakingPool.connect(user1).harvestAll();
            let upperBound = panaPerSecond.mul(102); // checking with 102 seconds since time has passed from the point of calling function
            let lowerBound = panaPerSecond.mul(100);
            let balanceAfter = await pana.balanceOf(user1.address);

            expect(Number(balanceAfter)).to.be.lessThanOrEqual(Number(balanceBefore.add(upperBound)));
            expect(Number(balanceAfter)).to.be.greaterThanOrEqual(Number(balanceBefore.add(lowerBound)));

        });

    });

    describe("Increase/Decrease in reward on updation",async() => {
        beforeEach(async() => {
            await stakingPool.connect(deployer).add(300,dai.address); // to increase allocPoint by 400

        });

        it("should increase in reward with increase in allocation Point",async() => {
            await stakingPool.connect(user1).deposit(0, decimalRepresentation("100"));
            moveTimestamp(100);
            await stakingPool.set(0,300); // total allocation points 300+300 = 600
            moveTimestamp(100);
            await stakingPool.updatePool(0);
            // pana accumulated = Seconds * panaPerSecond * allocPoint / totalAllocPoint

            let pendingPana = await stakingPool.pendingPana(0,user1.address);

            let accumulatedPanaLowerBound = panaPerSecond.mul(101).mul(100).div(400);
            accumulatedPanaLowerBound = accumulatedPanaLowerBound.add(panaPerSecond.mul(101).mul(300).div(600));

            let accumulatedPanaUpperBound = panaPerSecond.mul(102).mul(100).div(400);
            accumulatedPanaUpperBound = accumulatedPanaUpperBound.add(panaPerSecond.mul(102).mul(300).div(600));

            expect(Number(pendingPana)).to.be.lessThanOrEqual(Number(accumulatedPanaUpperBound));
            expect(Number(pendingPana)).to.be.greaterThanOrEqual(Number(accumulatedPanaLowerBound));
        });

        it("should return correct reward pro-rata based on deposit",async() => {
            await stakingPool.connect(user1).deposit(0, decimalRepresentation("100"));
            await stakingPool.connect(user2).deposit(0, decimalRepresentation("300"));
            await moveTimestamp(100);
            await stakingPool.updatePool(0);

            let pendingPanaUser1 = await stakingPool.pendingPana(0,user1.address);
            let pendingPanaUser2 = await stakingPool.pendingPana(0,user2.address)
            let rewardForUser1 = panaPerSecond.mul(100).div(400).mul(decimalRepresentation("100")).div(decimalRepresentation("100")).mul(1);
            let rewardForUser1LowerBound = rewardForUser1.add(panaPerSecond.mul(100)
                .div(400).mul(decimalRepresentation("100")).div(decimalRepresentation("400")).mul(101));
            let rewardForUser1UpperBound = rewardForUser1.add(panaPerSecond.mul(100)
                .div(400).mul(decimalRepresentation("100")).div(decimalRepresentation("400")).mul(102));
            let rewardForUser2LowerBound = panaPerSecond.mul(100).div(400).mul(decimalRepresentation("300")).div(decimalRepresentation("400")).mul(101);
            let rewardForUser2UpperBound = panaPerSecond.mul(100).div(400).mul(decimalRepresentation("300")).div(decimalRepresentation("400")).mul(102);

            expect(Number(pendingPanaUser1)).to.be.greaterThanOrEqual(Number(rewardForUser1LowerBound));
            expect(Number(pendingPanaUser1)).to.be.lessThanOrEqual(Number(rewardForUser1UpperBound));

            expect(Number(pendingPanaUser2)).to.be.greaterThanOrEqual(Number(rewardForUser2LowerBound));
            expect(Number(pendingPanaUser2)).to.be.lessThanOrEqual(Number(rewardForUser2UpperBound));
             
        });

        it("should update reward rate based on multiple deposits",async() => {

            await stakingPool.connect(user1).deposit(0, decimalRepresentation("100"));
            moveTimestamp(100);
            await stakingPool.connect(user2).deposit(0, decimalRepresentation("100"));
            moveTimestamp(100);
            await stakingPool.updatePool(0);

            let reward = panaPerSecond.mul(100).div(400);
            let accPanaPerShareBefore = reward.mul(decimalRepresentation(1,12)).div(decimalRepresentation("100"));
            let accPanaPerShareAfter = accPanaPerShareBefore.add(reward.mul(decimalRepresentation(1,12)).div(decimalRepresentation("200")));
            let accPanaPerShareLowerBound = accPanaPerShareAfter.mul(101);
            let accPanaPerShareUpperBound = accPanaPerShareAfter.mul(102);

            let [, , , accPanaPerShareInPool] = await stakingPool.poolInfo(0);


            expect(Number(accPanaPerShareInPool)).to.be.greaterThanOrEqual(Number(accPanaPerShareLowerBound));
            expect(Number(accPanaPerShareInPool)).to.be.lessThanOrEqual(Number(accPanaPerShareUpperBound));
        });

        it("should increase reward rate with withdrawals",async() => {
            await stakingPool.connect(user1).deposit(0,decimalRepresentation("200"));
            moveTimestamp(100);
            await stakingPool.connect(user1).withdraw(0,decimalRepresentation("100"));
            moveTimestamp(100)
            await stakingPool.updatePool(0);

            let reward = panaPerSecond.mul(100).div(400);
            let accPanaPerShareBefore = reward.mul(decimalRepresentation(1,12)).div(decimalRepresentation("200"));
            let accPanaPerShareAfter = accPanaPerShareBefore.add(reward.mul(decimalRepresentation(1,12)).div(decimalRepresentation("100")));
            let accPanaPerShareLowerBound = accPanaPerShareAfter.mul(101);
            let accPanaPerShareUpperBound = accPanaPerShareAfter.mul(102);

            let [, , , accPanaPerShareInPool] = await stakingPool.poolInfo(0);

            expect(Number(accPanaPerShareInPool)).to.be.greaterThanOrEqual(Number(accPanaPerShareLowerBound));
            expect(Number(accPanaPerShareInPool)).to.be.lessThanOrEqual(Number(accPanaPerShareUpperBound));
        });

        it("should return correct pana with  tokens staked in multiple pools",async() => {

            await stakingPool.connect(user1).deposit(0,decimalRepresentation("100"));

            await stakingPool.connect(user1).deposit(1,decimalRepresentation("100"));

            moveTimestamp(100)
            await stakingPool.massUpdatePools();
            let pendingPana = await stakingPool.pendingPanaForUser(user1.address);

            let rewardForUSDC = panaPerSecond.mul(100).div(400);
            let rewardForDAI = panaPerSecond.mul(300).div(400);
            let totalRewardUpperBound = rewardForDAI.add(rewardForUSDC).mul(102);
            let totalRewardLowerBound = rewardForDAI.add(rewardForUSDC).mul(101);

            let totalPendingPana = bigNumberRepresentation(0);
            pendingPana.forEach((x, i) => totalPendingPana = totalPendingPana.add(x));

            expect(Number(totalPendingPana)).to.be.greaterThanOrEqual(Number(totalRewardLowerBound));
            expect(Number(totalPendingPana)).to.be.lessThanOrEqual(Number(totalRewardUpperBound));


        });

    });
    
});