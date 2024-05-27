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

    async getWallet(address) {
        try {
            return await this.#wallet.get(address);
        } catch (error) {
            if (error.status === 404) {
                console.log(`Wallet not found: ${address}`);
            } else {
                console.error(`Error getting wallet ${address}:`, error);
            }
        }
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

    putPool = async (id, pool) => {
        const obj = {_id: id, ...pool}

        const result = await this.#pools.put(obj).catch((error) => {
            console.log(error);
        });
        return result;
    };
    getPool = async baseMint => {
        const result = await this.#pools.find({
            selector: {
                baseMint: baseMint
            }
        });

        return result;
    }

    putToken = async token => await this.#tokens.put({_id: token.mint, ...token});
    getToken = mint => this.#tokens.get(mint);
}

const DBInstance = new DB();

export default DBInstance;