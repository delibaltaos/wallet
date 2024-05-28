import Token from './token.js';
import DB from './db.js';

import { delay, calculatePercentageDifference } from './utils.js';

import Raydium from "./raydium/raydium.js";
import { getParsedTokenAccountsByOwner, listenMyLogs, getParsedTransaction } from './connection.js';
import { getActivity } from './transactionParser.js';

class Wallet {
    #callback;
    #tokens;
    constructor() {
        // DB.getPool("6DK9gDy8R4TjxUVY4bfceeUpxVQmR627RTCmPQVbFoWT").then(result => {
        //     console.log(result)
        // }).catch(error => {
        //     console.log(error)
        // })

        listenMyLogs(async logs => {
            const transactions = await getParsedTransaction(logs.signature);
            const result = getActivity(transactions);

            if (result?.type === "buy") {
                this.#tokens = await this.#getMyTokens();
                const token = this.#tokens.find(token => token.mint === result.mint);
                token.cost = result.cost;
            }
        });

        (async  () => {
            this.#tokens = await this.#getMyTokens();
            await this.#try2Sell();
        })();

        // Raydium.listenNewTokens(token => {
        //     console.log(token);
        // });
    }

    // soldTokens = async () => {
    //     const mint = '4MpaZdsrdWzP2M5DLFCBhWu1SRpP7DhoBgPqkM3u5xdV';
    //     // const amount = await Raydium.getMinAmount(mint, 30000, false);
    //     // console.log(amount);
    //    await Raydium.swap(mint, 1000, false);
    //    await delay(1000);
    //    this.soldTokens();
    // }

    listenNewTokens = callback =>
        Raydium.getTestMint(callback);

    listenMyTokens = callback =>
        this.#callback = callback;

    #try2Sell = async () => {
        for(const token of this.#tokens) {
            if (token.cost > 0) {
                const { amountOut, priceImpact } = await Raydium.getMinAmount(token.mint, token.amount, false);
                if (priceImpact > 0.99) {
                    // rugpull
                } else {
                    const diff = calculatePercentageDifference(token.cost, amountOut);
                    if (diff > 10) {
                        await this.sell(token.mint, token.amount);
                    }
                }
            }
        }

        await delay(2000);
        this.#try2Sell();
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

    buy = async (mint, amount) => await this.#swap(mint, amount, true);
    sell = async (mint, amount) => await this.#swap(mint, amount, false);

    async #swap(mint, amount, isBuy) {
        try {
            await Raydium.swap(mint, amount, isBuy)
                .catch(error => {
                    // raydium.io -> web3.js -> simulateMultipleInstruction
                    console.log(error);
                });
            console.log("Transaction completed successfully");
        } catch (error) {
            console.log("Error: ", error);
        }
    }
}

const WalletInstance = new Wallet();

export default WalletInstance;