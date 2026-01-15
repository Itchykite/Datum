#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

use once_cell::sync::Lazy;
use sqlx::{mysql::MySqlPoolOptions, MySql, Pool, Row};

static DB_POOL: Lazy<Pool<MySql>> = Lazy::new(|| {
    dotenvy::dotenv().expect("Failed to load .env file");
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    MySqlPoolOptions::new()
        .max_connections(5)
        .connect_lazy(&db_url)
        .expect("Failed to create database pool")
});

#[tauri::command]
async fn get_table_names() -> Result<Vec<String>, sqlx::Error>
{
    let query = "SHOW TABLES";
    let rows = sqlx::query(query)
        .fetch_all(&*DB_POOL)
        .await?
        .map_err(|e| e.to_string())?;

    let table_name: Vec<String> = rows.iter().map(|row| row.get::<String, _>(0)).collect();

    Ok(table_name)
}
