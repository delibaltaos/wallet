import WebSocket from 'ws';

class RPC {
    #ws;
    #host = "178.62.212.178";
    #port = "3000";
    #fetchURL;

    constructor() {
        this.#fetchURL = `http://${this.#host}:${this.#port}`;
        this.#ws = new WebSocket(`ws://${this.#host}:${this.#port}`);

        this.#ws.on('error', console.error);

        this.#ws.on('open', function open() {
            console.log("web socket connected");
        });
    }

    listenNewTokens(callback) {
        this.#ws.on('message', message = data => callback(JSON.parse(data)));
    }

    getToken = async mint => await this.#fetchData(`${this.#fetchURL}/token/${mint}`);
    
    getAmount = async (mint, amount, isBuy, slippage=10) => 
        await this.#fetchData(`${this.#fetchURL}/getAmount?mint=${mint}&amount=${amount}&isBuy=${isBuy}&slippage=${slippage}`);

    getTransaction = async (mint, amount, isBuy, payer, slippage = 10) => 
        await this.#fetchData(`${this.#fetchURL}/getTransaction?mint=${mint}&amount=${amount}&isBuy=${isBuy}&payer=${payer}&slippage=${slippage}`);

    #fetchData = async url => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, ${JSON.stringify(await response.json())}`);
        }
        return await response.json();
    }
    
}

export default RPC;