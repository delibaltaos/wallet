import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {connection, MyPublicKey} from './config.js';

export const listenMyLogs = (callback, commitment) => {
    connection.onLogs(MyPublicKey, callback, commitment);
}

export const listenLogs = (publicKey, callback) => {
    connection.onLogs(publicKey, callback);
}

export const getParsedTransaction = async signature => await connection.getParsedTransaction(
    signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
    }
);

export const getTokenAccountsByOwner = async () => {
    //
}

export const sendTransactions = async () => {
    //
}

export const getAccountInfo = async id => await connection.getAccountInfo(id);

export const getParsedTokenAccountsByOwner = async () =>
    await connection.getParsedTokenAccountsByOwner(MyPublicKey, {
        programId: TOKEN_PROGRAM_ID
    });

export const getOwnerTokenAccounts = async () => {
    let walletTokenAccount;

    // Fetch token accounts by owner
    try {
        walletTokenAccount = await connection.getTokenAccountsByOwner(
            MyPublicKey,
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