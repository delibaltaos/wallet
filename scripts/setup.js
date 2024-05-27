import {readFile} from 'fs/promises';
import {exec} from 'child_process';

const ERROR_MESSAGE = "Error executing command: ";

async function prepareTasks() {
    try {
        const Tasks = (await import('./tasks.js')).default;
        const tasksJSON = await readFile('./scripts/tasks.json');
        const tasks = JSON.parse(tasksJSON);
        return new Tasks(tasks);
    } catch (e) {
        throw e;
    }
}

async function installNecessaryPackages() {
    console.log("Starting ...");
    return new Promise((resolve, reject) => {
        exec("npm install listr execa", {}, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    })
}

installNecessaryPackages()
    .then(async () => {
        const tasks = await prepareTasks();
        tasks.run();
    })
    .catch(error => {
        console.error(ERROR_MESSAGE, error);
    });