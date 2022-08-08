export const CONTRACTS: Record<string, string> = {
    pana: "PanaERC20Token",
    sPana: "sPana",
    karsha: "Karsha",
    staking: "PanaStaking",
    distributor: "Distributor",
    treasury: "PanaTreasury",
    bondDepo: "PanaBondDepository",
    bondingCalculator: "PanaBondingCalculator",
    authority: "PanaAuthority",
    USDC: "USDC",
    pPana: "PPanaERC20",
    pPanaRedeem: "PPanaRedeem",
    slidingWindowOracle: "PanaSlidingWindowOracle",
    PanaSupplyController: "PanaSupplyController",
    stakingPools: "StakingPools"
};

// Constructor Arguments
export const TREASURY_TIMELOCK = 0;

// Constants
export const LARGE_APPROVAL = "100000000000000000000000000000000";
export const EPOCH_LENGTH_IN_BLOCKS = "28800";
export const FIRST_EPOCH_NUMBER = "0";
export const FIRST_EPOCH_TIME = "1639430907";
export const INITIAL_REWARD_RATE = "1400";
export const INITIAL_INDEX = "1000000000000000000";
export const INITIAL_MINT = "6000000000000000";
export const BOUNTY_AMOUNT = "0";
export const INITIAL_BASE_VALUE = "100000000000";

export const USDC_ADDRESS = {
    mainnet: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    goerli: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
    arbitrumTest: "0x91700A0a45bef3Ef488eC11792aE3b3199e0dC4e"
}

export function getUSDCAddress(chainId: string) : string{
    switch (chainId) {
        case "5": //goerli
            return USDC_ADDRESS.goerli;
        case "421611": //arbitrum test
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
        case "421611": //arbitrum test
            return "0x681c3836a5589b933062ACA4fd846c1287a2865F";
        default: //arbitrum
            return "";
    }
}

export function getDEXRouterAddress(chainId: string) : string{
    //This is for Sushi
    switch (chainId) {
        case "5": //goerli
            return "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
        case "421611": //arbitrum test
            return "0xb5a35165047fed7440D3a75909c0949bf1943696";
        default: //arbitrum
            return "";
    }
}

export function getPANAUSDCLPToken(chainId: string) : string{
    //This is for Sushi
    switch (chainId) {
        case "5": //goerli
            return "0xE9aFf8206804AEA476432850e33B51cC1c3Ef6b0";
        case "421611": //arbitrum test
            return "0x75C78C8F779dE09687629E158Ad4f33EE35b5eE1";
        default: //arbitrum
            return "";
    }
}