import PouchDB from 'pouchdb';
import {createReadStream} from "fs";
import path from 'path';
import PouchDBFind from 'pouchdb-find';

PouchDB.plugin(PouchDBFind);

const dataDir = path.resolve(process.cwd(), 'data/');
const dbDir = path.resolve(dataDir, 'db');
const jsonDir = path.resolve(dataDir, 'jsons');
const SOLMint = "So11111111111111111111111111111111111111112";

const fetchFile = fileName =>
    new Promise((resolve, reject) => {
        let contents = '';

        createReadStream(fileName, { encoding: 'utf8' })
            .on('data', chunk => contents += chunk)
            .on('end', () => {
                try {
                    resolve(JSON.parse(contents));
                } catch (error) {
                    reject(`Error parsing JSON: ${error.message}`);
                }
            })
            .on('error', error => reject(`Error reading file: ${error.message}`));
    });

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
                            await DB.put({ _id: pool.id, ...poolData });
                        } else {
                            await DB.put({ _id: pool.id, ...pool });
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
            index: { fields: ['baseMint'] }
        });

    } catch (error) {
        console.error('Error fetching or storing pool:', error);
    }
}

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
                    const { icon, extensions, ...tokenData } = token;

                    try {
                        await DB.put({ _id: tokenData.mint, ...tokenData });
                    } catch (error) {
                        if (error.status !== 409) {
                            console.error(`Error adding pool ${tokenData.baseMint}:`, error);
                        }
                    }
                }
            }
        }

        await DB.createIndex({
            index: { fields: ['_id'] }
        });
    } catch (error) {
        throw error;
    }
};

const initializeWallet = async () => {}

(async () => {
    try {
        await initializePoolKeys();
        // await initializeTokens();
    } catch (error) {
        throw error;
    }
})();