class Token {
    #mint;
    #decimals;
    #name;
    #symbol;

    #isMutable;
    #isMintable;
    #hasFreeze;
    #image;
    #description;
    #twitter;
    #telegram;
    #website;

    #amount;
    #cost = .0;
    #buyDate;

    constructor(object, amount) {
        const {
            mint,
            decimals,
            name,
            symbol,
            isMutable,
            isMintable,
            hasFreeze,
            image,
            description,
            twitter,
            website
        } = object;

        this.#mint = mint;
        this.#decimals = decimals;
        this.#name = name;
        this.#symbol = symbol;
        this.#isMutable = isMutable;
        this.#isMintable = isMintable;
        this.#hasFreeze = hasFreeze;
        this.#image = image;
        this.#description = description;
        this.#twitter = twitter;
        this.#website = website;

        this.#amount = amount;
    }

    get mint() {
        return this.#mint;
    }

    set amount(amount) {
        this.#amount = amount;
    }

    get amount() {
        return this.#amount;
    }

    set cost(cost) {
        this.#cost = cost;
    }

    get cost() {
        return this.#cost;
    }

    get decimals() {
        return this.#decimals;
    }

    get isMutable() {
        return this.#isMutable;
    }

    get isMintable() {
        return this.#isMintable;
    }

    get hasFreeze() {
        return this.#hasFreeze;
    }

    get image() {
        return this.#image;
    }

    get description() {
        return this.#description;
    }

    get twitter() {
        return this.#twitter;
    }

    get telegram() {
        return this.#telegram;
    }

    get website() {
        return this.#website;
    }
}

export default Token;