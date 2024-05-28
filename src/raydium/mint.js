export const getNewMint = async baseMint => {
    try {
        const response = await fetch(`https://api.raydium.io/v2/sdk/liquidity/mint/${baseMint}/So11111111111111111111111111111111111111112`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}