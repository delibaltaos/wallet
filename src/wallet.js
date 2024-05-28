import Token from './token.js';

import { delay, calculatePercentageDifference } from './utils.js';

import Raydium from "./raydium/raydium.js";
import { getParsedTokenAccountsByOwner, listenMyLogs, getParsedTransaction } from './connection.js';
import { getActivity } from './transactionParser.js';

class Wallet {
    #callback;
    #tokens;

    constructor() {
        listenMyLogs(async logs => {
            const transactions = await getParsedTransaction(logs.signature);
            const result = getActivity(transactions);

            if (result?.type === "buy") {
                this.#tokens = await this.#getMyTokens();
                const token = this.#tokens.find(token => token.mint === result.mint);
                if (result.cost) {
                    token.cost = result.cost;
                }
            }
        });

        // (async () => {
        //     this.#tokens = await this.#getMyTokens();
        //     await this.#try2Sell();
        // })();

        // Raydium.listenNewTokens(async token => {
        //     await this.buy(token, 0.01);
        // });

        this.#swap("DJ6FN3LsDSnqXpZwMfebihKNan4DnMeZ5Kg5tufUVsZz", 100, true).then(result => {
            console.log(result);
        }).catch(error => {
            console.log(error);
        })
    }

    listenNewTokens = callback =>
        Raydium.getTestMint(callback);

    listenMyTokens = callback =>
        this.#callback = callback;

    #try2Sell = async () => {
        for (const token of this.#tokens) {
            try {
                const rpAmount = parseInt(token.amount / 100);
                const { priceImpact, amountOut } = await Raydium.getMinAmount(token.mint, rpAmount, false, 50);

                console.log(`getMinAmount : ${token.mint}, amountOut: ${amountOut}, priceImapact : ${priceImpact}`);

                if (priceImpact > 90 && amountOut >= 0.0001) {
                    await this.sell(token.mint, rpAmount, 50);
                }

                else if (token.cost && token.cost > 0) {
                    const { amountOut } = await Raydium.getMinAmount(token.mint, token.amount, false);
                    const diff = calculatePercentageDifference(token.cost, amountOut);
                    if (diff > 10) {
                        await this.sell(token.mint, token.amount);
                    }
                }
            } catch (error) {
                console.log(error);
            }
        }

        await delay(5000);
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

    buy = async (mint, amount, slippage) => await this.#swap(mint, amount, true, slippage);
    sell = async (mint, amount, slippage) => await this.#swap(mint, amount, false, slippage);

    async #swap(mint, amount, isBuy, slippage) {
        console.log("try to swap for ", mint, amount, isBuy, slippage);
        try {
            await Raydium.swap(mint, amount, isBuy, slippage)
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