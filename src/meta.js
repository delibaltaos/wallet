import { Metaplex } from "@metaplex-foundation/js";
import { ENV, TokenListProvider } from "@solana/spl-token-registry";

/**
 * Represents a class for managing token metadata.
 * @class
 */
class TokenMeta {
    #connection;
    #metaplex;
    #tokenMetaCache = new Map(); // New variable to store token metadata

    constructor(connection) {
        this.#connection = connection;
        this.#metaplex = Metaplex.make(this.#connection);
    }

    /**
     * Retrieves token metadata.
     * @param {PublicKey} mint - The mint of the token.
     * @param {Function} callback - The callback function to be called with the token metadata.
     * @returns {void}
     */
    getTokenMeta(mint, callback) {
        let tokenName;
        let tokenSymbol;
        let tokenLogo;

        // Check if token metadata is already cached
        if (this.#tokenMetaCache.has(mint.toBase58())) {
            const cachedToken = this.#tokenMetaCache.get(mint.toBase58());
            callback(cachedToken);
        } else {
            const metadataAccount = this.#metaplex.nfts().pdas().metadata({ mint: mint });
            this.#connection.getAccountInfo(metadataAccount)
            .then((metadataAccountInfo) => {
                if (metadataAccountInfo) {
                    const token = this.#metaplex.nfts().findByMint({ mint });
                    this.#tokenMetaCache.set(mint.toBase58(), token); // Cache token metadata
                    callback(token);
                } 
                else {
                    const provider = new TokenListProvider();
                    provider.resolve().then(() => {
                        const tokenList = provider.filterByChainId(ENV.MainnetBeta).getList();
                        const tokenMap = tokenList.reduce((map, item) => {
                            map.set(item.address, item);
                            return map;
                        }, new Map());
                        const token = tokenMap.get(mint.toBase58());
                        if (token) {
                            tokenName = token.name;
                            tokenSymbol = token.symbol;
                            tokenLogo = token.logoURI;
                            this.#tokenMetaCache.set(mint.toBase58(), { name: tokenName, symbol: tokenSymbol, logo: tokenLogo }); // Cache token metadata
                            callback({ name: tokenName, symbol: tokenSymbol, logo: tokenLogo });
                        } else {
                            callback(null); // Token not found in the token list
                        }
                    });
                }
            });
        }
    }
}

export { TokenMeta };