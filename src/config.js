import 'dotenv/config';
import {Connection, Keypair, PublicKey} from '@solana/web3.js'
import {derivePath} from 'ed25519-hd-key';
import bip39 from 'bip39';

export const connection = new Connection(process.env.RPC_URL, 'confirmed');
// export const SOL_TOKEN = new Token(TOKEN_PROGRAM_ID, 'So11111111111111111111111111111111111111112', 6);
export const TXVersion = process.env.TX_VERSION === "VERSIONED" ? 0 : 1;
export const payer = getPayer();
export const MyPublicKey = payer.publicKey;

export const RAYDIUM_POOL_V4_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

function getPayer() {
    const seed = bip39.mnemonicToSeedSync(process.env.MEMONIC, "");
    const path = `m/44'/501'/0'/0'`;
    const key = derivePath(path, seed.toString("hex")).key;
    return Keypair.fromSeed(key);
}