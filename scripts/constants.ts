export const CONTRACTS: Record<string, string> = {
    pana: "PanaERC20Token",
    sPana: "sPana",
    karsha: "Karsha",
    staking: "PanaStaking",
    distributor: "Distributor",
    distributorV2: "DistributorV2",
    treasury: "PanaTreasury",
    treasuryV2: "PanaTreasuryV2",
    treasuryMigrator: "TreasuryMigrator",
    bondDepo: "PanaBondDepository",
    bondingCalculator: "PanaBondingCalculator",
    authority: "PanaAuthority",
    USDC: "USDC",
    pPana: "PPanaERC20",
    pPanaRedeem: "PPanaRedeem",
    priceOracle: "SimpleUniswapOracle",
    panaSupplyController: "PanaSupplyController",
    proportionalSupplyController: "ProportionalSupplyController",
    stakingPools: "StakingPools"
};

// Constructor Arguments
export const TREASURY_TIMELOCK = 0;

// Constants
export const LARGE_APPROVAL = "100000000000000000000000000000000";
export const EPOCH_LENGTH_IN_BLOCKS = "28800";
export const FIRST_EPOCH_NUMBER = "0";
export const FIRST_EPOCH_TIME = "1639430907";
export const INITIAL_REWARD_RATE = "203804";
export const FIXED_APY = true;
export const INITIAL_INDEX = "1000000000000000000";
export const INITIAL_MINT = "6000000000000000";
export const BOUNTY_AMOUNT = "0";
export const INITIAL_BASE_VALUE = "100000000000";
export const KP = "180" // Propotional Gain for Supply Controller

export const USDC_ADDRESS = {
    mainnet: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    goerli: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
    arbitrumTest: "0x327459343E34F4c2Cc3fE6678ea8cA3Cf22fBfC8"
}

export function getUSDCAddress(chainId: string) : string{
    switch (chainId) {
        case "5": //goerli
            return USDC_ADDRESS.goerli;
        case "421613": //arbitrum test
            return USDC_ADDRESS.arbitrumTest;
        default: //arbitrum
            return USDC_ADDRESS.mainnet
    }
}

export function getDEXFactoryAddress(chainId: string) : string{
    //This is for Sushi
    switch (chainId) {
        case "5": //goerli
            return "0xc35DADB65012eC5796536bD9864eD8773aBc74C4";
        case "421613": //arbitrum test
            return "0x64a0745EF9d3772d9739D9350873eD3703bE45eC";
        default: //arbitrum
            return "0xc35DADB65012eC5796536bD9864eD8773aBc74C4";
    }
}

export function getDEXRouterAddress(chainId: string) : string{
    //This is for Sushi
    switch (chainId) {
        case "5": //goerli
            return "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
        case "421613": //arbitrum test
            return "0xe82c4d8b993d613a28600b953e91a3a93ae69fd6";
        default: //arbitrum
            return "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
    }
}

export function getPANAUSDCLPToken(chainId: string) : string{
    //This is for Sushi
    switch (chainId) {
        case "5": //goerli
            return "0xE9aFf8206804AEA476432850e33B51cC1c3Ef6b0";
        case "421613": //arbitrum test
            return "0x466614D6B4249A24Be3E0B4d176Ee4BC6F795411";
        default: //arbitrum
            return "0x300fDD222687db8686EA51847Db43fa988b518E0";
    }
}

export const STAKING_POOLS = [
    { allocationPoint: 100, tokenAddress: '0x369eB8197062093a20402935D3a707b4aE414E9D', token: 'PANA' },
    { allocationPoint: 400, tokenAddress: '0x300fDD222687db8686EA51847Db43fa988b518E0', token: 'PANA/USDC LP' },
    { allocationPoint: 10, tokenAddress: '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196', token: 'AAVE' },
    { allocationPoint: 10, tokenAddress: '0x99C409E5f62E4bd2AC142f17caFb6810B8F0BAAE', token: 'BIFI' },
    { allocationPoint: 10, tokenAddress: '0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978', token: 'CRV' },
    { allocationPoint: 10, tokenAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', token: 'DAI' },
    { allocationPoint: 10, tokenAddress: '0x6C2C06790b3E3E3c38e12Ee22F8183b37a13EE55', token: 'DPX' },
    { allocationPoint: 10, tokenAddress: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', token: 'GMX' },
    { allocationPoint: 10, tokenAddress: '0x8D9bA570D6cb60C7e3e0F31343Efe75AB8E65FB1', token: 'GOHM' },
    { allocationPoint: 10, tokenAddress: '0x10393c20975cF177a3513071bC110f7962CD67da', token: 'JONES' },
    { allocationPoint: 10, tokenAddress: '0x6694340fc020c5E6B96567843da2df01b2CE1eb6', token: 'STG' },
    { allocationPoint: 10, tokenAddress: '0xd4d42F0b6DEF4CE0383636770eF773390d85c61A', token: 'SUSHI' },
    { allocationPoint: 10, tokenAddress: '0x080F6AEd32Fc474DD5717105Dba5ea57268F46eb', token: 'SYN' },
    { allocationPoint: 10, tokenAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', token: 'USDC' },
    { allocationPoint: 10, tokenAddress: '0xa684cd057951541187f288294a1e1C2646aA2d24', token: 'VSTA' },
    { allocationPoint: 10, tokenAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', token: 'WETH' }
]