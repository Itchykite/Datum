import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [tabeNames, setTableNames] = useState([]);
  const [error, setError] = useState(null);

  const fetchTableNames = () => {
    setError(null);
    invoke("get_table_names")
      .then((names) => {
        console.log("Tables from Rust:", names);
        setTableNames(names);
      })
      .catch((err) => {
        console.error("Error fetching table names:", err);
        setError(err.toString());
      });
  };

  useEffect(() => {
    fetchTableNames();
  }, []);

  return (
    <div className="database-manager">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Bazy Danych</h2>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li>
              <a href="#db">warehouse_db</a>
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
            <thead> // table headers</thead>
            <tbody>// placeholder data</tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;
