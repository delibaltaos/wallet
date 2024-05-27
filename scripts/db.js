#!/usr/bin/env node

const args = process.argv.slice(2);
const dbName = args[0];

if (!dbName) {
    console.error('Please provide a DBName as the first argument.');
    process.exit(1);
}

import {createReadStream} from 'fs';
import path from 'path';

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';

PouchDB.plugin(PouchDBFind);

const dataDir = path.resolve(process.cwd(), './data');
const dbDir = path.resolve(dataDir, 'db');
const jsonDir = path.resolve(dataDir, 'jsons');
const SOLMint = "So11111111111111111111111111111111111111112";

/**
 * Fetches and parses a JSON file.
 *
 * @param {string} fileName - The name of the file to fetch.
 * @returns {Promise<Object>} - A Promise that resolves to the parsed JSON content.
 * @throws {Error} - If there is an error reading or parsing the file.
 */
const fetchFile = fileName =>
    new Promise((resolve, reject) => {
        let contents = '';

        createReadStream(fileName, {encoding: 'utf8'})
            .on('data', chunk => contents += chunk)
            .on('end', () => {
                try {
                    resolve(JSON.parse(contents));
                } catch (error) {
                    reject(`Error parsing JSON: ${error.message}`);
                }
            })
            .on('error', error =>
                reject(`Error reading file: ${error.message}`)
            );
    });

/**
 * Initializes pool keys in the database.
 *
 * @returns {Promise<void>} - A Promise that resolves when the pool keys are initialized.
 * @throws {Error} - If there is an error initializing the pool keys.
 */
const initializePoolKeys = async () => {
    const dbPath = path.resolve(dbDir, "pools");
    const poolFile = path.resolve(jsonDir, 'pools.json');

    const DB = new PouchDB(dbPath);

    try {
        const pools = await fetchFile(poolFile);

        const poolCategories = ['official', 'unOfficial'];

        for (const category of poolCategories) {
            if (pools[category]) {
                for (const pool of pools[category]) {
                    try {
                        if (pool.baseMint === SOLMint) {
                            let poolData = pool;
                            poolData.baseMint = poolData.quoteMint;
                            poolData.quoteMint = SOLMint;
                            await DB.put({_id: pool.id, ...poolData});
                        } else {
                            await DB.put({_id: pool.id, ...pool});
                        }
                    } catch (error) {
                        if (error.status !== 409) {
                            console.error(`Error adding pool ${pool.baseMint}:`, error);
                        }
                    }
                }
            }
        }

        await DB.createIndex({
            index: {fields: ['baseMint']}
        });

    } catch (error) {
        console.error('Error fetching or storing pool:', error);
    }
};

/**
 * Initializes tokens in the database.
 *
 * @returns {Promise<void>} - A Promise that resolves when the tokens are initialized.
 * @throws {Error} - If there is an error initializing the tokens.
 */
const initializeTokens = async () => {
    try {
        const dbPath = path.resolve(dbDir, "tokens");
        const tokensFile = path.resolve(jsonDir, 'tokens.json');

        const DB = new PouchDB(dbPath);

        const tokens = await fetchFile(tokensFile);
        const tokenCategories = ['official', 'unOfficial', 'unNamed'];

        for (const category of tokenCategories) {
            if (tokens[category]) {
                for (const token of tokens[category]) {
                    const {icon, extensions, ...tokenData} = token;

                    try {
                        await DB.put({_id: tokenData.mint, ...tokenData});
                    } catch (error) {
                        if (error.status !== 409) {
                            console.error(`Error adding pool ${tokenData.baseMint}:`, error);
                        }
                    }
                }
            }
        }

        await DB.createIndex({
            index: {fields: ['_id']}
        });
    } catch (error) {
        console.error('Error initializing tokens:', error);
        throw error;
    }
};

/*const initializeWallet = async () => {
    // Wallet initialization logic can be added here
};*/

/**
 * Main function to initialize the database.
 *
 * @returns {Promise<void>} - A Promise that resolves when the database is initialized.
 * @throws {Error} - If there is an error during database initialization.
 */

const main = async () => {
    try {
        if (dbName === "pools") {
            await initializePoolKeys();
        } else if (dbName === "tokens") {
            await initializeTokens();
        }
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
};

main().catch(console.error);