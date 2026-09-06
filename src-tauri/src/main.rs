// Предотвращает появление окна консоли в release-сборке на Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    volna_lib::run()
}
