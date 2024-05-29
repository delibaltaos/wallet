import 'dotenv/config';

import {
    Connection,
    Keypair
} from '@solana/web3.js'

import {
    derivePath
} from 'ed25519-hd-key';

import bip39 from 'bip39';

export const connection = new Connection(process.env.RPC_URL, 'confirmed');
export const TXVersion = process.env.TX_VERSION === "VERSIONED" ? 0 : 1;
export const payer = getPayer();

function getPayer() {
    const seed = bip39.mnemonicToSeedSync(process.env.MEMONIC, "");
    const path = `m/44'/501'/0'/0'`;
    const key = derivePath(path, seed.toString("hex")).key;
    return Keypair.fromSeed(key);
}