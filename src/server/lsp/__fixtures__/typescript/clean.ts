export function greetClean(name: string): string {
    return "Hello, " + name;
}

export let xClean: string = "hello";
export let yClean = 42;

console.log(greetClean(xClean));
