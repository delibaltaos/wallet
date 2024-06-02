import WebSocket from 'ws';

/**
 * The IP address or hostname of the server.
 *
 * @type {string}
 * @readonly
 */
const HOST = "178.62.212.178";
const PORT = "3000";

/**
 * Represents RPC (Remote Procedure Call) class used for making API requests and handling WebSocket events.
 */
class RPC {
    #ws;
    #fetchURL;

    /**
     * Initializes a new instance of the class.
     * @constructor
     */
    constructor() {
        this.#fetchURL = this._buildBaseUrl();
        this.#initWebSocket();
    }

    /**
     * Returns the base URL for the application.
     *
     * @returns {string} The base URL in the format http://HOST:PORT.
     */
    _buildBaseUrl() {
        return `http://${HOST}:${PORT}`;
    }

    /**
     * Builds a URL with the given path and parameters.
     *
     * @param {string} path - The path to be included in the URL.
     * @param {Object} params - An object containing key-value pairs representing the parameters.
     * @return {string} The generated URL as a string.
     */
    _buildUrl(path, params) {
        const url = new URL(`${this.#fetchURL}${path}`);
        Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
        return url.toString();
    }


    /**
     * Initializes a WebSocket connection.
     *
     * @return {void}
     */
    #initWebSocket() {
        this.#ws = new WebSocket(`ws://${HOST}:${PORT}`);
        this.#ws.on('error', console.error);
        this.#ws.on('open', function open() {
            console.log("web socket connected");
        });
    }

    /**
     * Listens for new tokens and invokes the provided callback function.
     *
     * @param {function} callback - The callback function to be invoked when new tokens are received.
     *                            It should accept a single parameter representing the parsed JSON data.
     *                            The callback will be called with the parsed data as an argument.
     * @return {void}
     */
    listenNewTokens(callback) {
        this.#ws.on('message', data => callback(JSON.parse(data)));
    }

    /**
     * Fetches coin data for a given mint.
     *
     * @async
     * @param {string} mint - The mint value of the coin.
     * @return {Promise<Object>} - A promise that resolves with the coin data.
     */
    getCoinData = async mint => await this.#fetchData(`${this.#fetchURL}/coin/${mint}`);

    /**
     * Retrieves the amount from the API based on the provided parameters.
     *
     * @async
     * @param {string} mint - The mint of the token.
     * @param {number} amount - The amount of the token.
     * @param {boolean} isBuy - Indicates whether it is a buy operation.
     * @param {number} [slippage=10] - The slippage amount (default: 10).
     * @returns {Promise<Object>} The amount retrieved from the API.
     */
    getAmount = async (mint, amount, isBuy, slippage = 10) =>
        await this.#fetchData(this._buildUrl("/getAmount", {mint, amount, isBuy, slippage}));


    /**
     * Fetches transaction data using the specified parameters.
     *
     * @async
     * @param {string} mint - The mint address of the transaction.
     * @param {number} amount - The amount of the transaction.
     * @param {boolean} isBuy - Indicates whether the transaction is a buy or sell.
     * @param {string} payer - The address of the payer initiating the transaction.
     * @param {number} [slippage=10] - The slippage in percentage for the transaction (optional, default is 10).
     * @returns {Promise<object>} - A Promise that resolves with the transaction data.
     */
    getTransaction = async (mint, amount, isBuy, payer, slippage = 10) =>
        await this.#fetchData(this._buildUrl("/getTransaction", {mint, amount, isBuy, payer, slippage}));


    /**
     * Fetches data from a specified URL using the Fetch API.
     *
     * @param {string} url - The URL to fetch data from.
     * @returns {Promise<object>} - A Promise that resolves to the fetched data.
     * @throws {Error} - If the response is not successful, an error is thrown.
     *
     * @example
     * fetchData('https://api.example.com/data')
     *   .then(data => {
     *     // Do something with the fetched data
     *   })
     *   .catch(error => {
     *     // Handle error
     *   });
     */
    #fetchData = async url => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, ${JSON.stringify(await response.json())}`);
        }
        return await response.json();
    }
}

export default RPC;