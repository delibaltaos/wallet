import Token from './token.js';
import * as connectionJs from './connection.js';
import {getActivity} from './transactionParser.js';
import {payer} from "./config.js";
import RPC from "./rpc.js";

/**
 * Represents a wallet that allows buying and selling of tokens.
 */
class Wallet {
    #callback;
    #tokens = [];
    #rpc;

    constructor() {
        this.#rpc = new RPC();
    }

    /**
     * Starts the synchronization process and sets up intervals for synchronization and selling attempts.
     *
     * @returns {Promise<void>} A Promise that resolves when the start process is complete.
     */
    start() {
        this.#synchronize().then(() => {
            setInterval(() => this.#synchronize(), 10000);
        });
    }

    /**
     * Sets the callback function to be executed when my tokens are received.
     *
     * @param {function} callback - The callback function to be executed.
     *
     * @return {void}
     */
    listenMyTokens(callback) {
        this.#callback = callback;
    }

    /**
     * Listens for new tokens and invokes the provided callback.
     *
     * @param {function} callback - The callback function to be invoked when new tokens are received.
     * @returns {void}
     */
    listenNewTokens(callback) {
        this.#rpc.listenNewTokens(callback);
    }

    /**
     * Asynchronously executes a buy transaction.
     *
     * @param {string} mint - The mint address.
     * @param {number} amount - The amount to buy.
     * @param {number} slippage - The slippage tolerance (in percentage).
     * @returns {Promise} - A promise that resolves to the transaction result.
     */
    async buy(mint, amount, slippage) {
        return this.#swap(mint, amount, true, slippage);
    }

    /**
     * Sell tokens on the given mint with specified amount and slippage.
     *
     * @param {string} mint - The mint of the token to sell.
     * @param {number} amount - The amount of tokens to sell.
     * @param {number} slippage - The slippage tolerance in percentage.
     *
     * @return {Promise} A promise that resolves to the result of the sell transaction.
     */
    async sell(mint, amount, slippage=10) {
        return this.#swap(mint, amount, false, slippage);
    }

    /**
     * Asynchronously synchronizes tokens and transactions.
     * It updates the cost of tokens based on the corresponding transaction activity.
     * If a callback function is provided, it calls the callback function with the updated tokens.
     *
     * @return {Promise<void>} - A promise that resolves once the synchronization is completed.
     *                          It does not return a value.
     * @throws {Error} - If an error occurs during the synchronization process.
     */
    async #synchronize() {
        try {
            const signatures = await connectionJs.getSignatures();
            if (signatures.length > 0) {
                const transactions = await connectionJs.getTransactions(signatures);
                const tokens = await this.#getMyTokens();

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

                if (this.#callback) {
                    this.#callback(this.#tokens);
                }
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
            const values = accounts.value.filter(account =>
                account.account.data.parsed.info["tokenAmount"].uiAmount > 0
            );
            const tokens = [];

            for (const account of values) {
                const info = account.account.data.parsed.info;
                const mint = info.mint;
                const coin = await this.#getCoin(mint);
                const amount = info["tokenAmount"]?.uiAmount || 0;
                tokens.push(new Token(coin, amount));
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
        try {
            const rawTransaction = await this.#rpc.getTransaction(mint, amount, isBuy, payer.publicKey, slippage);
            return await connectionJs.sendAndConfirmTransaction(rawTransaction);
        } catch (error) {
            console.debug(`Error during swap ${isBuy ? 'buy' : 'sell'}:`, error);
        }
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
            console.debug('Error getting minimum amount out:', error);
            return {priceImpact: 0, amountOut: 0};
        }
    }
}

const WalletInstance = new Wallet();
export default WalletInstance;