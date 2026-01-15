import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  return (
    <div className="database-manager">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Bazy Danych</h2>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li className="active">
              <a href="#db-main">GłównaBazaDanych</a>
            </li>
            <li>
              <a href="#db-logs">LogiSystemowe</a>
            </li>
            <li>
              <a href="#db-users">UzytkownicyDB</a>
            </li>
          </ul>
        </nav>
        <div className="sidebar-tables">
          <h3>Tabele</h3>
          // List of tables
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <h1>Tabela: Klienci</h1>
          <div className="action-buttons">
            <button className="btn btn-primary">Dodaj Rekord</button>
            <button className="btn">Odśwież</button>
          </div>
        </header>
        <div className="table-container">
          <table className="data-table">
            <thead> // table headers</thead>
            <tbody>// placeholder data</tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;
