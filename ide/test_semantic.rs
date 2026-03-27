// Test file for semantic highlighting
const MAX_CONNECTIONS: u32 = 100;
static GLOBAL_CONFIG: &str = "production";

struct UserData {
    name: String,
    age: u32,
    is_active: bool,
}

enum Status {
    Connected,
    Disconnected,
    Pending,
}

trait Connectable {
    fn connect(&self) -> bool;
    fn disconnect(&self);
}

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

macro_rules! debug_print {
    ($($arg:tt)*) => {
        println!($($arg)*);
    };
}

impl Connectable for UserData {
    fn connect(&self) -> bool {
        true
    }
    
    fn disconnect(&self) {
        println!("User {} disconnected", self.name);
    }
}

fn main() {
    let mut user = UserData {
        name: "Alice".to_string(),
        age: 30,
        is_active: true,
    };
    
    let status = Status::Connected;
    let config = GLOBAL_CONFIG;
    
    debug_print!("User: {}, Status: {:?}", user.name, status);
}
