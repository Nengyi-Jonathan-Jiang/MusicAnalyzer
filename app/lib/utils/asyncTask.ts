
// noinspection JSUnusedGlobalSymbols
/**
 * A wrapper around a vanilla {@link Promise} that exposes two new properties:
 * - isFinished : Whether the promise has resolved successfully
 * - value : The value that the promise resolved with. Attempting to access this before the AsyncTask is finished
 * throws an error.
 */
export class AsyncTask<T> implements PromiseLike<T> {
    #value: T | null = null;
    #isFinished: boolean = false;

    startPromise: () => void;
    readonly #promise: Promise<T>;

    #started: boolean = false;

    /**
     * Creates a task from the promise obtained by executing the given function
     *
     * If lazy is true, the function will not be executed until the task is used
     * (i.e, its methods are called or its properties are accessed)
     */
    constructor(promiseProvider: () => Promise<T>, lazy: boolean = false) {
        this.startPromise = promiseProvider;
        this.#promise = new Promise<T>((resolve, reject) => {
            this.startPromise = () => promiseProvider().then(value => {
                this.#value = value;
                this.#isFinished = true;

                resolve(value);
            });
        });

        if (!lazy) {
            this.start();
        }
    }

    /**
     * Creates a task from an executor. Equivalent to <code> new AsyncTask<T>(new Promise(executor)) </code>
     */
    static fromExecutor<T>(executor: (resolve: (value: T | PromiseLike<T>) => void) => any, lazy: boolean = false): AsyncTask<T> {
        return new AsyncTask<T>(() => new Promise(executor), lazy);
    }

    /**
     * If the task has not started yet (due to the lazy parameter being true), starts the task.
     */
    start() {
        if (this.#started) {
            return;
        }

        this.#started = true;

        this.startPromise();
    }

    /**
     * Calls the given function when the task completes, or immediately if the task is already completed.
     * Note that this differs from {@link Promise.then}, which would invoke callback after the event loop
     * turn in which `then` is called if the task is already completed
     */
    onFinished(callback: (value: T) => any): void {
        if (this.isFinished) {
            callback.call(undefined, this.#value as T);
        } else {
            this.#promise.then(callback);
        }
    }

    /**
     * See {@link Promise.then}
     */
    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2> {
        return this.#promise.then(onfulfilled, onrejected);
    }

    /**
     * Whether the task is finished
     */
    get isFinished(): boolean {
        return this.#isFinished;
    }

    /**
     * The result of the task.
     * If the task is not finished, throws an error
     */
    get value(): T {
        if (!this.isFinished) {
            throw new Error("Cannot access task result before task is finished")
        }
        return this.#value as T;
    }
}

export class AsyncTaskWithDefault<T> extends AsyncTask<T> {
    readonly #defaultValue: T;

    constructor(promiseProvider: () => Promise<T>, defaultValue: T, lazy: boolean = false) {
        super(promiseProvider, lazy);
        this.#defaultValue = defaultValue;
    }

    /**
     * Creates a task from an executor. Equivalent to <code>
     *     new AsyncTaskWithDefault<T>(new Promise(executor), defaultValue)
     * </code>
     */
    static fromExecutorAndDefaultValue<T>(
        executor: (resolve: (value: T | PromiseLike<T>) => void) => any,
        defaultValue: T,
        lazy: boolean = false
    ): AsyncTaskWithDefault<T> {
        return new AsyncTaskWithDefault<T>(() => new Promise(executor), defaultValue, lazy);
    }

    /**
     * The result of the task.
     * If the task is not finished, returns the default value provided
     */
    get value(): T {
        if (this.isFinished) {
            return super.value;
        } else {
            return this.#defaultValue;
        }
    }
}