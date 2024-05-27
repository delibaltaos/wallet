import {execa} from 'execa';
import Listr from 'listr';
import {config} from './config.js';
import logger from "./logger.js";


const generateTasks2 = (tasks) => {
    return tasks.map(({ title, cmd, args, tasks: subTasks }) => {
        if (subTasks) {
            return {
                title,
                task: () => new Listr(generateTasks2(subTasks), { concurrent: true })
            };
        } else {
            return {
                title,
                task: async (ctx, task) => {
                    try {
                        await execa(cmd, args);
                    } catch (error) {
                        task.skip(`Failed: ${error.message}`);
                        throw error;
                    }
                }
            };
        }
    });
};
/**
 * Generates an array of tasks based on provided task data.
 *
 * @param {Object} taskData - The task data object containing multiple tasks.
 * @param taskNames {Array}
 * @returns {Array} - An array of tasks.
 */
const generateTasks = (taskData, taskNames) => {

    Object.entries(taskData).flatMap(([key, tasks]) =>
        tasks.map(
            ({ title, output, cmd, args, required }) => ({
                title,
                skip: () => required ? false : taskNames && taskNames.length > 0 ? !taskNames.includes(key) : false,
                task: async (ctx, task) => {
                    task.output = output;
                    try {
                        await execa(cmd, args);
                    } catch (error) {
                        console.error(`Error executing task "${title}":`, error);
                        throw error;
                    }
                }
            })
        )
    );
}


/**
 * Runs the specified task asynchronously.
 *
 * @returns {Promise<void>} - A promise that resolves when the task is completed.
 * @throws {Error} - If an error occurs while running the task.
 * @param taskNames {Array}
 */
export const runTasks = async (taskNames) => {
    try {
        logger.info('Starting running tasks...');
        const taskData = await config.taskData();
        const tasks = generateTasks2(Object.values(taskData).flat());
        await new Listr(tasks).run();
    } catch (error) {
        logger.error('Error running tasks:', error);
        throw error;
    }
};
