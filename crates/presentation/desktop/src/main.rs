#![forbid(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
async fn send_agent_message_command(
    message: String,
    session_id: Option<String>,
) -> Result<agenticos_desktop::AgentResponse, String> {
    agenticos_desktop::send_agent_message(message, session_id).await
}

#[tauri::command]
async fn get_conversation_history_command(
    session_id: String,
) -> Result<Vec<agenticos_desktop::ConversationEntry>, String> {
    agenticos_desktop::get_conversation_history(session_id).await
}

#[tauri::command]
async fn get_backend_health_command() -> Result<agenticos_desktop::BackendHealth, String> {
    agenticos_desktop::get_backend_health().await
}

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
            send_agent_message_command,
            get_conversation_history_command,
            get_backend_health_command,
        ])
        .setup(|app| {
            configure_runtime_storage(app).map_err(std::io::Error::other)?;

            let runtime =
                tauri::async_runtime::block_on(agenticos_api_server::RuntimeState::from_env())
                    .map_err(|error| {
                        format!("failed to initialize AgentiCOS backend runtime: {error}")
                    })?;

            std::thread::spawn(move || {
                tauri::async_runtime::block_on(async move {
                    if let Err(error) = agenticos_api_server::run_server(runtime).await {
                        eprintln!("AgentiCOS backend stopped: {error}");
                    }
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
