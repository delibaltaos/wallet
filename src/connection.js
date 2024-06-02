import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { connection, payer } from './config.js';
import {
    Transaction,
    TransactionInstruction,
    PublicKey
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

    const signatures = (
        await connection.getSignaturesForAddress(payer.publicKey, options)
    )
        .map(signatureInfo => signatureInfo.signature)
        .filter(signature => !processedSignatures.has(signature));

    return signatures
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
 * @param {Transaction} transaction - The transaction to be sent.
 * @return {Promise<Object>} - A promise that resolves to the result of the transaction or rejects with an error.
 * @throws {Error} - If there was an error sending the transaction.
 */
export const sendTransaction = async (transaction) => {
    try {
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
export const sendAndConfirmTransaction = async (rawTransaction) => {
    try {
        const transaction = deserializeTransaction(rawTransaction);
        const signature = await sendTransaction(transaction);
        return await connection.confirmTransaction(signature, 'confirmed');
    } catch (error) {
        console.error('Error sending and confirming transaction:', error);
        throw error;
    }
};

/**
 * Deserialize a raw transaction object into a Transaction object.
 *
 * @param {object} rawTransaction - The raw transaction object to deserialize.
 * @returns {Transaction} - The deserialized Transaction object.
 * @throws {Error} - If there is an error deserializing the transaction.
 */
const deserializeTransaction = (rawTransaction) => {
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