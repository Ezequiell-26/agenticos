/// Build script for sqlite-migrations crate.
/// Instructs cargo to rebuild when migration files change.
fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
