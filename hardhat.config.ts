import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades"
import "hardhat-deploy";

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
    hardhat: 31337,
    mumbai: 80001,
    goerli: 5,
    arbitrumTest: 421611
};

// Ensure that we have all the environment variables we need.
//const mnemonic: string | undefined = process.env.MNEMONIC ?? "NO_MNEMONIC";
const privateKey: string | undefined = process.env.PRIVATE_KEY ?? "0000000000000000000000000000000000000000000000000000000000000000";
// Make sure node is setup on Infura website
const infuraKey: string | undefined = process.env.INFURA_API_KEY ?? "0000000000000000000000000000000000000000000000000000000000000000";

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",    
    gasReporter: {
        currency: "USD",
        enabled: process.env.REPORT_GAS ? true : false,
        excludeContracts: [],
        src: "./contracts",
    },
    networks: {
        hardhat: { 
            //TODO: we can comment this line until we need to debug locally from mainnet
            //So Hardhat will create its local network 

            // forking: {
            //     url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyApiKey}`,
            // },
            // //accounts: {
            // //    mnemonic,
            // //},
            chainId: chainIds.hardhat,
        },
        mumbai: {
            url: `https://polygon-mumbai.infura.io/v3/${infuraKey}`,
            gas: 2100000,
            gasPrice: 8000000000,
            accounts:
            privateKey !== undefined ? [privateKey] : [],
            chainId: chainIds.mumbai
        },
        goerli: {
            url: `https://goerli.infura.io/v3/${infuraKey}`,
            gas: 2100000,
            gasPrice: 8000000000,
            accounts:
            privateKey !== undefined ? [privateKey] : [],
            chainId: chainIds.goerli
        },
        arbitrumTest: {
            url: `https://arbitrum-rinkeby.infura.io/v3/${infuraKey}`,
            gas: 210000000,
            gasPrice: 800000000000,
            accounts:
            privateKey !== undefined ? [privateKey] : [],
            chainId: chainIds.arbitrumTest
        }
    },
    paths: {
        artifacts: "./artifacts",
        cache: "./cache",
        sources: "./contracts",
        tests: "./test",
        deploy: "./scripts/deploy",
        deployments: "./deployments",
    },
    solidity: {
        compilers: [
            {
                version: "0.8.10",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    },
                },
            },

            {
                version: "0.7.5",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    },
                },
            },
            {
                version: "0.5.16",
            },
            {
                version: "0.8.4",
            },   
            {//for uniswap mocks
                version: "0.5.0",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    }
                }
            }, 
            {//for uniswap mocks
                version: "0.6.12",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    }
                }
            }, 
            {//for uniswap mocks
                version: "0.6.0",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    }
                }
            }, 
            {//for uniswap mocks
                version: "0.6.2",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    }
                }
            }, 
        ],
        settings: {
            outputSelection: {
                "*": {
                    "*": ["storageLayout"],
                },
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        daoMultisig: {
            "localhost": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
            "hardhat": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
            "matic": "0x9Ce4A045EA9069C1C866bc8B685174f0e1BA0014",
            "mumbai": "0xde9eB6AB368290D17eb207206e2a067C65D98F15",
            "goerli": "0xEA4a42aDa46484A6CB92f86b525a4251ae0fd843",
            "arbitrumTest": "0xde9eB6AB368290D17eb207206e2a067C65D98F15"
        },
        daoPolicy: {
            "hardhat": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
            "matic": "0x9Ce4A045EA9069C1C866bc8B685174f0e1BA0014",
            "mumbai": "0xde9eB6AB368290D17eb207206e2a067C65D98F15",
            "goerli": "0x5a178Dd4F7e74252711c17eb12F4Edd41F292F07",
            "arbitrumTest": "0xde9eB6AB368290D17eb207206e2a067C65D98F15"
        }
    },
    typechain: {
        outDir: "types",
        target: "ethers-v5",
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
};

export default config;
