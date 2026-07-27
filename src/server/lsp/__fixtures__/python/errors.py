def greet_error(name: str) -> str:
    return "Hello, " + name

x_err: int = "hello"
y_err = 42
y_err = "world"

print(greet_error(x_err))
