import { TOKEN_PROGRAM_ID, closeAccount } from '@solana/spl-token';
import { connection, payer } from './config.js';
import {
    Transaction,
    TransactionInstruction,
    PublicKey,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';

let lastSignature = null;
const processedSignatures = new Set();

/**
 * Listens for logs using the provided public key and callback function.
 *
 * @param {PublicKey} publicKey - The public key used to identify the logs.
 * @param {function} callback - The callback function to be invoked when logs are received.
 * @returns {ClientSubscriptionId}
 */
export const listenLogs = (publicKey, callback) =>
    connection.onLogs(publicKey, callback);

export const listenAccountChange = callback =>
    connection.onAccountChange(payer.publicKey, async (accountInfo) => {
        callback(accountInfo.lamports / LAMPORTS_PER_SOL);
    });

export const getBalance = async () => {
    const balance = await connection.getBalance(payer.publicKey);
    return balance / LAMPORTS_PER_SOL;
}
/**
 * Listen for logs.
 *
 * @param {function} callback - The callback function to be invoked when logs are received.
 * @returns {ClientSubscriptionId}
 */
export const listenMyLogs = (callback) =>
    connection.onLogs(payer.publicKey, callback);

/**
 * Retrieves and filters transactions based on the provided signatures.
 *
 * @async
 * @param {Array<string>} signatures - An array of transaction signatures.
 * @returns {Promise<Array<object>>} An array of filtered transactions.
 */
export const getTransactions = async (signatures) => {
    try {
        if (signatures.length > 0) {
            const transactions = await connection.getParsedTransactions(signatures, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            lastSignature = signatures[0];
            signatures.forEach(signature => processedSignatures.add(signature));

            return transactions
                .filter(transaction => transaction && !transaction.meta["status"].Err)
                .filter(transaction => !JSON.stringify(transaction).includes("burn68h9dS2tvZwtCFMt79SyaEgvqtcZZWJphizQxgt"));
        }

        return [];
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
};


/**
 * Retrieves signatures for a given address.
 * @returns {Promise<Array>} - Array of signatures.
 */
export const getSignatures = async () => {
    const options = {
        limit: 100,
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
    };

    if (lastSignature) {
        options.until = lastSignature;
    }

    return (
        await connection.getSignaturesForAddress(payer.publicKey, options)
    )
        .map(signatureInfo => signatureInfo.signature)
        .filter(signature => !processedSignatures.has(signature));
}

/**
 * Fetches parsed token accounts by owner.
 *
 * @returns {Promise<RpcResponseAndContext<Array<{pubkey: PublicKey; account: AccountInfo<ParsedAccountData>}>>>} - Returns a promise that resolves to an array of parsed token accounts.
 * @throws {Error} - Throws an error if there is an error fetching the token accounts.
 *
 * @async
 */
export const getParsedTokenAccountsByOwner = async () => {
    try {
        return await connection.getParsedTokenAccountsByOwner(payer.publicKey, {
            programId: TOKEN_PROGRAM_ID
        });
    } catch (error) {
        console.error('Error fetching token accounts:', error);
        throw error;
    }
};

/**
 * Sends a transaction to the specified connection.
 *
 * @param {string} rawTransaction - The raw transaction data.
 * @return {Promise<Object>} - A promise that resolves to the result of the transaction or rejects with an error.
 * @throws {Error} - If there was an error sending the transaction.
 */
export const sendTransaction = async (rawTransaction) => {
    try {
        const transaction = deserializeTransaction(rawTransaction);
        const blockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.recentBlockhash = blockhash;
        transaction.sign(payer);
        return await connection.sendTransaction(transaction, [payer], {
            skipPreflight: true,
            maxRetries: 10,
        });
    } catch (error) {
        console.error('Error sending transaction:', error);
        throw error;
    }
};

/**
 * Sends a transaction and waits for confirmation.
 *
 * @param {string} rawTransaction - The raw transaction data.
 * @returns {Promise<RpcResponseAndContext<SignatureResult>>} - A promise that resolves when the transaction is confirmed.
 * @throws {Error} - If there was an error sending or confirming the transaction.
 */
export const sendAndConfirmTransaction = async (rawTransaction) =>
    await connection.confirmTransaction(
        await sendTransaction(rawTransaction), 'confirmed'
    );

/**
 * Deserialize a raw transaction object into a Transaction object.
 *
 * @param {object} rawTransaction - The raw transaction object to deserialize.
 * @returns {Transaction} - The deserialized Transaction object.
 * @throws {Error} - If there is an error deserializing the transaction.
 */
export const deserializeTransaction = (rawTransaction) => {
    try {
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
    } catch (error) {
        console.error('Error deserializing transaction:', error);
        throw error;
    }
};

export const close1 = async mint => {
    try {
        const txid = await closeAccount(connection, payer, mint, payer.publicKey, payer.publicKey);
        console.log(txid);
    } catch (error) {
        console.log(error);
    }
}

/**
 * Closes an account by transferring its balance to another account and then closing it.
 *
 * @param {PublicKey} mint - The mint address of the token account to close.
 * @returns {Promise<void>} - A promise that resolves when the account is closed.
 */
/*export const closeAccount = async (mint) => {
    try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(payer.publicKey, {
            mint,
        });

        if (tokenAccounts.value.length === 0) {
            console.error('No token accounts found for this mint address.');
            return;
        }

        const accountToClose = tokenAccounts.value[0].pubkey;
        const transaction = new Transaction().add(
            new TransactionInstruction({
                keys: [
                    { pubkey: accountToClose, isSigner: false, isWritable: true },
                    { pubkey: payer.publicKey, isSigner: false, isWritable: true },
                    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
                ],
                programId: TOKEN_PROGRAM_ID,
                data: Buffer.from([9]), // 9 is the instruction index for CloseAccount in the SPL Token program
            })
        );
        const blockHash = await connection.getRecentBlockhash('confirmed');
        transaction.recentBlockhash = blockHash.blockhash;
        transaction.sign(payer);

        const signature = await connection.sendTransaction(transaction, [payer], {
            skipPreflight: true,
            maxRetries: 10,
        });

        console.log(signature);
        const result = await connection.confirmTransaction(
            signature, 'confirmed'
        );
        // const signature = await web3SendAndConfirmTransaction(connection, transaction, [payer]);

        console.log('Account closed with signature:', signature);
    } catch (error) {
        console.error('Error closing account:', error);
        throw error;
    }
};*/