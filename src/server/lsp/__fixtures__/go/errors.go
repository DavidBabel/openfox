package main

func greet(name string) string {
	return "Hello, " + name
}

var x int = "hello"
var y = 42
var z = nonexistent

func main() {
	println(greet(x))
}
