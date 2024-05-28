import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import path from 'path';

class DB {
    #tokens;
    #pools;
    #wallet;

    constructor() {
        const dataDir = path.resolve(process.cwd(), 'data/db');
        const tokensDBPath = path.resolve(dataDir, 'tokens');
        const poolsDBPath = path.resolve(dataDir, 'pools');
        const walletDBPath = path.resolve(dataDir, 'wallet');

        PouchDB.plugin(PouchDBFind);

        this.#tokens = new PouchDB(tokensDBPath);
        this.#pools = new PouchDB(poolsDBPath);
        this.#wallet = new PouchDB(walletDBPath);
    }

    async #buildIndex() {
        try {
            await this.#pools.createIndex({
                index: {fields: ['baseMint']}
            });

            await this.#pools.createIndex({
                index: {fields: ['quoteMint']}
            });

            await this.#pools.createIndex({
                index: {fields: ['baseMint', 'quoteMint']}
            });

            console.log('Indexes created successfully');
        } catch (err) {
            console.error('Error creating indexes:', err);
        }
    }

    async getWallet(address) {
        return await this.#wallet.get(address);
    }

    async putWallet(wallet) {
        try {
            await this.#wallet.put({
                _id: wallet.address,
                ...wallet
            });
        } catch (error) {
            if (error.status === 409) {
                console.log(`Wallet already exists: ${wallet.address}`);
            } else {
                console.error(`Error adding wallet ${wallet.address}:`, error);
            }
        }
    }

    /**
     * Puts a pool into the data store using the provided id and pool object.
     *
     * @param {Object} pool - The pool object to be stored.
     * @returns {Promise} - A promise that resolves when the pool is successfully stored.
     */
    putPool = async pool => {
        return await this.#pools.put({_id: pool.id, ...pool});
    };

    /**
     * Retrieves a pool based on the provided baseMint.
     *
     * @param {String} mint - The mint value used to filter the pools.
     * @returns {Promise<Object|null>} - The pool object matching the baseMint, or null if no matches were found.
     */
    getPool = async mint => {
        let result = await this.#pools.find({
            selector: {
                baseMint: mint
            }
        });

        if (result.docs.length > 0) {
            return result.docs[0];
        }

        result = await this.#pools.find({
            selector: {
                quoteMint: mint
            }
        });

        if (result.docs.length > 0) {
            return result.docs[0];
        }

        return undefined;
    };

    putToken = async token => await this.#tokens.put({_id: token.mint, ...token});
    getToken = async mint => this.#tokens.get(mint);
}

const DBInstance = new DB();

export default DBInstance;