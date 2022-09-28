import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitFor } from "../txHelper";
import { CONTRACTS, getPANAUSDCLPToken, INITIAL_INDEX } from "../constants";
import {
    PanaStaking__factory,
    SPana__factory,
    Karsha__factory,
    SimpleUniswapOracle__factory,
} from "../../types";

// TODO: Shouldn't run setup methods if the contracts weren't redeployed.
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers, getChainId } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);
    const chainId = await getChainId();
    let lpTokenAddress = getPANAUSDCLPToken(chainId);

    const sPanaDeployment = await deployments.get(CONTRACTS.sPana);
    const karshaDeployment = await deployments.get(CONTRACTS.karsha);
    const stakingDeployment = await deployments.get(CONTRACTS.staking);
    const priceOracleDeployment = await deployments.get(CONTRACTS.priceOracle);

    const sPana = SPana__factory.connect(sPanaDeployment.address, signer);
    const karsha = Karsha__factory.connect(karshaDeployment.address, signer);
    const staking = PanaStaking__factory.connect(stakingDeployment.address, signer);
    const priceOracle = SimpleUniswapOracle__factory.connect(priceOracleDeployment.address, signer);
    
    await waitFor(sPana.setIndex(INITIAL_INDEX));
    await waitFor(sPana.setKarsha(karsha.address));
    await waitFor(sPana.initialize(staking.address));
    console.log("Core Setup -- sPana initialized (staking)");

    await waitFor(priceOracle.initialize(lpTokenAddress));
    console.log("Core Setup -- priceOracle initialize with LP token");

};

func.tags = ["core"];
func.dependencies = [CONTRACTS.pana, CONTRACTS.sPana, CONTRACTS.karsha];

export default func;
