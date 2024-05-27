import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Checks if a package can be dynamically imported.
 *
 * @param {string} pkg - The package name to check.
 * @returns {Promise<boolean>} - A Promise that resolves to true if the package can be imported, false otherwise.
 */
const isPackageInstalled = async pkg => {
    try {
        await import(pkg);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Checks if the necessary packages are installed.
 *
 * @returns {Promise<void>} - A Promise that resolves if packages are already installed or after installing them.
 * @throws {Error} - If there is an error during package installation.
 */
export const checkAndInstallPackages = async deps => {
    const missingPackages = [];

    for (const pkg of deps) {
        const installed = await isPackageInstalled(pkg);
        if (!installed) {
            missingPackages.push(pkg);
        }
    }

    if (missingPackages.length > 0) {
        await execPromise(`npm i ${missingPackages.join(' ')}`);
    }
}

export const animatedLog = (
    text = "",
    chars = ["⠙", "⠘", "⠰", "⠴", "⠤", "⠦", "⠆", "⠃", "⠋", "⠉"],
    delay = 100
) => {
    let x = 0;

    return setInterval(function() {
        process.stdout.write("\r" + chars[x++] + " " + text);
        x = x % chars.length;
    }, delay);
}

