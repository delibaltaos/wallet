import { payer } from './config.js';
import {LAMPORTS_PER_SOL} from "@solana/web3.js";

export const getActivity = transaction => {
    const tokenDetail = transaction.meta.postTokenBalances.find(
        item => item.owner === payer.publicKey.toString()
    );

    if (tokenDetail) {
        const transferInfos = transaction.meta.innerInstructions
            .flatMap(item => item.instructions)
            .filter(instruction => instruction.parsed?.type === "transfer")
            .map(instruction => instruction.parsed.info);

        const solInfo = transferInfos.find(info => info["authority"] === payer.publicKey.toString());
        const coinInfo = transferInfos.find(info => info["authority"] !== payer.publicKey.toString());

        try {
            const cost = parseFloat(solInfo["amount"]) / LAMPORTS_PER_SOL;
            const mint = tokenDetail.mint;

            return {
                blockTime: transaction.blockTime,
                type: 'buy',
                mint: mint,
                cost: cost,
                amount: parseFloat(coinInfo["amount"])
            }
        } catch (error) {
            console.log(error);
        }
    }
}