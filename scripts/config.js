import {readFile} from "fs/promises";

const paths = {
    dataDir: './data',
    dbDir: './data/db',
    jsonDir: './data/jsons',
    tasksFile: './scripts/tasks.json',
};

const urls = {
    poolData: 'https://api.raydium.io/v2/sdk/liquidity/mainnet.json',
    tokensData: 'https://api.raydium.io/v2/sdk/token/raydium.mainnet.json',
};

const necessaryPackages = ['listr', 'execa'];

export const ERROR_MESSAGE = "Error executing command: ";

export const config = {
    paths,
    urls,
    necessaryPackages,
    taskData: async () => {
        try {
            const data = await readFile(paths.tasksFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading tasks file:', error);
            throw error;
        }
    }
};
