package main

func greetClean(name string) string {
	return "Hello, " + name
}

var xClean string = "hello"
var yClean = 42

func run() {
	println(greetClean(xClean))
}
