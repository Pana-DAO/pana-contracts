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
    DAI: "DAI",
    aPanaUpgradeable: "APanaUpgradeableERC20",
    pPanaUpgradeable: "PPanaUpgradeableERC20",
    pPana: "pPana",
    pPanaRedeem: "PPanaRedeem",
    slidingWindowOracle: "PanaSlidingWindowOracle",
    PanaSupplyController: "PanaSupplyController"
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

export const DAI_ADDRESS = {
    mainnet: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
    goerli: "0x327459343E34F4c2Cc3fE6678ea8cA3Cf22fBfC8",
    arbitrumTest: "0x327459343E34F4c2Cc3fE6678ea8cA3Cf22fBfC8"
}

export function getDAIAddress(chainId: string) : string{
    switch (chainId) {
        case "5": //goerli
            return DAI_ADDRESS.goerli;
        case "421611": //arbitrum test
            return DAI_ADDRESS.arbitrumTest;
        default: //arbitrum
            return DAI_ADDRESS.mainnet
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

export function getPANADAILPToken(chainId: string) : string{
    //This is for Sushi
    switch (chainId) {
        case "5": //goerli
            return "0xE9aFf8206804AEA476432850e33B51cC1c3Ef6b0";
        case "421611": //arbitrum test
            return "0x34E372dB783de192D78e99452ae0d94DFe8ab040";
        default: //arbitrum
            return "";
    }
}