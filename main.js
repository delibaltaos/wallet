import Wallet from './src/wallet.js';

class Main {
    #isTryingToSell = false;
    #intervalId;

    constructor() {
        Wallet.start().then(() => {
            this.#logWallet();

            Wallet.listen(async () => {
                this.#logWallet();
            });

            Wallet.listenNewTokens(async token => {
                if (!token.isMutable && token.isMintable) {
                    await Wallet.buy(token.mint, 0.001);
                }
            });

            this.#startSelling()
                .then(() => {
                    console.log('Selling process started.');
                })
                .catch(error => {
                    console.error('Error starting the selling process:', error);
                });
        })
    }

    async #startSelling() {
        await this.#try2Sell();

        this.#intervalId = setInterval(async () => {
            if (!this.#isTryingToSell) {
                await this.#try2Sell();
            }
        }, 1000);
    }

    async #try2Sell() {
        this.#isTryingToSell = true;

        for (const token of Wallet.tokens) {
            const result = await this.#sellUsingPriceImpact(token);
            if (!result) {
                await this.#sellUsingTokenCost(token);
            }
        }

        this.#isTryingToSell = false;
    }

    async #sellUsingPriceImpact(token) {
        const rpAmount = parseInt((token.amount / 100).toFixed(0));
        const {priceImpact, amountOut} = await Wallet.getAmount(token.mint, rpAmount, false, 50);

        if (isNaN(amountOut) && priceImpact > 90 && amountOut >= 0.0001) {
            console.log(`sellUsingPriceImpact mint : ${token.mint}, amountIn: ${rpAmount}, amountOut: ${amountOut}, priceImpact : ${priceImpact}`);
            const signature = await Wallet.sell(token.mint, rpAmount, 50);
            console.log("signature: ", signature);
            return true;
        }

        return false;
    }

    async #sellUsingTokenCost(token) {
        if (token.cost && token.cost > 0) {
            const {amountOut} = await Wallet.getAmount(token.mint, token.amount, false);

            if (!isNaN(amountOut) && amountOut > 0) {
                const diff = this.#calculatePercentageDifference(token.cost, amountOut);
                console.log(`sellUsingTokenCost mint: ${token.mint}, amountIn: ${token.amount}, minAmountOut: ${amountOut}, diff: ${diff}`);
                if (diff > 0) {
                    const signature = await Wallet.sell(token.mint, token.amount);
                    console.log("signature: ", signature);

                }
            }
        }
    }

    #calculatePercentageDifference(buyPrice, sellPrice) {
        return ((sellPrice - buyPrice) / buyPrice) * 100;
    }

    #logWallet() {
        console.log("Balance : ", Wallet.balance);
        console.log('Vacant Accounts :', Wallet.vacantAccounts);
        console.log('ToBeBurned Accounts: ', Wallet.toBeBurnedAccounts);
        console.log('Tokens : ', Wallet.tokens);
    }
}

new Main();