import {
    buildSimpleTransaction,
    Liquidity,
    LIQUIDITY_STATE_LAYOUT_V4,
    LOOKUP_TABLE_CACHE,
    Market,
    MARKET_STATE_LAYOUT_V3,
    Percent,
    SPL_ACCOUNT_LAYOUT,
    SPL_MINT_LAYOUT,
    Token,
    TOKEN_PROGRAM_ID,
    TokenAmount
} from "./raydium-birdge.cjs";
import BN from "bn.js";

import {LAMPORTS_PER_SOL, PublicKey} from "@solana/web3.js";
import {connection, payer, RAYDIUM_POOL_V4_PROGRAM_ID, TXVersion} from "../config.js";
import {listenLogs} from "../connection.js";
import DB from "../db.js";

class Raydium {
    /**
     * The SOL mint address.
     * @private
     * @type {string}
     */
    #SOL_MINT = "So11111111111111111111111111111111111111112";

    #poolsInfos = new Map();

    #poolKeys = {};
    #poolInfos = {};

    #SOL;
    #userTokenAccounts;

    constructor() {
        const sol = new PublicKey(this.#SOL_MINT);
        this.#SOL = new Token(TOKEN_PROGRAM_ID, sol, 6, "SOL", "Solana");
    }

    /**
     * Subscribes to new Raydium pools.
     * @param {Function} callback - The callback function to be called when a new pool is found.
     */
    listenNewTokens(callback) {
        if (callback === undefined) return;

        console.log("Listening to new tokens...");

        listenLogs(RAYDIUM_POOL_V4_PROGRAM_ID, async txLogs => {
            const { logs, signature } = txLogs;

            if (this.#findLogEntry("error", logs)) return;

            if (
                this.#findLogEntry("init_pc_amount", logs) ||
                this.#findLogEntry("initialize2", logs)
            ) {
                console.log(`New LP init transaction found: ${signature}`);

                try {
                    const pool = await this.#getPoolKeysFromTX(txLogs.signature);
                    console.log(`New pool found: ${pool.baseMint.toBase58()}, ${pool.quoteMint.toBase58()}`);
                    await DB.putPool(pool.id.toString(), JSON.stringify(pool));
                    if (pool.baseMint.toBase58() === "So11111111111111111111111111111111111111112") {
                        callback(pool.quoteMint.toBase58());
                    } else {
                        callback(pool.baseMint.toBase58());
                    }
                } catch (error) {
                    console.log(`error : ${error}, signature: ${signature}`);
                }
            }
        });
    }

    async getTestMint(callback) {
        const signature = "4VdUw8zE4Lr4Ha9W2cMLJhzEYaKKd3E3YAKZnRPYgh35mQePKhq3fM1xRKVifGpLAihEbLwH9CHJHA9wdyomaknh";
        this.#poolKeys = await this.#getPoolKeysFromTX(signature);

        // this.#poolsInfos.set(poolKeys.id, poolKeys);

        // console.log(`New pool found: ${poolKeys.baseMint.toBase58()}, ${poolKeys.quoteMint.toBase58()}`);

        callback(this.#poolKeys.baseMint.toBase58());
    }

    async #getPoolKeysFromTX(tx) {
        const parsedTransaction = await connection.getParsedTransaction(
            tx, { maxSupportedTransactionVersion: 0 }
        );

        const id = this.#getIdFromParsedTransaction(parsedTransaction);

        return await this.#getPoolKeysFromId(id).catch((error) => {
            console.log('error:', error);
            throw error;
        });
    }

    #getIdFromParsedTransaction = parsedTransaction => {
        const initInstruction = parsedTransaction.transaction.message.instructions.find(
            instruction => instruction.programId.equals(RAYDIUM_POOL_V4_PROGRAM_ID)
        );

        if (!initInstruction) {
            throw new Error("Failed to find lp init instruction in lp init tx");
        }

        const id = initInstruction.accounts?.[4];

        if (!id) {
            throw new Error("Failed to find id in lp init instruction");
        }

        return id;
    }

    getMinAmount = async (baseMint, amount, isBuy) => {
        if (this.#userTokenAccounts === undefined) {
            this.#userTokenAccounts = await this.#getOwnerTokenAccounts().catch((error) => {
                console.log('error:', error);
                throw error;
            });
        }

        const poolKeys = await this.#getPoolKeys(baseMint);

        const { minAmountOut } = await this.#getTokenAmount(poolKeys, amount, isBuy)

        return minAmountOut.toFixed();
    }

    async swap(baseMint, amount, isBuy, slippage = 1) {
        if (this.#userTokenAccounts === undefined) { 
            this.#userTokenAccounts = await this.#getOwnerTokenAccounts().catch((error) => {
                console.log('error:', error);
                throw error;
            });
        }

        const poolKeys = await this.#getPoolKeys(baseMint);

        const { amountIn, minAmountOut } = await this.#getTokenAmount(poolKeys, amount, isBuy, slippage).catch((error) => {
            console.log('error:', error);
            throw error;
        });

        console.log('amountIn:', amountIn.toFixed());
        console.log('minAmountOut:', minAmountOut.toFixed());
        
        if (parseFloat(minAmountOut.toFixed()) < 0) 
            return;

        const instructionOptions = {
            connection: connection,
            poolKeys: poolKeys,
            userKeys: {
                tokenAccounts: this.#userTokenAccounts,
                owner: payer.publicKey,
            },
            amountIn: amountIn,
            amountOut: minAmountOut,
            fixedSide: 'in',
            makeTxVersion: TXVersion,
            config: {
                bypassAssociatedCheck: false,
            },
            computeBudgetConfig: {
                microLamports: 100000,
            }
        };

        const { innerTransactions } = await Liquidity.makeSwapInstructionSimple(instructionOptions).catch((error) => {
            console.log('error:', error);
            throw error;
        });

        const transactions = await buildSimpleTransaction({
            connection: connection,
            makeTxVersion: TXVersion,
            payer: payer.publicKey,
            innerTransactions: innerTransactions,
            addLookupTableInfo: LOOKUP_TABLE_CACHE,
        }).catch((error) => {
            console.log('error:', error);
            throw error;
        });

        const transaction = transactions[0];
        transaction.sign(payer);

        const txid = await connection.sendTransaction(transaction, [payer], {
            skipPreflight: true,
            maxRetries: 10,
        }).catch((error) => {
            console.log('error:', error);
            throw error;
        });

        console.log(txid);

        return await connection.confirmTransaction(txid, 'confirmed').catch((error) => {
            console.log('error:', error);
        });
    }

    async #getPoolKeys(baseMint) {
        let poolkeys = this.#poolKeys[baseMint];

        if (poolkeys === undefined) {
            const { _id, _rev, ...pool } = (await DB.getPool(baseMint)).docs?.[0];
            poolkeys = pool;
            this.#poolKeys[pool.baseMint] = poolkeys;
        }

        if (poolkeys) {
            return {
                id: new PublicKey(poolkeys.id),
                baseMint: new PublicKey(poolkeys.baseMint),
                quoteMint: new PublicKey(poolkeys.quoteMint),
                lpMint: new PublicKey(poolkeys.lpMint),
                baseDecimals: new BN(poolkeys.baseDecimals), //
                quoteDecimals: new BN(poolkeys.quoteDecimals), //
                lpDecimals: poolkeys.lpDecimals, //
                version: 4,
                programId: new PublicKey(poolkeys.programId),
                authority: new PublicKey(poolkeys.authority),
                openOrders: new PublicKey(poolkeys.openOrders),
                targetOrders: new PublicKey(poolkeys.targetOrders),
                baseVault: new PublicKey(poolkeys.baseVault),
                quoteVault: new PublicKey(poolkeys.quoteVault),
                withdrawQueue: new PublicKey(poolkeys.withdrawQueue),
                lpVault: new PublicKey(poolkeys.lpVault),
                marketVersion: poolkeys.marketVersion, //
                marketProgramId: new PublicKey(poolkeys.marketProgramId),
                marketId: new PublicKey(poolkeys.marketId),
                marketAuthority: new PublicKey(poolkeys.marketAuthority),
                marketBaseVault: new PublicKey(poolkeys.baseVault),
                marketQuoteVault: new PublicKey(poolkeys.quoteVault),
                marketBids: new PublicKey(poolkeys.marketBids),
                marketAsks: new PublicKey(poolkeys.marketAsks),
                marketEventQueue: new PublicKey(poolkeys.marketEventQueue),
                lookupTableAccount: PublicKey.default
            };
        }
    }

    async #getTokenAmount(poolKeys, rawAmountIn, isBuy) {
        let amountIn,
            currencyOut;

        let poolInfo = this.#poolInfos[poolKeys.id.toBase58()];

        if (!poolInfo) {
            poolInfo = await Liquidity.fetchInfo({
                connection: connection,
                poolKeys: poolKeys
            });

            this.#poolInfos[poolKeys.id.toBase58()] = poolInfo;
        }

        if (isBuy) {
            amountIn = new TokenAmount(this.#SOL, rawAmountIn * LAMPORTS_PER_SOL);
            currencyOut = new Token(TOKEN_PROGRAM_ID, poolKeys.baseMint, poolKeys.baseDecimals.toNumber());
        } else {
            const token = new Token(TOKEN_PROGRAM_ID, poolKeys.baseMint, poolKeys.baseDecimals.toNumber());
            amountIn = new TokenAmount(
                token,
                rawAmountIn * Math.pow(10, poolKeys.baseDecimals.toNumber())
            );
            currencyOut = new Token(TOKEN_PROGRAM_ID, poolKeys.quoteMint, poolKeys.baseDecimals.toNumber())
        }

        const options = {
            poolKeys: poolKeys,
            poolInfo: poolInfo,
            amountIn: amountIn,
            currencyOut: currencyOut,
            slippage: new Percent(10, 100),
        };
        
        const {
            amountOut,
            minAmountOut,
            currentPrice,
            executionPrice,
            priceImpact,
            fee
        } = Liquidity.computeAmountOut(options);

        return {
            amountIn,
            amountOut,
            minAmountOut,
            currentPrice,
            executionPrice,
            priceImpact,
            fee
        }
    }

    async #getPoolKeysFromId(id) {
        let account, info, marketAccount, marketInfo, lpMintAccount, lpMintInfo, authority, marketAuthority;

        // Get Account Info
        try {
            account = await connection.getAccountInfo(id);
        } catch (error) {
            console.log('Error fetching account info:', error);
            throw new Error('Failed to fetch account info');
        }

        // Decode LIQUIDITY_STATE_LAYOUT_V4
        try {
            info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);
        } catch (error) {
            console.log('Error decoding LIQUIDITY_STATE_LAYOUT_V4:', error);
            throw new Error('Failed to decode liquidity state');
        }

        // Ensure marketProgramId and marketId are defined
        if (!info.marketProgramId || !info.marketId) {
            throw new Error('marketProgramId or marketId is undefined');
        }

        // Get Market Account Info
        try {
            marketAccount = await connection.getAccountInfo(info.marketId);
        } catch (error) {
            throw new Error('Failed to fetch market account info');
        }

        // Decode MARKET_STATE_LAYOUT_V3
        try {
            marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);
        } catch (error) {
            console.log('Error decoding MARKET_STATE_LAYOUT_V3:', error);
            throw new Error('Failed to decode market state');
        }

        // Get LP Mint Account Info
        try {
            lpMintAccount = await connection.getAccountInfo(info.lpMint);
        } catch (error) {
            console.log('Error fetching LP mint account info:', error);
            throw new Error('Failed to fetch LP mint account info');
        }

        // Decode SPL_MINT_LAYOUT
        try {
            lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data);
        } catch (error) {
            console.log('Error decoding SPL_MINT_LAYOUT:', error);
            throw new Error('Failed to decode LP mint info');
        }

        // Get Authorities
        try {
            authority = Liquidity.getAssociatedAuthority({ programId: account.owner }).publicKey;
            marketAuthority = Market.getAssociatedAuthority({
                programId: info.marketProgramId,
                marketId: info.marketId
            }).publicKey;
        } catch (error) {
            console.log('Error fetching authorities:', error);
            throw new Error('Failed to fetch authorities');
        }

        // Construct and return pool info
        return {
            id,
            baseMint: info.baseMint,
            quoteMint: info.quoteMint,
            lpMint: info.lpMint,
            baseDecimals: info.baseDecimal,
            quoteDecimals: info.quoteDecimal,
            lpDecimals: lpMintInfo.decimals,
            version: 4,
            programId: account.owner,
            authority: authority,
            openOrders: info.openOrders,
            targetOrders: info.targetOrders,
            baseVault: info.baseVault,
            quoteVault: info.quoteVault,
            withdrawQueue: info.withdrawQueue,
            lpVault: info.lpVault,
            marketVersion: 3,
            marketProgramId: info.marketProgramId,
            marketId: info.marketId,
            marketAuthority: marketAuthority,
            marketBaseVault: marketInfo.baseVault,
            marketQuoteVault: marketInfo.quoteVault,
            marketBids: marketInfo.bids,
            marketAsks: marketInfo.asks,
            marketEventQueue: marketInfo.eventQueue,
            lookupTableAccount: PublicKey.default
        };
    }

    async #getOwnerTokenAccounts() {
        let walletTokenAccount;

        // Fetch token accounts by owner
        try {
            walletTokenAccount = await connection.getTokenAccountsByOwner(
                payer.publicKey,
                { programId: TOKEN_PROGRAM_ID }
            );
        } catch (error) {
            console.log('Error fetching token accounts by owner:', error);
            throw new Error('Failed to fetch token accounts by owner');
        }

        // Ensure the response contains values
        if (!walletTokenAccount || !walletTokenAccount.value) {
            throw new Error('Invalid response: no token accounts found');
        }

        // Decode account info
        let tokenAccounts;
        try {
            tokenAccounts = walletTokenAccount.value.map(i => {
                const accountInfo = SPL_ACCOUNT_LAYOUT.decode(i.account.data);
                return {
                    pubkey: i.pubkey,
                    programId: i.account.owner,
                    accountInfo
                };
            });
        } catch (error) {
            console.log('Error decoding token account data:', error);
            throw new Error('Failed to decode token account data');
        }

        return tokenAccounts;
    }

    /**
     * Finds a log entry in the given log entries.
     * @private
     * @param {string} needle - The string to search for.
     * @param logEntries
     * @returns {string|null} - The found log entry or null if not found.
     */
    #findLogEntry = (needle, logEntries) => logEntries.find(entry => entry.includes(needle)) || null;
}

const RaydiumInstance = new Raydium();
export default RaydiumInstance;