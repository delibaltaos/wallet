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
    SPL_ACCOUNT_LAYOUT,
    jsonInfo2PoolKeys,
    CurrencyAmount,
    Fraction
} from "./raydium-birdge.cjs";
import {
    Transaction,
    TransactionInstruction
} from '@solana/web3.js'
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
} from "./config.js";

import {
    listenLogs,
    sendAndConfirmTransaction,
    sendTransaction
} from "./connection.js";

import DB from "./db.js";

// import {getNewMint} from "./mint.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { delay } from "./utils.js";
import RPC from "./rpc.js";

class Raydium {
    #poolKeys = {};
    #poolInfos = {};

    #userTokenAccounts;
    #newTokenCallback;
    #slippage = new Percent(50, 100);
    #rpc = new RPC();

    constructor() {
        //
    }

    swap = async(mint, amount, isBuy) => {
        const rawTransaction = await this.#rpc.getTransaction(mint, amount, isBuy, payer.publicKey);
        const transaction = this.#deserializeTransaction(rawTransaction);
        return await sendTransaction(transaction);
    }

    getToken = async mint => this.#deserializeResult(await this.#rpc.getToken(mint));

    getMinAmountOut = async (mint, amount, isBuy, slippage = 10) =>
        this.#deserializeAmount(
            (
                await this.#rpc.getAmount(mint, amount, isBuy, slippage)
            )?.minAmountOut
        );

    #deserializeResult = token => {
        token.poolInfo = this.#deserializePoolInfo(token.poolInfo);
        token.poolKeys = jsonInfo2PoolKeys(token.poolKeys);
        token.token = this.#deserializeToken(token.token);

        return token;
    };

    #deserializeAmount = amount => {
        if (!amount) return;
        return new TokenAmount(
            this.#deserializeToken(amount.token),
            new BN(amount.numerator, 16).toNumber(),
            true
        );
    }

    #deserializeToken = rawToken => {
        return new Token(
            rawToken.programId,
            rawToken.mint,
            rawToken.decimals,
            rawToken.name ?? "UNKNOWN",
            rawToken.symbol ?? "UNKNOWN"
        )
    }

    #deserializePoolInfo = rawPoolInfo => {
        return {
            baseDecimals: rawPoolInfo.baseDecimals,
            baseReserve: new BN(rawPoolInfo.baseReserve, 16),
            lpDecimals: rawPoolInfo.lpDecimals,
            quoteReserve: new BN(rawPoolInfo.quoteReserve, 16),
            quoteDecimals: rawPoolInfo.quoteDecimals,
            lpSupply: new BN(rawPoolInfo.lpSupply, 16),
            startTime: new BN(rawPoolInfo.startTime, 16),
            status: new BN(rawPoolInfo.status, 16)
        }
    }

    #deserializeTransaction = rawTransaction => {
        const transaction = new Transaction({
            recentBlockhash: rawTransaction.recentBlockhash,
            feePayer: new PublicKey(rawTransaction.feePayer),
        });

        rawTransaction.instructions.forEach((instr) => {
            const keys = instr.keys.map(key => ({
                pubkey: new PublicKey(key.pubkey),
                isSigner: key.isSigner,
                isWritable: key.isWritable,
            }));

            const programId = new PublicKey(instr.programId);
            const data = Buffer.from(instr.data);

            const instruction = new TransactionInstruction({ keys, programId, data });
            transaction.add(instruction);
        });

        return transaction;
    }
}

const RaydiumInstance = new Raydium();
export default RaydiumInstance;