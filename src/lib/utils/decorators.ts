export function bindToThis<T, U extends Function>(func: U, context: ClassMethodDecoratorContext<T>) {
    const methodName = context.name;

    if (context.private) {
        throw new Error(`'bound' cannot decorate private properties like ${methodName as string}.`);
    }

    context.addInitializer(function () {
        (this as any)[methodName] = (this as any)[methodName].bind(this);
    });
}