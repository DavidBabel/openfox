fn type_error() {
    let x: i32 = "hello";
    println!("{}", x);
}

fn mutability_error() {
    let y = 42;
    y = 100;
    println!("{}", y);
}

fn main() {
    type_error();
    mutability_error();
}
