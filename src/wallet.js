import Token from './token.js';

import { delay, calculatePercentageDifference } from './utils.js';

import Raydium from "./raydium/raydium.js";
import {
    getParsedTokenAccountsByOwner,
    listenMyLogs,
    getParsedTransaction, getTransactions
} from './connection.js';
import { getActivity } from './transactionParser.js';

class Wallet {
    #callback;
    #tokens = [];

    constructor() {
        this.init();
    }

    async init() {
        const ts = new Date().getTime();
        await this.#synchronize();
        await delay(10000);
        await this.#try2Sell();
        const elapsedTime = (new Date().getTime()) - ts;
        console.log("paralell task finished about: ", elapsedTime, new Date().getTime());
        await delay(5000);
        this.init();
    }

    async #synchronize() {
        console.log("synchronize called", new Date().getTime());
        const tokens = await this.#getMyTokens();
        const transactions = await getTransactions();

        tokens.forEach(token => {
            transactions.forEach(transaction => {
                if (JSON.stringify(transaction).includes(token.mint)) {
                    const activity = getActivity(transaction);
                    if (activity?.mint && activity?.cost) {
                        const foundToken = tokens.find(t => t.mint === activity.mint);
                        if (foundToken) {
                            foundToken.cost = activity.cost;
                        }
                    }
                }
            });
        });

        this.#tokens = tokens;
    }

    listenNewTokens = callback => Raydium.getTestMint(callback);

    listenMyTokens = callback => this.#callback = callback;

    buy = async (mint, amount, slippage) => await this.#swap(mint, amount, true, slippage);

    sell = async (mint, amount, slippage) => await this.#swap(mint, amount, false, slippage);

    async #try2Sell() {
        console.log("try2Sell called ", new Date().getTime());
        for (const token of this.#tokens) {
            try {
                const rpAmount = parseInt((token.amount / 100).toFixed(0));
                const {
                    priceImpact,
                    amountOut
                } = await Raydium.getMinAmount(token.mint, rpAmount, false, 50);

                console.log(`getMinAmount : ${token.mint}, amountOut: ${amountOut}, priceImpact : ${priceImpact}`);

                if (priceImpact > 90 && amountOut >= 0.0001) {
                    await this.sell(token.mint, rpAmount, 50);
                }

                if (token.cost && token.cost > 0) {
                    const { amountOut } = await Raydium.getMinAmount(token.mint, token.amount, false);
                    const diff = calculatePercentageDifference(token.cost, amountOut);

                    console.log(`mint: ${token.mint}, diff: ${diff}`);

                    if (diff > 10) {
                        await this.sell(token.mint, token.amount);
                    }
                }
            } catch (error) {
                console.log(error);
            }
        }
    }

    async #getMyTokens() {
        const accounts = await getParsedTokenAccountsByOwner();

        return accounts.value
            .filter(account =>
                account.account.data.parsed.info.state !== "frozen" &&
                account.account.data.parsed.info.tokenAmount.uiAmount >= 1
            )
            .map(account => {
                const info = account.account.data.parsed.info;
                const mint = info.mint;
                const amount = parseFloat(info.tokenAmount.uiAmount);
                const publicKey = account.pubkey;
                const decimals = info.tokenAmount.decimals;

                const token = new Token(mint, publicKey, decimals);
                token.amount = amount;

                return token;
            });
    }

    async #swap(mint, amount, isBuy, slippage) {
        console.log("try to swap for ", mint, amount, isBuy);
        try {
            // raydium.io -> web3.js -> simulateMultipleInstruction
            await Raydium.swap(mint, amount, isBuy, slippage);
            console.log("Transaction completed successfully");
        } catch (error) {
            console.log("Error: ", error);
        }
    }
}

const WalletInstance = new Wallet();

export default WalletInstance;