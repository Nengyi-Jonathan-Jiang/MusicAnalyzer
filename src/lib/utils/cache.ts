export interface Cache<T, K extends any[]> {
    has (...key: K): boolean;

    get (...key: K): T;

    clear (): void;
}

export namespace Cache {
    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
    abstract class CacheBase<T, K extends any[] = [], U = string> implements Cache<T, K> {
        private readonly convertKey: (...key: K) => U;
        private readonly compute: (...key: K) => T;

        public constructor (
            compute: (...key: K) => T, convertKey?: (...key: K) => U,
        ) {
            this.compute = compute;
            this.convertKey = convertKey ?? ((...x: K) => x.join('|')) as any;
        }

        abstract clear (): void;

        protected abstract _has (key: U): boolean;

        protected abstract _get (key: U, defaultValue: () => T): T;

        get (...key: K): T {
            return this._get(
                this.convertKey(...key), () => this.compute(...key),
            );
        }

        has (...key: K): boolean {
            return this._has(this.convertKey(...key));
        }
    }

    export class CacheMultiple<T, K extends any[], U = string>
        extends CacheBase<T, K, U> {
        private readonly values: Map<U, T> = new Map;

        _get (key: U, defaultValue: () => T): T {
            let res = this.values.get(key);
            if (res === undefined) {
                res = defaultValue();
                this.values.set(key, res);
            }
            return res;
        }

        _has (key: U): boolean {
            return this.values.has(key);
        }

        clear (): void {
            this.values.clear();
        }
    }

    export class CacheSingle<T, K extends any[] = [], U = string>
        extends CacheBase<T, K, U> {
        private value: [ U, T ] | null = null;

        _get (key: U, defaultValue: () => T): T {
            if (key !== this.value?.[0]) {
                this.value = [ key, defaultValue() ];
            }
            return this.value[1];
        }

        _has (key: U): boolean {
            return key === this.value?.[0];
        }

        clear (): void {
            this.value = null;
        }
    }
}