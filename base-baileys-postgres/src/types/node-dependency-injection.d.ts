declare module 'node-dependency-injection' {
    class ServiceDefinition {
        addArgument(arg: any): this;
    }
    export class ContainerBuilder {
        register(name: string, cls: any): ServiceDefinition;
        get(name: string): any;
    }
}
