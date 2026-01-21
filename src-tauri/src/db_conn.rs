use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{
    mysql::{MySqlPool, MySqlPoolOptions},
    types::{
        chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc},
        BigDecimal,
    },
    Column, Row, TypeInfo, ValueRef,
};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::DbConnection;

#[derive(Deserialize)]
pub struct ConnectionDetails {
    host: String,
    port: u16,
    user: String,
    password: Option<String>,
    #[serde(rename = "dbName")]
    db_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ForeignKeyInfo {
    pub column_name: String,
    pub referenced_table: String,
    pub referenced_column: String,
    pub descriptive_column: String,
    pub join_alias: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ForeignKeyValue {
    pub id: Value,
    pub display: String,
}

#[tauri::command]
pub async fn disconnect_db<R: Runtime>(
    app_handle: AppHandle<R>,
    db_conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let mut pool_guard = db_conn.0.lock().await;
    if let Some(pool) = pool_guard.take() {
        pool.close().await;
    }

    if let Some(login_window) = app_handle.get_webview_window("login") {
        login_window.show().map_err(|e| e.to_string())?;
        login_window.set_focus().map_err(|e| e.to_string())?;
    } else {
        tauri::WebviewWindowBuilder::new(
            &app_handle,
            "login",
            tauri::WebviewUrl::App("login.html".into()),
        )
        .title("Datum - Logowanie")
        .inner_size(400.0, 550.0)
        .resizable(false)
        .build()
        .map_err(|e| e.to_string())?;
    }

    if let Some(main_window) = app_handle.get_webview_window("main") {
        main_window.hide().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn connect_db<R: Runtime>(
    details: ConnectionDetails,
    app_handle: AppHandle<R>,
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
        main_window.show().map_err(|e| e.to_string())?;
        main_window.maximize().map_err(|e| e.to_string())?;
        main_window
            .emit("database-connected", ())
            .map_err(|e| e.to_string())?;
    }

    if let Some(login_window) = app_handle.get_webview_window("login") {
        login_window.hide().map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn get_foreign_keys(
    table_name: &str,
    pool: &MySqlPool,
) -> Result<HashMap<String, ForeignKeyInfo>, sqlx::Error> {
    let query = "
        SELECT
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME
        FROM
            information_schema.KEY_COLUMN_USAGE AS kcu
        WHERE
            kcu.TABLE_SCHEMA = DATABASE()
            AND kcu.TABLE_NAME = ?
            AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ";

    let rows = sqlx::query(query).bind(table_name).fetch_all(pool).await?;
    let mut fks = HashMap::new();

    for row in rows {
        let column_name: String = row.try_get(0)?;
        let referenced_table: String = row.try_get(1)?;
        let referenced_column: String = row.try_get(2)?;

        let descriptive_column = find_descriptive_column(pool, &referenced_table)
            .await
            .unwrap_or_else(|_| referenced_column.clone());

        let join_alias = format!("{}__{}", column_name, descriptive_column);

        fks.insert(
            column_name.clone(),
            ForeignKeyInfo {
                column_name,
                referenced_table,
                referenced_column,
                descriptive_column,
                join_alias,
            },
        );
    }
    Ok(fks)
}

async fn find_descriptive_column(
    pool: &MySqlPool,
    table_name: &str,
) -> Result<String, sqlx::Error> {
    let columns_query =
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION";
    let columns: Vec<String> = sqlx::query(columns_query)
        .bind(table_name)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|row| row.get(0))
        .collect();

    let preferred_names = [
        "name", "username", "title", "label", "nazwa", "login", "tytul",
    ];
    for name in &preferred_names {
        if let Some(found) = columns.iter().find(|c| c.eq_ignore_ascii_case(name)) {
            return Ok(found.clone());
        }
    }

    Ok(columns.get(1).unwrap_or(&columns[0]).clone())
}

fn row_to_json_value(row: &sqlx::mysql::MySqlRow, i: usize) -> Result<Value, sqlx::Error> {
    let raw_val = row.try_get_raw(i)?;
    if raw_val.is_null() {
        return Ok(Value::Null);
    }

    let type_info = raw_val.type_info();
    let val = match type_info.name() {
        "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" | "BIGINT" | "YEAR" => {
            json!(row.try_get::<Option<i64>, _>(i)?)
        }
        "FLOAT" | "DOUBLE" => json!(row.try_get::<Option<f64>, _>(i)?),
        "DECIMAL" | "NEWDECIMAL" => json!(row
            .try_get::<Option<BigDecimal>, _>(i)?
            .map(|d| d.to_string())),
        "DATETIME" => json!(row
            .try_get::<Option<NaiveDateTime>, _>(i)?
            .map(|dt| dt.to_string())),
        "TIMESTAMP" => json!(row
            .try_get::<Option<DateTime<Utc>>, _>(i)?
            .map(|dt| dt.to_rfc3339())),
        "DATE" => json!(row
            .try_get::<Option<NaiveDate>, _>(i)?
            .map(|d| d.to_string())),
        "TIME" => json!(row
            .try_get::<Option<NaiveTime>, _>(i)?
            .map(|t| t.to_string())),
        "BOOLEAN" => json!(row.try_get::<Option<bool>, _>(i)?),
        _ => json!(row.try_get::<Option<String>, _>(i)?),
    };
    Ok(val)
}

fn rows_to_json(rows: Vec<sqlx::mysql::MySqlRow>) -> Result<Vec<Value>, String> {
    rows.into_iter()
        .map(|row| {
            let mut obj = serde_json::Map::new();
            for (i, col) in row.columns().iter().enumerate() {
                let col_name = col.name();
                let val = row_to_json_value(&row, i).map_err(|e| e.to_string())?;
                obj.insert(col_name.to_string(), val);
            }
            Ok(Value::Object(obj))
        })
        .collect::<Result<Vec<Value>, String>>()
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
) -> Result<Value, String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    let sql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION";
    let column_names: Vec<String> = sqlx::query(sql)
        .bind(&table_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|row| row.get(0))
        .collect();

    let foreign_keys = get_foreign_keys(&table_name, &pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "columns": column_names,
        "foreignKeys": foreign_keys
    }))
}

#[tauri::command]
pub async fn get_foreign_key_values(
    fk_info: ForeignKeyInfo,
    db_conn: State<'_, DbConnection>,
) -> Result<Vec<ForeignKeyValue>, String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    let query_str = format!(
        "SELECT `{}` as id, `{}` as display FROM `{}` ORDER BY `{}` ASC",
        fk_info.referenced_column,
        fk_info.descriptive_column,
        fk_info.referenced_table,
        fk_info.descriptive_column
    );

    let rows = sqlx::query(&query_str)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|row| {
            let id_val = row_to_json_value(row, 0).map_err(|e| e.to_string())?;
            let display_val: String = row.try_get("display").map_err(|e| e.to_string())?;
            Ok(ForeignKeyValue {
                id: id_val,
                display: display_val,
            })
        })
        .collect()
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

    let foreign_keys = get_foreign_keys(&table_name, &pool)
        .await
        .map_err(|e| format!("Błąd podczas pobierania kluczy obcych: {}", e))?;

    let mut select_clauses = vec!["`main_table`.*".to_string()];
    let mut join_clauses = Vec::new();

    for (i, fk_info) in foreign_keys.values().enumerate() {
        let join_table_alias = format!("jt{}", i);
        select_clauses.push(format!(
            "`{}`.`{}` AS `{}`",
            join_table_alias, fk_info.descriptive_column, fk_info.join_alias
        ));
        join_clauses.push(format!(
            "LEFT JOIN `{}` AS `{}` ON `main_table`.`{}` = `{}`.`{}`",
            fk_info.referenced_table,
            join_table_alias,
            fk_info.column_name,
            join_table_alias,
            fk_info.referenced_column
        ));
    }

    let query_str = format!(
        "SELECT {} FROM `{}` AS `main_table` {}",
        select_clauses.join(", "),
        table_name,
        join_clauses.join(" ")
    );

    let rows = sqlx::query(&query_str)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    rows_to_json(rows)
}

#[tauri::command]
pub async fn get_fields_from_table(
    table_name: String,
    db_conn: State<'_, DbConnection>,
) -> Result<Vec<String>, String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    let query = format!("DESCRIBE `{}`", table_name);
    let rows = sqlx::query(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let field_names: Vec<String> = rows.into_iter().map(|row| row.get("Field")).collect();

    Ok(field_names)
}

#[tauri::command]
pub async fn insert_record(
    table_name: String,
    record: HashMap<String, serde_json::Value>,
    db_conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    if record.is_empty() {
        return Err("Brak danych do wstawienia".into());
    }

    let columns: Vec<String> = record.keys().cloned().collect();
    let placeholders: Vec<String> = columns.iter().map(|_| "?".to_string()).collect();

    let query = format!(
        "INSERT INTO `{}` ({}) VALUES ({})",
        table_name,
        columns
            .iter()
            .map(|c| format!("`{}`", c))
            .collect::<Vec<_>>()
            .join(", "),
        placeholders.join(", ")
    );

    let mut q = sqlx::query(&query);
    for col in &columns {
        match &record[col] {
            Value::Null => q = q.bind(None::<String>),
            Value::String(s) => q = q.bind(s),
            Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    q = q.bind(i);
                } else if let Some(f) = n.as_f64() {
                    q = q.bind(f);
                } else {
                    q = q.bind(n.to_string());
                }
            }
            Value::Bool(b) => q = q.bind(*b),
            _ => q = q.bind(record[col].to_string()),
        }
    }

    q.execute(&pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_record(
    table_name: String,
    record_id: String,
    primary_key_column: String,
    updated_record: HashMap<String, serde_json::Value>,
    db_conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    if updated_record.is_empty() {
        return Err("Brak danych do aktualizacji".into());
    }

    let set_clauses: Vec<String> = updated_record
        .keys()
        .map(|col| format!("`{}` = ?", col))
        .collect();

    let query = format!(
        "UPDATE `{}` SET {} WHERE `{}` = ?",
        table_name,
        set_clauses.join(", "),
        primary_key_column
    );

    let mut q = sqlx::query(&query);
    for col in updated_record.keys() {
        match &updated_record[col] {
            Value::Null => q = q.bind(None::<String>),
            Value::String(s) => q = q.bind(s),
            Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    q = q.bind(i);
                } else if let Some(f) = n.as_f64() {
                    q = q.bind(f);
                } else {
                    q = q.bind(n.to_string());
                }
            }
            Value::Bool(b) => q = q.bind(*b),
            _ => q = q.bind(updated_record[col].to_string()),
        }
    }

    q = q.bind(record_id);
    q.execute(&pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_record(
    table_name: String,
    record_id: String,
    primary_key_column: String,
    db_conn: State<'_, DbConnection>,
) -> Result<(), String> {
    let pool = {
        let pool_guard = db_conn.0.lock().await;
        pool_guard.clone().ok_or("Brak połączenia z bazą danych")?
    };

    let query = format!(
        "DELETE FROM `{}` WHERE `{}` = ?",
        table_name, primary_key_column
    );

    sqlx::query(&query)
        .bind(record_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
