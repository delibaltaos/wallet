#!/usr/bin/env node

import { config, ERROR_MESSAGE } from './config.js';
import logger from './logger.js';
import { checkAndInstallPackages } from "./utils.js";
import { animatedLog } from "./utils.js";

let log;
const args = process.argv.slice(2);
const tasks = args;

/**
 * Main function to set up the project.
 *
 * @returns {Promise<void>} - A Promise that resolves when the setup is complete.
 * @throws {Error} - If there is an error in the setup process.
 */
async function main() {
    try {
        await checkAndInstallPackages(config.necessaryPackages);
        await logger.update?.();
        clearInterval(log);
        const { runTasks } = await import('./tasks.js');
        await runTasks(tasks);
    } catch (error) {
        logger.error(ERROR_MESSAGE, error);
    }
}

log = animatedLog("Starting ...");

await main();
