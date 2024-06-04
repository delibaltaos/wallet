import Token from './token.js';
import * as connectionJs from './connection.js';
import { getActivity } from './transactionParser.js';
import { payer } from "./config.js";
import RPC from "./rpc.js";

/**
 * Represents a wallet that allows buying and selling of tokens.
 */
class Wallet {
    #callback;
    #rpc;
    #balance = 0;

    #tokens = [];
    #vacantAccounts = [];
    #toBeBurnedAccounts = [];

    constructor() {
        this.#rpc = new RPC();
    }

    async #initBalance() {
        this.#balance = await connectionJs.getBalance();

        connectionJs.listenAccountChange(async newBalance => {
            if (this.#balance !== newBalance) {
                this.#balance = newBalance;
            }

            await this.#synchronize();

            this.#callback?.(newBalance);
        });
    }

    /**
     * Starts the synchronization process and sets up intervals for synchronization and selling attempts.
     *
     * @returns {Promise<void>} A Promise that resolves when the start process is complete.
     */
    async start() {
        await this.#initBalance();
        await this.#synchronize();
    }

    listen(callback) {
        this.#callback = callback;
    }

    get balance() {
        return this.#balance;
    }

    get tokens() {
        return this.#tokens;
    }

    get vacantAccounts() {
        return this.#vacantAccounts;
    }

    get toBeBurnedAccounts() {
        return this.#toBeBurnedAccounts;
    }

    /**
     * Listens for new tokens and invokes the provided callback.
     *
     * @param {function} callback - The callback function to be invoked when new tokens are received.
     * @returns {void}
     */
    listenNewTokens(callback) {
        this.#rpc.listenNewTokens(async token => {
            if (token.isMintable !== undefined && token.isMutable !== undefined) {
                callback(new Token(token, 0));
            }
        });
    }

    /**
     * Asynchronously executes a buy transaction.
     *
     * @param {string} mint - The mint address.
     * @param {number} amount - The amount to buy.
     * @param {number} slippage - The slippage
     * @returns {Promise} - A promise that resolves to the transaction result.
     */
    buy = async (mint, amount, slippage = 10) =>
        this.#swap(mint, amount, true, slippage);

    /**
     * Sell tokens on the given mint with specified amount and slippage.
     *
     * @param {string} mint - The mint of the token to sell.
     * @param {number} amount - The amount of tokens to sell.
     * @param {number} slippage - The slippage tolerance in percentage.
     *
     * @return {Promise} A promise that resolves to the result of the sell transaction.
     */
    sell = async (mint, amount, slippage = 10) => this.#swap(mint, amount, false, slippage);

    async #synchronize() {
        try {
            const signatures = await connectionJs.getSignatures();

            if (signatures.length > 0) {
                const myTokens = await this.#getMyTokens();

                this.#vacantAccounts = myTokens.filter(token => token.amount === 0);

                const smallAmountTokens = myTokens.filter(token =>
                    token.amount < 1 && token.amount > 0
                );

                const toBeBurnedAccounts = [];

                for (const token of smallAmountTokens) {
                    try {
                        const { amountOut } = await this.getAmount(
                            token.mint,
                            token.amount,
                            false,
                            10
                        );

                        if (amountOut < 0.0001) {
                            toBeBurnedAccounts.push(token);
                        }
                    } catch (error) {
                        console.log(error);
                    }

                    this.#toBeBurnedAccounts = toBeBurnedAccounts;
                }

                const tokens = myTokens.filter(token =>
                    !toBeBurnedAccounts.includes(token) &&
                    !this.#vacantAccounts.includes(token)
                );

                for (const token of tokens) {
                    const result = this.#tokens.find(t => t.mint === token.mint);
                    if (!result) {
                        const coin = await this.#getCoin(token.mint);
                        coin.amount = parseInt(token.amount);
                        this.#tokens.push(coin);
                    }
                }

                const transactions = await connectionJs.getTransactions(signatures);

                this.#tokens
                    .forEach(token => {
                        transactions.forEach(transaction => {
                            if (JSON.stringify(transaction).includes(token.mint)) {
                                const activity = getActivity(transaction);
                                if (activity?.mint && activity?.cost) {
                                    const foundToken = this.#tokens.find(t => t.mint === activity.mint);
                                    if (foundToken) {
                                        console.log(foundToken.mint, activity.cost);
                                        foundToken.cost = activity.cost;
                                    }
                                }
                            }
                        });
                    });
            }
        } catch (error) {
            console.debug('Error during synchronization:', error);
        }
    }

    /**
     * Retrieves the user's tokens.
     * @async
     * @returns {Promise<Array<Token>>} An array of Token objects representing the user's tokens.
     * If there is an error, an empty array is returned.
     */
    async #getMyTokens() {
        try {
            const accounts = await connectionJs.getParsedTokenAccountsByOwner();
            const tokens = [];

            for (const account of accounts.value) {
                const info = account.account.data.parsed.info;
                const mint = info.mint;
                const amount = info["tokenAmount"]?.uiAmount || 0;
                tokens.push({
                    mint: mint,
                    amount: amount
                });
            }

            return tokens;
        } catch (error) {
            console.error('Error getting tokens:', error);
            return [];
        }
    }

    /**
     * Swap tokens asynchronously.
     *
     * @param {string} mint - The address of the token to swap.
     * @param {number} amount - The amount of tokens to swap.
     * @param {boolean} isBuy - Indicates whether it is a buy or sell transaction.
     * @param {number} slippage - The slippage value for the swap transaction.
     * @returns {Promise} - A promise that resolves with the result of the swap transaction.
     * @throws {Error} - If an error occurs during the swap transaction.
     */
    async #swap(mint, amount, isBuy, slippage) {
        const rawTransaction = await this.#rpc.getTransaction(mint, amount, isBuy, payer.publicKey, slippage);
        return await connectionJs.sendAndConfirmTransaction(rawTransaction);
    }

    /**
     * Retrieves coin data from the specified mint.
     * @param {string} mint - The mint address of the coin.
     * @return {Promise<object|null>} - A promise that resolves to the coin data, or null if an error occurs.
     */
    async #getCoin(mint) {
        try {
            return await this.#rpc.getCoinData(mint);
        } catch (error) {
            console.debug('Error getting coin data:', error);
            return null;
        }
    }

    /**
     * Gets the minimum amount out based on the provided parameters.
     *
     * @param {string} mint - The mint address.
     * @param {number} amount - The amount of tokens.
     * @param {boolean} isBuy - Indicates whether it is a buy transaction.
     * @param {number} slippage - The allowed slippage in percentage (default is 10).
     * @returns {Promise<{ priceImpact: number, amountOut: number }>} An object containing the price impact and the amount out.
     */
    async getAmount(mint, amount, isBuy, slippage = 10) {
        try {
            return await this.#rpc.getAmount(mint, amount, isBuy, slippage);
        } catch (error) {
            // console.debug('Error getting minimum amount out:', error);
            return { priceImpact: 0, amountOut: 0 };
        }
    }
}

const WalletInstance = new Wallet();
export default WalletInstance;