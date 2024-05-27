#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import * as https from 'https';

const args = process.argv.slice(2);
const url = args[0];
const outputPath = args[1];

if (!url) {
    console.error('Please provide a URL as the first argument.');
    process.exit(1);
}

if (!outputPath) {
    console.error('Please provide an output path as the second argument.');
    process.exit(1);
}

/**
 * Downloads a file from the given URL to the specified output path.
 *
 * @param {string} url - The URL to download the file from.
 * @param {string} outputPath - The local file path to save the downloaded file.
 * @returns {Promise<void>} - A Promise that resolves when the file is downloaded.
 * @throws {Error} - If there is an error downloading the file.
 */
const downloadFile = async (url, outputPath) => {
    const absoluteOutputPath = path.resolve(process.cwd(), outputPath);

    return new Promise((resolve, reject) => {
        https
            .get(url, (response) => {
                const file = fs.createWriteStream(absoluteOutputPath);
                response.pipe(file);
                file.on('finish', () => file.close(resolve));
            })
            .on('error', (err) => fs.unlink(outputPath, () => reject(err)));
    });
};

downloadFile(url, outputPath).catch(error => {
    console.error('Error downloading file:', error);
    process.exit(1);
});
