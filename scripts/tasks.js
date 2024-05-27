import { execa } from 'execa';
import Listr from 'listr';

class Tasks {
    #listr;
    constructor(taskData) {
        const { packages, data, db } = taskData;

        const packagesTasks = packages.map(item => {
            return {
                title: item.title,
                task: async (ctx, task) => {
                    task.output = item.output;
                    await execa(item.cmd, item.args);
                }
            }
        });

        const dataTasks = data.map((item) => {
            return {
                title: item.title,
                task: async (ctx, task) => {
                    task.output = item.output;
                    await execa(item.cmd, item.args);
                }
            }
        });

        const dbTasks = db.map((item) => {
            return {
                title: item.title,
                task: async (ctx, task) => {
                    task.output = item.output;
                    await execa(item.cmd, item.args);
                }
            }
        });

        this.#listr = new Listr();
        this.#listr.add(packagesTasks);
        this.#listr.add(dataTasks);
        this.#listr.add(dbTasks);
    }

    run = () => {
        this.#listr.run().catch(error => {
            console.error(error);
        });
    }
}

export default Tasks;