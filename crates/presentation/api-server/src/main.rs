#![forbid(unsafe_code)]

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();
    let runtime = agenticos_api_server::RuntimeState::from_env()
        .await
        .map_err(|error| std::io::Error::other(error.to_string()))?;
    agenticos_api_server::run_server(runtime).await
}
