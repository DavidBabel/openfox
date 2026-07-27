<?php

function greet(string $name): string {
    return "Hello, " . $name;
}

$x = "world";
echo greet($x);
