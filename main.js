import Wallet from './src/wallet.js';

class Main {
    #tokens = [];
    #isTryingToSell = false;
    #intervalId;

    constructor() {
        this.#initializeWallet().then(() => {
            this.#startSelling()
                .then(() => {
                    console.log('Selling process started.');
                })
                .catch(error => {
                    console.error('Error starting the selling process:', error);
                });
        });
    }

    async #initializeWallet() {
        try {
            await Wallet.start();
            console.log("Wallet Started");
        } catch (error) {
            console.log("Error When Wallet Starting: ", error);
        }

        Wallet.listenMyTokens((tokens) => {
            this.#tokens = tokens;
        });
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
        const promises = this.#tokens.flatMap(token => {
            return [
                this.#sellUsingPriceImpact(token),
                this.#sellUsingTokenCost(token)
            ]
        });

        await Promise.all(promises);

        this.#isTryingToSell = false;
    }

    async #sellUsingPriceImpact(token) {
        const rpAmount = parseInt((token.amount / 100).toFixed(0));
        const {priceImpact, amountOut} = await Wallet.getAmount(token.mint, rpAmount, false, 50);

        if (isNaN(amountOut) && priceImpact > 90 && amountOut >= 0.0001) {
            console.log(`sellUsingPriceImpact mint : ${token.mint}, amountOut: ${amountOut}, priceImpact : ${priceImpact}`);
            await Wallet.sell(token.mint, rpAmount, 50);
        }
    }

    async #sellUsingTokenCost(token) {
        if (token.cost && token.cost > 0) {
            const {amountOut} = await Wallet.getAmount(token.mint, token.amount, false);

            if (!isNaN(amountOut)) {
                const diff = this.#calculatePercentageDifference(token.cost, amountOut);
                console.log(`sellUsingTokenCost mint: ${token.mint}, minAmountOut: ${amountOut}, diff: ${diff}`);
                if (diff > 10) {
                    await Wallet.sell(token.mint, token.amount);
                }
            }
        }
    }

    #calculatePercentageDifference(buyPrice, sellPrice) {
        return ((sellPrice - buyPrice) / buyPrice) * 100;
    }
}

new Main();