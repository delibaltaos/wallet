#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import * as https from "node:https";

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

downloadFile(url, outputPath).catch(error => { throw error; });