use once_cell::sync::Lazy;
use serde_json::{json, Value};
use sqlx::{
    mysql::MySqlPoolOptions,
    types::{
        chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc},
        BigDecimal,
    },
    Column, MySql, Pool, Row, TypeInfo, ValueRef,
};
use std::env;

static DB_POOL: Lazy<Pool<MySql>> = Lazy::new(|| {
    dotenvy::dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    MySqlPoolOptions::new()
        .max_connections(5)
        .connect_lazy(&db_url)
        .expect("Failed to create database pool")
});

#[tauri::command]
pub async fn get_table_names() -> Result<Vec<String>, String> {
    let query = "SHOW TABLES";
    sqlx::query(query)
        .fetch_all(&*DB_POOL)
        .await
        .map(|rows| rows.into_iter().map(|row| row.get(0)).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_table_columns(table_name: String) -> Result<Vec<String>, String> {
    let sql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION";
    sqlx::query(sql)
        .bind(table_name)
        .fetch_all(&*DB_POOL)
        .await
        .map(|rows| rows.into_iter().map(|row| row.get(0)).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_table_content(table_name: String) -> Result<Vec<Value>, String> {
    let allowed_tables = get_table_names().await?;
    if !allowed_tables.contains(&table_name) {
        return Err(format!("Niedozwolona nazwa tabeli: {}", table_name));
    }
    let query = format!("SELECT * FROM `{}`", table_name);
    let rows = sqlx::query(&query)
        .fetch_all(&*DB_POOL)
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
