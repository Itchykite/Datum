import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [tableContent, setTableContent] = useState<any[]>([]);
  const [activeTable, setActiveTable] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const pollingRef = useRef<number | null>(null);

  const fetchTableNames = () => {
    console.log("Pobieram listę tabel...");
    setError(null);
    return invoke<string[]>("get_table_names")
      .then((names) => {
        console.log("Sukces! Pobrano tabele.", names);
        setTableNames(names);
        setIsConnected(true);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      })
      .catch((err) => {
        console.error("Błąd podczas pobierania tabel:", err);
        if (isConnected) {
          setError(err.toString());
        }
        throw err;
      });
  };

  const handleTableSelect = (tableName: string) => {
    setError(null);
    setActiveTable(tableName);

    invoke<string[]>("get_table_columns", { tableName })
      .then((columns) => {
        setColumnNames(columns);
        return invoke<any[]>("get_table_content", { tableName });
      })
      .then((content) => {
        setTableContent(content);
      })
      .catch((err) => {
        setError(err.toString());
        setColumnNames([]);
        setTableContent([]);
      });
  };

  useEffect(() => {
    const tryFetch = () => {
      fetchTableNames().catch(() => {
        console.log("Nie udało się połączyć, próbuję ponownie...");
      });
    };

    tryFetch();

    pollingRef.current = window.setInterval(tryFetch, 200);

    const timeoutId = window.setTimeout(() => {
      if (!isConnected) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setError("Nie udało się połączyć z bazą danych w ciągu 5 sekund.");
        console.error("Timeout: Nie udało się połączyć z bazą.");
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      clearTimeout(timeoutId);
    };
  }, []);

  if (!isConnected) {
    return (
      <div className="status-container">
        {error ? `Błąd: ${error}` : "Łączenie z bazą danych..."}
      </div>
    );
  }

  return (
    <div className="database-manager">
      <aside className="sidebar">
        <div className="sidebar-tables">
          <h3>Tabele</h3>
          {error && <div className="error-message">{error}</div>}
          <ul>
            {tableNames.map((name) => (
              <li key={name}>
                <a
                  href="#"
                  className={activeTable === name ? "active-table" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTableSelect(name);
                  }}
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <h1>
            {activeTable ? `Tabela: ${activeTable}` : "Wybierz tabelę z listy"}
          </h1>
          <div className="action-buttons">
            <button className="btn" onClick={fetchTableNames}>
              Odśwież tabele
            </button>
          </div>
        </header>
        <div className="table-container">
          {tableContent.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  {columnNames.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableContent.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columnNames.map((col) => (
                      <td key={`${rowIndex}-${col}`}>
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              {activeTable
                ? "Ładowanie danych..."
                : "Wybierz tabelę z panelu bocznego, aby wyświetlić jej zawartość."}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
