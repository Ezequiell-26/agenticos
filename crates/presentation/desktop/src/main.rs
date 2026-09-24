#![forbid(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let runtime = tauri::async_runtime::block_on(agenticos_api_server::RuntimeState::from_env())
        .expect("failed to initialize AgentiCOS backend runtime");

    std::thread::spawn(move || {
        tauri::async_runtime::block_on(async move {
            if let Err(error) = agenticos_api_server::run_server(runtime).await {
                eprintln!("AgentiCOS backend stopped: {error}");
            }
        });
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
