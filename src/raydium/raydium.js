import {
    buildSimpleTransaction,
    Liquidity,
    LIQUIDITY_STATE_LAYOUT_V4,
    LOOKUP_TABLE_CACHE,
    Market,
    MARKET_STATE_LAYOUT_V3,
    Percent,
    SPL_MINT_LAYOUT,
    Token,
    TokenAmount,
    MAINNET_PROGRAM_ID,
    SPL_ACCOUNT_LAYOUT
} from "./raydium-birdge.cjs";

import BN from "bn.js";

// poolKeys2JsonInfo
// jsonInfo2PoolKeys
// Price

import {
    LAMPORTS_PER_SOL,
    PublicKey
} from "@solana/web3.js";

import {
    connection,
    payer,
    TXVersion
} from "../config.js";

import {
    listenLogs,
    sendAndConfirmTransaction
} from "../connection.js";

import DB from "../db.js";

import {getNewMint} from "./mint.js";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {delay} from "../utils.js";

class Raydium {
    #poolKeys = {};
    #poolInfos = {};

    #userTokenAccounts;
    #newTokenCallback;
    #slippage = new Percent(50, 100);

    constructor() {
        this.#getOwnerTokenAccounts().then(userTokenAccounts => {
            this.#userTokenAccounts = userTokenAccounts;
        });
    }

    listenNewTokens = callback => {
        if (callback === undefined) return;
        this.#newTokenCallback = callback;
        console.log("Listening to new tokens...");

        listenLogs(MAINNET_PROGRAM_ID.AmmV4, this.#parseTxLogs);
    }

    async swap(mint, amount, isBuy, slippage) {
        const transaction = await this.#getTransaction(
            mint,
            amount,
            isBuy,
            slippage
        );

        if (transaction) {
            return await sendAndConfirmTransaction(transaction);
        } else {
            console.log(`Transaction is undefined mint: ${mint}, amount: ${amount.toFixed()}, isBuy: ${isBuy}`);
        }
    }

    async getTestMint(callback) {
        const signature = "4VdUw8zE4Lr4Ha9W2cMLJhzEYaKKd3E3YAKZnRPYgh35mQePKhq3fM1xRKVifGpLAihEbLwH9CHJHA9wdyomaknh";
        this.#poolKeys = await this.#getPoolKeysFromTX(signature);

        // this.#poolsInfos.set(poolKeys.id, poolKeys);

        // console.log(`New pool found: ${poolKeys.baseMint.toBase58()}, ${poolKeys.quoteMint.toBase58()}`);

        callback(this.#poolKeys.baseMint.toBase58());
    }

    getMinAmount = async (baseMint, amount, isBuy, slippage) => {
        const pool = await this.#getPool(baseMint);
        const token = await this.#getToken(pool.poolKeys);

        const {amountOut, priceImpact} = await this.#getTokenAmount(token, pool, amount, isBuy, slippage);

        return {
            amountOut: amountOut.toFixed(),
            priceImpact: priceImpact.toFixed()
        }
    }

    #getTransaction = async (mint, amount, isBuy, slippage) => {
        const pool = await this.#getPool(mint);
        const token = this.#getToken(pool.poolKeys);

        const {
            amountIn,
            amountOut,
            minAmountOut,
            currentPrice,
            executionPrice,
            priceImpact,
            fee
        } = await this.#getTokenAmount(
            token,
            pool,
            amount,
            isBuy,
            slippage
        );

        console.log(
            "amountIn: ", amountIn.toFixed(),
            " amountOut: ", amountOut.toFixed(),
            " minAmountOut: ", minAmountOut.toFixed()
        );

        const {innerTransactions} = await Liquidity
            .makeSwapInstructionSimple({
                connection: connection,
                poolKeys: pool.poolKeys,
                userKeys: {
                    tokenAccounts: this.#userTokenAccounts,
                    owner: payer.publicKey,
                },
                amountIn: amountIn,
                amountOut: amountOut,
                fixedSide: 'in',
                makeTxVersion: TXVersion,
                config: {
                    bypassAssociatedCheck: false,
                },
                computeBudgetConfig: {
                    microLamports: 100000,
                }
            });

        const transactions = await buildSimpleTransaction({
            connection: connection,
            makeTxVersion: TXVersion,
            payer: payer.publicKey,
            innerTransactions: innerTransactions,
            addLookupTableInfo: LOOKUP_TABLE_CACHE
        });

        return transactions?.[0];
    }

    #parseTxLogs = async txLogs => {
        const {logs, signature} = txLogs;

        if (this.#findLogEntry("error", logs)) return;

        if (
            this.#findLogEntry("init_pc_amount", logs) ||
            this.#findLogEntry("initialize2", logs)
        ) {
            console.log(`New LP init transaction found: ${signature}`);

            try {
                const pool = await this.#getPoolKeysFromTX(txLogs.signature);
                const baseMint = pool.baseMint;
                const quoteMint = pool.quoteMint;

                // const result = await getNewMint(baseMint.toBase58());

                console.log(`New pool found: ${baseMint.toBase58()}, ${quoteMint.toBase58()}`);

                const poolKeys = JSON.parse(JSON.stringify(pool));
                await DB.putPool(poolKeys);

                await delay(10000);
                if (baseMint.toBase58() === "So11111111111111111111111111111111111111112") {
                    this.#newTokenCallback(quoteMint.toBase58());
                } else {
                    this.#newTokenCallback(baseMint.toBase58());
                }
            } catch (error) {
                console.log(`error : ${error}, signature: ${signature}`);
            }
        }
    }

    #getPoolKeysFromTX = async tx => {
        const parsedTransaction = await connection.getParsedTransaction(
            tx, {
                maxSupportedTransactionVersion: 0
            }
        );

        const id = this.#getIdFromParsedTransaction(parsedTransaction);

        return await this.#getPoolKeysFromId(id);
    }

    #getIdFromParsedTransaction = parsedTransaction => {
        const initInstruction = parsedTransaction?.transaction?.message?.instructions?.find(
            instruction => instruction.programId.equals(MAINNET_PROGRAM_ID.AmmV4)
        );

        if (!initInstruction)
            throw new Error("Failed to find lp init instruction in lp init tx");

        const id = initInstruction.accounts?.[4];

        if (!id)
            throw new Error("Failed to find id in lp init instruction");

        return id;
    }

    #getPool = async mint => {
        const poolKeys = await this.#getPoolKeys(mint);
        const poolInfo = await this.#getPoolInfo(poolKeys);

        return {
            poolKeys,
            poolInfo
        }
    }

    #getToken = poolKeys => {
        const mint = poolKeys.baseMint.equals(Token.WSOL.mint) ?
            poolKeys.quoteMint.toBase58() :
            poolKeys.baseMint.toBase58();

        const decimals = poolKeys.baseMint.equals(Token.WSOL.mint) ?
            poolKeys.quoteDecimals.toNumber() :
            poolKeys.baseDecimals.toNumber();

        return new Token(
            TOKEN_PROGRAM_ID,
            new PublicKey(mint),
            decimals,
            "Unknown",
            "Unknown"
        );
    }

    #getPoolInfo = async poolKeys => {
        let poolInfo = this.#poolInfos[poolKeys.id];

        if (!poolInfo) {
            poolInfo = await Liquidity.fetchInfo({
                connection: connection,
                poolKeys: poolKeys
            }).catch(error => {
                console.log(error);
            });

            this.#poolInfos[poolKeys.id] = poolInfo;
        }

        return this.#poolInfos[poolKeys.id];
    }

    #getPoolKeys = async baseMint => {
        let poolKeys = this.#poolKeys[baseMint];

        if (!poolKeys) {
            const result = await DB.getPool(baseMint);

            if (!result) {
                const result = await getNewMint(baseMint);
                if (result?.id) {
                    const id = new PublicKey(result.id);
                    const newPoolKeys = await this.#getPoolKeysFromId(id);
                    const newPoolKeysJSON = JSON.parse(JSON.stringify(newPoolKeys));
                    await DB.putPool(newPoolKeysJSON);
                    poolKeys = newPoolKeys;
                }
            } else {
                const {_id, _rev, ...pool} = result;
                poolKeys = pool;
            }

            this.#poolKeys[baseMint] = poolKeys;
        }

        if (poolKeys) {
            return {
                id: new PublicKey(poolKeys.id),
                baseMint: new PublicKey(poolKeys.baseMint),
                quoteMint: new PublicKey(poolKeys.quoteMint),
                lpMint: new PublicKey(poolKeys.lpMint),
                baseDecimals: new BN(poolKeys.baseDecimals), //
                quoteDecimals: new BN(poolKeys.quoteDecimals), //
                lpDecimals: poolKeys.lpDecimals, //
                version: 4,
                programId: new PublicKey(poolKeys.programId),
                authority: new PublicKey(poolKeys.authority),
                openOrders: new PublicKey(poolKeys.openOrders),
                targetOrders: new PublicKey(poolKeys.targetOrders),
                baseVault: new PublicKey(poolKeys.baseVault),
                quoteVault: new PublicKey(poolKeys.quoteVault),
                withdrawQueue: new PublicKey(poolKeys.withdrawQueue),
                lpVault: new PublicKey(poolKeys.lpVault),
                marketVersion: poolKeys.marketVersion, //
                marketProgramId: new PublicKey(poolKeys.marketProgramId),
                marketId: new PublicKey(poolKeys.marketId),
                marketAuthority: new PublicKey(poolKeys.marketAuthority),
                marketBaseVault: new PublicKey(poolKeys.baseVault),
                marketQuoteVault: new PublicKey(poolKeys.quoteVault),
                marketBids: new PublicKey(poolKeys.marketBids),
                marketAsks: new PublicKey(poolKeys.marketAsks),
                marketEventQueue: new PublicKey(poolKeys.marketEventQueue),
                lookupTableAccount: PublicKey.default
            };
        }
    }

    #getTokenAmount = async (token, pool, amount, isBuy, slippage) => {
        let amountIn,
            currencyOut;

        let _slp = this.#slippage;

        if (slippage) {
            _slp = new Percent(slippage, 100);
        }

        const {
            poolKeys,
            poolInfo
        } = pool;

        if (isBuy) {
            amountIn = new TokenAmount(Token.WSOL, amount * LAMPORTS_PER_SOL);
            currencyOut = token;
        } else {
            amountIn = new TokenAmount(token, amount * Math.pow(10, token.decimals));
            currencyOut = Token.WSOL;
        }

        const options = {
            poolKeys: poolKeys,
            poolInfo: poolInfo,
            amountIn: amountIn,
            currencyOut: currencyOut,
            slippage: _slp,
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

    #getPoolKeysFromId = async id => {
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
            authority = Liquidity.getAssociatedAuthority({programId: account.owner}).publicKey;
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
                {programId: TOKEN_PROGRAM_ID}
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

    #findLogEntry = (needle, logEntries) => logEntries.find(entry => entry.includes(needle)) || null;
}

const RaydiumInstance = new Raydium();
export default RaydiumInstance;