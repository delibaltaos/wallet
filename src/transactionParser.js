import { MyPublicKey } from './config.js';

export const getActivity = transaction => {
    const transfers = transaction.transaction.message.instructions.filter(
        instruction => instruction.parsed?.type === "transfer"
    );

    if (transfers.length > 0) {
        const tokenDetail = transaction.meta.postTokenBalances.find(
            item => item.owner === MyPublicKey.toString()
        );

        if (tokenDetail) {
            const transferInfos = transaction.meta.innerInstructions
                .flatMap(item => item.instructions)
                .filter(instruction => instruction.parsed?.type === "transfer")
                .map(instruction => instruction.parsed.info);

            const solInfo = transferInfos.find(info => info.authority === MyPublicKey.toString());
            const coinInfo = transferInfos.find(info => info.authority !== MyPublicKey.toString());

            try {
                const cost = parseFloat(solInfo["amount"]) / 1000000000;
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
        } else {
            console.log(transaction);
        }
    }
}