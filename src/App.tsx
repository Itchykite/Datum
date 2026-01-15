import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [tableContent, setTableContent] = useState<any[]>([]);
  const [activeTable, setActiveTable] = useState("");

  const [error, setError] = useState(null);

  const fetchTableNames = () => {
    setError(null);
    invoke<string[]>("get_table_names")
      .then((names) => {
        setTableNames(names);
      })
      .catch((err) => {
        setError(err.toString());
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
    fetchTableNames();
  }, []);

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
              Wybierz tabelę z panelu bocznego, aby wyświetlić jej zawartość.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
