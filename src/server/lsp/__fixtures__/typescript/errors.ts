export function greetError(name: string): string {
    return "Hello, " + name;
}

export let xErr: number = "hello";
export let yErr = 42;
yErr = "world";

console.log(greetError(xErr));
