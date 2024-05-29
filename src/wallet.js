import Token from './token.js';

import {delay, calculatePercentageDifference} from './utils.js';

import Raydium from "./raydium/raydium.js";
import {
    getParsedTokenAccountsByOwner,
    listenMyLogs,
    getParsedTransaction, getTransactions
} from './connection.js';
import {getActivity} from './transactionParser.js';

class Wallet {
    #callback;
    #tokens = [];

    constructor() {
        listenMyLogs(async ({ signature }) => {
            const transaction = await getParsedTransaction(signature);
            const result = getActivity(transaction);

            if (result?.type === "buy") {
                this.#tokens = await this.#getMyTokens();
                const token = this.#tokens.find(token => token.mint === result.mint);
                if (result.cost) {
                    token.cost = result.cost;
                }
            }
        });

        Raydium.listenNewTokens(async mint =>
            await this
                .buy(mint, process.env.BUY_AMOUNT)
        );

        (async () => {
            await this.#synchronize();
            await delay(10000);
            await this.#try2Sell();
            setInterval(async () => await this.#synchronize(), 10000);
        })();
    }

    async #synchronize() {
        try {
            const tokens = await this.#getMyTokens();

            for (const token of tokens) {
                const transactions = await getTransactions(token.mint);
                transactions
                    .map(transaction => getActivity(transaction))
                    .forEach(activity => {
                        const token = tokens.find(token => token.mint === activity.mint);
                        if (activity.cost)
                            token.cost = activity.cost;
                    });
            }

            this.#tokens = tokens;
        } catch (error) {
            console.log(error);
        }
    }

    listenNewTokens = callback =>
        Raydium.getTestMint(callback);

    listenMyTokens = callback =>
        this.#callback = callback;

    buy = async (mint, amount, slippage) =>
        await this.#swap(mint, amount, true, slippage);

    sell = async (mint, amount, slippage) =>
        await this.#swap(mint, amount, false, slippage);

    #try2Sell = async () => {
        for (const token of this.#tokens) {
            try {
                const rpAmount = parseInt((token.amount / 100).toFixed(0));
                const {
                    priceImpact,
                    amountOut
                } = await Raydium.getMinAmount(
                    token.mint,
                    rpAmount,
                    false,
                    50
                );

                console.log(`getMinAmount : ${token.mint}, amountOut: ${amountOut}, priceImpact : ${priceImpact}`);

                if (priceImpact > 90 && amountOut >= 0.0001) {
                    await this.sell(token.mint, rpAmount, 50);
                }

                else if (token.cost && token.cost > 0) {
                    const {amountOut} = await Raydium.getMinAmount(token.mint, token.amount, false);
                    const diff = calculatePercentageDifference(token.cost, amountOut);

                    console.log(`mint: ${token.mint}, diff: ${diff}`);

                    if (diff > 10)
                        await this.sell(token.mint, token.amount);
                }
            } catch (error) {
                console.log(error);
            }
        }
        console.log(new Date());
        await delay(10000);
        await this.#try2Sell();
    }

    #getMyTokens = async () => {
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

    #swap = async (mint, amount, isBuy, slippage) => {
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