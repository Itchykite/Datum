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
          <ul>
            <li className="active-table">
              <a href="#table-customers">Klienci</a>
            </li>
            <li>
              <a href="#table-orders">Zamówienia</a>
            </li>
            <li>
              <a href="#table-products">Produkty</a>
            </li>
          </ul>
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
            <thead>
              <tr>
                <th>ID</th>
                <th>Imię</th>
                <th>Nazwisko</th>
                <th>Email</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Jan</td>
                <td>Kowalski</td>
                <td>jan.kowalski@example.com</td>
                <td>
                  <button className="btn-icon">✏️</button>
                  <button className="btn-icon btn-danger">🗑️</button>
                </td>
              </tr>
              <tr>
                <td>2</td>
                <td>Anna</td>
                <td>Nowak</td>
                <td>anna.nowak@example.com</td>
                <td>
                  <button className="btn-icon">✏️</button>
                  <button className="btn-icon btn-danger">🗑️</button>
                </td>
              </tr>
              <tr>
                <td>3</td>
                <td>Piotr</td>
                <td>Zieliński</td>
                <td>piotr.zielinski@example.com</td>
                <td>
                  <button className="btn-icon">✏️</button>
                  <button className="btn-icon btn-danger">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;
