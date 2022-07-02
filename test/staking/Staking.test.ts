import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai, { expect } from "chai";
import { ethers } from "hardhat";
const { BigNumber } = ethers;
import { FakeContract, smock } from "@defi-wonderland/smock";
import {
    IDistributor,
    IKarsha,
    IsPana,
    IPana,
    PanaStaking,
    PanaStaking__factory,
    PanaAuthority,
    PanaAuthority__factory,
} from "../../types";

chai.use(smock.matchers);

const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

describe("PanaStaking", () => {
    let owner: SignerWithAddress;
    let governor: SignerWithAddress;
    let guardian: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let other: SignerWithAddress;
    let panaFake: FakeContract<IPana>;
    let sPanaFake: FakeContract<IsPana>;
    let karshaFake: FakeContract<IKarsha>;
    let distributorFake: FakeContract<IDistributor>;
    let staking: PanaStaking;
    let authority: PanaAuthority;

    const EPOCH_LENGTH = 11520;
    const EPOCH_NUMBER = 1;
    // const FUTURE_END_TIME = 1022010000; // an arbitrary future block timestamp

    beforeEach(async () => {
        [owner, governor, guardian, alice, bob, other] = await ethers.getSigners();
        panaFake = await smock.fake<IPana>("IPana");
        karshaFake = await smock.fake<IKarsha>("IKarsha");
        // need to be specific because IsPana is also defined in OLD
        sPanaFake = await smock.fake<IsPana>("contracts/interfaces/IsPana.sol:IsPana");
        distributorFake = await smock.fake<IDistributor>("IDistributor");
        authority = await new PanaAuthority__factory(owner).deploy(
            governor.address,
            guardian.address,
            owner.address,
            owner.address,
            ZERO_ADDRESS
        );
    });

    describe("constructor", () => {
        it("can be constructed", async () => {
            staking = await new PanaStaking__factory(owner).deploy(
                panaFake.address,
                sPanaFake.address,
                karshaFake.address,
                authority.address
            );

            expect(await staking.PANA()).to.equal(panaFake.address);
            expect(await staking.sPANA()).to.equal(sPanaFake.address);
            const epoch = await staking.epoch();

            expect(await authority.governor()).to.equal(governor.address);
        });

        it("will not allow a 0x0 PANA address", async () => {
            await expect(
                new PanaStaking__factory(owner).deploy(
                    ZERO_ADDRESS,
                    sPanaFake.address,
                    karshaFake.address,
                    authority.address
                )
            ).to.be.reverted;
        });

        it("will not allow a 0x0 sPANA address", async () => {
            await expect(
                new PanaStaking__factory(owner).deploy(
                    panaFake.address,
                    ZERO_ADDRESS,
                    karshaFake.address,
                    authority.address
                )
            ).to.be.reverted;
        });

        it("will not allow a 0x0 KARSHA address", async () => {
            await expect(
                new PanaStaking__factory(owner).deploy(
                    panaFake.address,
                    sPanaFake.address,
                    ZERO_ADDRESS,
                    authority.address
                )
            ).to.be.reverted;
        });
    });

    describe("initialization", () => {
        beforeEach(async () => {
            staking = await new PanaStaking__factory(owner).deploy(
                panaFake.address,
                sPanaFake.address,
                karshaFake.address,
                authority.address
            );
        });

        describe("setDistributor", () => {
            it("can set the distributor", async () => {
                await staking.connect(governor).setDistributor(distributorFake.address);
                expect(await staking.distributor()).to.equal(distributorFake.address);
            });

            it("emits the DistributorSet event", async () => {
                await expect(staking.connect(governor).setDistributor(distributorFake.address))
                    .to.emit(staking, "DistributorSet")
                    .withArgs(distributorFake.address);
            });

            it("can only be done by the governor", async () => {
                await expect(staking.connect(other).setDistributor(distributorFake.address)).to.be
                    .reverted;
            });
        });
    });

    describe("post-initialization", () => {
        async function deployStaking(nextRebaseBlock: any) {
            staking = await new PanaStaking__factory(owner).deploy(
                panaFake.address,
                sPanaFake.address,
                karshaFake.address,
                authority.address
            );
            await staking.connect(governor).setDistributor(distributorFake.address);
            await staking.connect(governor).setFirstEpoch(EPOCH_LENGTH, EPOCH_NUMBER, nextRebaseBlock);
        }

        beforeEach(async () => {
            const currentBlock = await ethers.provider.send("eth_blockNumber", []);
            const nextRebase = BigNumber.from(currentBlock).add(10000); // set the rebase far enough in the future to not hit it
            await deployStaking(nextRebase);
        });

        describe("stake", () => {
            
            it("exchanges PANA for newly minted KARSHA", async () => {
                const amount = 1000;
                const indexedAmount = 10000;

                panaFake.transferFrom
                    .whenCalledWith(alice.address, staking.address, amount)
                    .returns(true);
                karshaFake.balanceTo.whenCalledWith(amount).returns(indexedAmount);

                // Allow External Staking
                await staking.connect(governor).allowExternalStaking(true);

                await staking.connect(alice).stake(alice.address, amount);

                expect(karshaFake.mint).to.be.calledWith(alice.address, indexedAmount);
            });

        });

        
        describe("unstake", () => {

            it("can redeem KARSHA for PANA", async () => {
                const amount = 1000;
                const indexedAmount = 10000;

                panaFake.transferFrom.returns(true);
                
                // Allow External Staking
                await staking.connect(governor).allowExternalStaking(true);
                await staking.connect(alice).stake(alice.address, amount);

                karshaFake.balanceFrom.whenCalledWith(indexedAmount).returns(amount);
                panaFake.transfer.returns(true);
                panaFake.balanceOf.returns(amount);
                await staking.connect(alice).unstake(alice.address, indexedAmount, false);

                expect(panaFake.transfer).to.be.calledWith(alice.address, amount);
                expect(karshaFake.burn).to.be.calledWith(alice.address, indexedAmount);
            });
        });

        
        describe("rebase", () => {
            
            it("set first epoch for rebase to happen", async () => {

                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                await deployStaking(currentBlock);

                const epoch = await staking.epoch();
                expect((epoch as any)._length).to.equal(BigNumber.from(EPOCH_LENGTH));
                expect(epoch.number).to.equal(BigNumber.from(EPOCH_NUMBER));
                expect(epoch.end).to.equal(BigNumber.from(currentBlock));

            });

            it("does nothing if the block is before the epoch end block", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.be.lt(BigNumber.from(epoch.end));

                await staking.connect(alice).rebase();
            });

            it("increments epoch number and calls rebase ", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);

                await deployStaking(currentBlock);

                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.equal(BigNumber.from(epoch.end));

                await staking.connect(alice).rebase();

                const nextEpoch = await staking.epoch();
                expect(BigNumber.from(nextEpoch.number)).to.equal(
                    BigNumber.from(epoch.number).add(1)
                );
                expect(BigNumber.from(nextEpoch.end)).to.equal(
                    BigNumber.from(currentBlock).add(EPOCH_LENGTH)
                );
            });

            it("when the PANA balance of the staking contract equals KARSHA(sPANA) supply, distribute zero", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                await deployStaking(currentBlock);
                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.equal(BigNumber.from(epoch.end));

                panaFake.balanceOf.whenCalledWith(staking.address).returns(10);
                sPanaFake.circulatingSupply.returns(10);
                await staking.connect(alice).rebase();

                const nextEpoch = await staking.epoch();
                expect(BigNumber.from(nextEpoch.distribute)).to.equal(0);
            });

            it("will plan to distribute the difference between staked and total supply", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                await deployStaking(currentBlock);
                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.equal(BigNumber.from(epoch.end));

                panaFake.balanceOf.whenCalledWith(staking.address).returns(10);
                sPanaFake.circulatingSupply.returns(5);
                await staking.connect(alice).rebase();

                const nextEpoch = await staking.epoch();
                expect(BigNumber.from(nextEpoch.distribute)).to.equal(5);
            });

            it("will call the distributor, if set", async () => {
                const currentBlock = await ethers.provider.send("eth_blockNumber", []);
                await deployStaking(currentBlock);
                const epoch = await staking.epoch();
                expect(BigNumber.from(currentBlock)).to.equal(BigNumber.from(epoch.end));

                await staking.connect(alice).rebase();

                expect(distributorFake.distribute).to.have.been.called;
            });
        });
    });
});
