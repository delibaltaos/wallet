let logger;

async function generateLogger() {
    try {
        const { createLogger, format, transports } = await import('winston');
        const { combine, timestamp, printf } = format;

        const myFormat = printf(({ level, message, timestamp }) => {
            return `${timestamp} [${level}]: ${message}`;
        });

        return createLogger({
            level: 'info',
            format: combine(
                timestamp(),
                myFormat
            ),
            transports: [
                new transports.Console(),
                new transports.File({ filename: 'app.log' })
            ],
        });
    } catch (e) {
        return {
            info: (msg) => console.log(`info: ${msg}`),
            warn: (msg) => console.log(`warn: ${msg}`),
            error: (msg) => console.log(`error: ${msg}`),
            update: async () => {
                logger = await generateLogger();
            }
        };
    }
}


logger = await generateLogger();

export default logger;