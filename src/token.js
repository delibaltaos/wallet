class Token {
    #mint;
    #publicKey;
    #amount;
    #decimals;
    #name;
    #symbol;

    #cost = .0;

    #lastUpdate;
    #buyDate;
    #soldDate;
    #profit = .0;

    constructor(mint, publicKey, decimals) {
        this.#mint = mint;
        this.#publicKey = publicKey;
        this.#decimals = decimals;
        this.#lastUpdate = new Date().getTime();
    }

    set amount(amount) {
        this.#amount = amount;
    }

    set name(name) {
        this.#name = name;
    }

    set symbol(symbol) {
        this.#symbol = symbol;
    }

    set cost(cost) {
        this.#cost = cost;
    }

    get cost() {
        return this.#cost;
    }

    get mint() {
        return this.#mint;
    }

    get publicKey() {
        return this.#publicKey;
    }

    get amount() {
        return this.#amount;
    }

    get decimals() {
        return this.#decimals;
    }

    get mint() {
        return this.#mint;
    }

    get tokenObj() {
        //
    }
}

export default Token;