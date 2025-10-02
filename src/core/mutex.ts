/**
 * Mutex implementation for serializing database operations
 */

export class Mutex {
    private promise: Promise<void> = Promise.resolve();

    /**
     * Execute a function with mutex protection
     */
    async run<T>(fn: () => Promise<T>): Promise<T> {
        let release!: () => void;
        const wait = new Promise<void>(resolve => (release = resolve));
        const previous = this.promise;
        this.promise = (async () => { 
            await previous; 
            await wait; 
        })();
        
        try { 
            return await fn(); 
        } finally { 
            release(); 
        }
    }
}
