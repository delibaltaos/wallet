// Import the required dependencies for testing
import { runTasks } from '../scripts/tasks.js'; // assuming that tasks file is in same directory
import { Listr } from 'listr2';
import { readTasks, generateTasks } from './taskUtils'; // assuming task utilities are exported from this file

jest.mock('listr2');
jest.mock('./taskUtils');

describe('runTasks function', () => {
    it('Should run the specified task asynchronously', async () => {
        // Arrange
        const taskName = 'sampleTask';
        const taskData = {name: taskName, details: "sample details"};
        readTasks.mockResolvedValueOnce(taskData);
        
        // Act
        await runTasks(taskName);
        
        // Assert
        expect(readTasks).toHaveBeenCalled();
        expect(generateTasks).toHaveBeenCalledWith(taskData, taskName);
        expect(Listr.prototype.run).toHaveBeenCalled();
    });
    
    it('Should throw an error if there is a problem running tasks', async () => {
        // Arrange
        const taskName = 'errorTask';
        const taskError = new Error('Error running tasks');
        readTasks.mockRejectedValueOnce(taskError);
        
        // Act and Assert
        await expect(runTasks(taskName)).rejects.toThrow(taskError);
        expect(console.error).toHaveBeenCalledWith('Error running tasks:', taskError);
    });
});