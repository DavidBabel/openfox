fn type_ok() {
    let x: i32 = 42;
    println!("{}", x);
}

fn mutability_ok() {
    let mut y = 42;
    y = 100;
    println!("{}", y);
}

fn main() {
    type_ok();
    mutability_ok();
}
