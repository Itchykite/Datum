use crate::DbConnection;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{
    mysql::MySqlPoolOptions,
    types::{
        chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc},
        BigDecimal,
    },
    Column, Row, TypeInfo, ValueRef,
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Deserialize)]
pub struct ConnectionDetails {
    host: String,
    port: u16,
    user: String,
    password: Option<String>,
    #[serde(rename = "dbName")]
    db_name: String,
}

#[tauri::command]
pub async fn connect_db(
    details: ConnectionDetails,
    app_handle: AppHandle,
    db_conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let db_url = format!(
        "mysql://{}:{}@{}:{}/{}",
        details.user,
        details.password.unwrap_or_default(),
        details.host,
        details.port,
        details.db_name
    );

    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(|e| format!("Błąd połączenia z bazą danych: {}", e))?;

    *db_conn.0.lock().await = Some(pool);

    if let Some(main_window) = app_handle.get_webview_window("main") {
        main_window.show().unwrap();
        main_window.maximize().unwrap();
        main_window.emit("database-connected", ()).unwrap();
    }

    if let Some(login_window) = app_handle.get_webview_window("login") {
        login_window.close().unwrap();
    }

    Ok(())
}

#[tauri::command]
pub async fn get_table_names(db_conn: State<'_, DbConnection>) -> Result<Vec<String>, String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    sqlx::query("SHOW TABLES")
        .fetch_all(&pool)
        .await
        .map(|rows| rows.into_iter().map(|row| row.get(0)).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_table_columns(
    table_name: String,
    db_conn: State<'_, DbConnection>,
) -> Result<Vec<String>, String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    let sql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION";
    sqlx::query(sql)
        .bind(table_name)
        .fetch_all(&pool)
        .await
        .map(|rows| rows.into_iter().map(|row| row.get(0)).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_table_content(
    table_name: String,
    db_conn: State<'_, DbConnection>,
) -> Result<Vec<Value>, String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    let allowed_tables = get_table_names(db_conn).await?;
    if !allowed_tables.contains(&table_name) {
        return Err(format!("Niedozwolona nazwa tabeli: {}", table_name));
    }

    let query = format!("SELECT * FROM `{}`", table_name);
    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let result: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let mut obj = serde_json::Map::new();
            for (i, col) in row.columns().iter().enumerate() {
                let col_name = col.name();
                let raw_val = row.try_get_raw(i).unwrap();

                let val: Value = if raw_val.is_null() {
                    Value::Null
                } else {
                    match col.type_info().name() {
                        "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" | "BIGINT" | "YEAR" => {
                            json!(row.get::<Option<i64>, _>(i))
                        }
                        "FLOAT" | "DOUBLE" => json!(row.get::<Option<f64>, _>(i)),
                        "DECIMAL" | "NEWDECIMAL" => {
                            json!(row.get::<Option<BigDecimal>, _>(i).map(|d| d.to_string()))
                        }
                        "ENUM" => json!(row.get::<Option<String>, _>(i)),

                        "DATETIME" => json!(row
                            .get::<Option<NaiveDateTime>, _>(i)
                            .map(|dt| dt.to_string())),
                        "TIMESTAMP" => {
                            json!(row
                                .get::<Option<DateTime<Utc>>, _>(i)
                                .map(|dt| dt.to_rfc3339()))
                        }
                        "DATE" => json!(row.get::<Option<NaiveDate>, _>(i).map(|d| d.to_string())),
                        "TIME" => json!(row.get::<Option<NaiveTime>, _>(i).map(|t| t.to_string())),

                        "BOOLEAN" => json!(row.get::<Option<bool>, _>(i)),
                        _ => json!(row.get::<Option<String>, _>(i)),
                    }
                };
                obj.insert(col_name.to_string(), val);
            }
            Value::Object(obj)
        })
        .collect();

    Ok(result)
}
