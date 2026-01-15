use tauri::Manager;
use tauri::PhysicalSize;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run()
{
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            if let Some(monitor) = window.current_monitor().unwrap()
            {
                let size = monitor.size();
                let size = PhysicalSize {
                    width: size.width as f64,
                    height: size.height as f64,
                };

                window.set_size(size).unwrap();
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
