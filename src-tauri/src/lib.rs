mod db_conn;
use tauri::Manager;

pub struct DbConnection(pub tokio::sync::Mutex<Option<sqlx::MySqlPool>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DbConnection(Default::default()))
        .setup(|app| {
            if let Some(main_window) = app.get_webview_window("main") {
                main_window.hide()?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            db_conn::connect_db,
            db_conn::disconnect_db,
            db_conn::get_fields_from_table,
            db_conn::get_table_names,
            db_conn::get_table_columns,
            db_conn::get_table_content,
            db_conn::insert_record,
            db_conn::update_record,
            db_conn::delete_record,
            db_conn::get_foreign_key_values,
            db_conn::get_num_of_records
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
