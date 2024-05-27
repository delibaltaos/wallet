#!/usr/bin/env node
import {checkAndInstallPackages} from "./utils.js";

const args = process.argv.slice(2);
console.log(args);

checkAndInstallPackages(args).catch(error => {
    throw error;
});