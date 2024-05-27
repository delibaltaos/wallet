#!/usr/bin/env node

import fs from 'fs/promises';
import { config } from './config.js';

/**
 * Initializes necessary directories for the project.
 *
 * @returns {Promise<void>} - A Promise that resolves when directories are initialized.
 * @throws {Error} - If there is an error initializing directories.
 */
async function initNecessaryDirectories() {
    await fs.mkdir(config.paths.dataDir, { recursive: true });

    const subDirs = [config.paths.dbDir, config.paths.jsonDir];
    for (const dir of subDirs) {
        await fs.mkdir(dir, { recursive: true });
    }
}

initNecessaryDirectories()
    .then(() => console.log('Directories initialized successfully'))
    .catch((error) => console.error('Error initializing directories:', error));