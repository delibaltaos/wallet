import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {connection, payer} from './config.js';

export const listenLogs = (publicKey, callback) =>
    connection.onLogs(publicKey, callback);

export const listenMyLogs = callback =>
    connection.onLogs(payer.publicKey, callback);

export const getParsedTransaction = async signature =>
    await connection
        .getParsedTransaction(
            signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            }
        );

export const getTransactions = async mint => {
    const signatures = (
        await connection.getSignaturesForAddress(
            payer.publicKey, {
                limit: 100
            }
        )
    ).map(signature => signature.signature);

    if (signatures.length > 0) {
        const transactions = await connection.getParsedTransactions(signatures, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });

        return transactions
            .filter(transaction => !transaction.meta.status.Err)
            .filter(transaction => JSON.stringify(transaction).includes(mint))
            .filter(transaction => !JSON.stringify(transaction).includes("burn68h9dS2tvZwtCFMt79SyaEgvqtcZZWJphizQxgt"));
    }

    return [];
}


export const getParsedTokenAccountsByOwner = async () =>
    await connection.getParsedTokenAccountsByOwner(payer.publicKey, {
        programId: TOKEN_PROGRAM_ID
    });

export const sendTransaction = async transaction => {
    transaction.sign(payer);

    return await connection.sendTransaction(transaction, [payer], {
        skipPreflight: true,
        maxRetries: 10,
    });
}

export const sendAndConfirmTransaction = async transaction =>
    await connection.confirmTransaction(
        await sendTransaction(transaction),
        'confirmed'
    );