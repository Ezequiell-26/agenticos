#![forbid(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn configure_runtime_storage(app: &tauri::App) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve AgentiCOS app data directory: {error}"))?;
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create AgentiCOS app data directory: {error}"))?;

    if std::env::var_os("AGENTICOS_DATABASE_URL").is_none() {
        let database_path = app_data_dir.join("agenticos.db");
        let database_path = database_path.to_string_lossy().replace('\\', "/");
        let database_url = if cfg!(windows) {
            format!("sqlite:///{database_path}?mode=rwc")
        } else {
            format!("sqlite://{database_path}?mode=rwc")
        };
        std::env::set_var("AGENTICOS_DATABASE_URL", database_url);
    }

    if std::env::var_os("AGENTICOS_ARTIFACT_ROOT").is_none() {
        std::env::set_var("AGENTICOS_ARTIFACT_ROOT", app_data_dir.join("artifacts"));
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            agenticos_desktop::send_agent_message,
            agenticos_desktop::get_conversation_history,
            agenticos_desktop::get_backend_health,
        ])
        .setup(|app| {
            configure_runtime_storage(app).map_err(std::io::Error::other)?;

            // Backend API server temporarily disabled due to compilation errors
            // TODO: Fix api-server compilation errors and re-enable
            println!("AgentiCOS Desktop frontend running. Backend API server disabled pending fixes.");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
