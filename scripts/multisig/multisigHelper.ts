import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Fragment } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Wallet } from "ethers";
import axios from "axios";

const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

export class MultisigHelper {

    private safeAddress: string = '';
    private chainId: string = '';
    private signer: Wallet | undefined = undefined;
    private baseSafeURL: string = '';
    private privateKey: string = '';

    public constructor(safeAddress: string, chainId: string, privateKey?: string) {
        if (privateKey && privateKey.trim().length > 0) {
            this.safeAddress = safeAddress;
            this.chainId = chainId;
            const provider = ethers.provider;
            this.signer = new Wallet(
                privateKey, // A Safe owner
                provider
            );

            this.baseSafeURL = this.getBaseSafeURL(chainId);
            this.privateKey = privateKey;
        } else {
            console.log('Error in PrivateKey');
        }
    }

    public async executeTransaction(fragments: readonly Fragment[], contractAddress: string, method: string, params: any[]) {

        let iface = new ethers.utils.Interface(fragments);
        let dataHex = iface.encodeFunctionData(method, params);

        let transaction: any = {
            to: contractAddress,
            data: dataHex,
            value: "0",
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            nonce: 0,
            sender: this.signer?.address
        };
        const safeData = await this.getCurrentSafeData(this.safeAddress);
        const pendingTx = await this.getLatestPendingTransaction(this.safeAddress);

        if (pendingTx) {
            const pendingNonce = pendingTx.results[0].nonce;
            if (pendingNonce > 0 && pendingNonce >= safeData.nonce) {
                transaction.nonce = pendingNonce + 1;
            }
        } else {
            transaction.nonce = safeData.nonce;
        }
        
        

        const contractHash = await this.getContractHash(this.safeAddress, transaction);

        if (contractHash) {
            const signingKey = new ethers.utils.SigningKey('0x' + this.privateKey);
            const digest = signingKey.signDigest(contractHash);
    
            transaction.contractTransactionHash = contractHash;
            transaction.signature = ethers.utils.hexlify(digest.r) + this.remove0x(ethers.utils.hexlify(digest.s)) + this.remove0x(ethers.utils.hexlify(digest.v));

            const executed = await this.proposeTransaction(this.safeAddress, transaction);

            //console.log(transaction);
        }
    }

    private async proposeTransaction(safe: string, transaction: any): Promise<boolean> {
        try {
            const resp = await axios.post(`${this.baseSafeURL}/api/v1/safes/${safe}/multisig-transactions/`, transaction);
            if (resp.status == 401) {
                return true;
            }
            return false;
        } catch (e: any) {
            console.log("Error in propsing Transaction");
            console.log(e);
            return false;
        }
    }

    private async getCurrentSafeData(safe: string): Promise<any> {
        try {
            const resp = await axios.get(`${this.baseSafeURL}/api/v1/safes/${safe}`);
            return resp.data;
        } catch (e: any) {
            return undefined;
        }
    }

    private async getLatestPendingTransaction(safe: string): Promise<any> {
        try {
            const resp = await axios.get(`${this.baseSafeURL}/api/v1/safes/${safe}/multisig-transactions?limit=1&executed=false`);
            return resp.data;
        } catch (e: any) {
            return undefined;
        }
    }

    private async getContractHash(safe: string, transaction: any): Promise<string | undefined> {
        try {
            const tx = {
                ...transaction,
                contractTransactionHash: "0x1fc87fa50fae3bd02704091dc42b216bd66362623b54f86acc00fa990f667c9a" //fake hash
            }
            const resp = await axios.post(`${this.baseSafeURL}/api/v1/safes/${safe}/multisig-transactions/`, tx);
            return undefined;
        } catch (e: any) {
            if (e.response.status == 422) {
                //ex - 'Contract-transaction-hash=0xae53e5d3c9bba9c24b5634e66f453ff99b262d1e277d6b61b244c9adb19879e1 does not match provided contract-tx-hash=0x1fc87fa50fae3bd02704091dc42b216bd66362623b54f86acc00fa990f667c9a'
                return e.response.data.nonFieldErrors[0].toString().replace('Contract-transaction-hash=', ' ').split(' ')[1];
            }
        }
    }

    private getBaseSafeURL(chainId: string): string {

        switch (chainId) {
            case '5':
                return 'https://safe-transaction.goerli.gnosis.io';
            default:
                return 'https://safe-transaction.arbitrum.gnosis.io';
        }

    }

    private remove0x(hexString: string) {
        return hexString.replace('0x', '');
    }
}