import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [tableContent, setTableContent] = useState<any[]>([]);
  const [activeTable, setActiveTable] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Oczekiwanie na połączenie z bazą danych...",
  );
  const [isReady, setIsReady] = useState(false);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isUpdateRecordModalOpen, setIsUpdateRecordModalOpen] = useState(false);

  const fetchTableNames = () => {
    console.log("Pobieram listę tabel...");
    setStatus("Pobieranie listy tabel...");
    setError(null);
    invoke<string[]>("get_table_names")
      .then((names) => {
        console.log("Sukces! Pobrano tabele.", names);
        setTableNames(names);
        setStatus("");
        setIsReady(true);
        if (names.length > 0) {
          if (!activeTable) {
            handleTableSelect(names[0]);
          }
        } else {
          setStatus("Baza danych nie zawiera tabel.");
        }
      })
      .catch((err) => {
        console.error("Błąd podczas pobierania tabel:", err);
        const errorMsg = err.toString();
        setError(errorMsg);
        setStatus(`Błąd: ${errorMsg}`);
        setIsReady(false);
      });
  };

  const handleTableSelect = (tableName: string) => {
    setError(null);
    setActiveTable(tableName);
    setStatus(`Ładowanie danych tabeli ${tableName}...`);
    setTableContent([]);

    invoke<string[]>("get_table_columns", { tableName })
      .then((columns) => {
        setColumnNames(columns);
        return invoke<any[]>("get_table_content", { tableName });
      })
      .then((content) => {
        setTableContent(content);
        setStatus("");
      })
      .catch((err) => {
        const errorMsg = err.toString();
        setError(errorMsg);
        setColumnNames([]);
        setTableContent([]);
        setStatus(`Błąd ładowania tabeli ${tableName}: ${errorMsg}`);
      });
  };

  const insertRecord = (tableName: string, record: Record<string, any>) => {
    return invoke("insert_record", { tableName, record });
  };

  const updateRecord = (
    tableName: string,
    recordId: any,
    updatedRecord: Record<string, any>,
  ) => {
    return invoke("update_record", { tableName, recordId, updatedRecord });
  };

  useEffect(() => {
    let unlistenPromise = listen("database-connected", () => {
      console.log("Odebrano zdarzenie database-connected");
      fetchTableNames();
    });

    return () => {
      unlistenPromise.then((unlistenFn) => unlistenFn());
    };
  }, []);

  if (!isReady) {
    return <div className="status-container">{status}</div>;
  }

  return (
    <>
      {/* Modal dodawnaia rekordu */}
      {isAddRecordModalOpen && (
        <div className="popup-overlay">
          <div className="popup-modal">
            <h2>Dodaj rekord do tabeli {activeTable}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const record: Record<string, any> = {};
                columnNames.forEach((col) => {
                  const value = formData.get(col);
                  record[col] = value === "" ? null : value;
                });
                try {
                  await insertRecord(activeTable, record);
                  alert("Rekord dodany pomyślnie!");
                  handleTableSelect(activeTable);
                  setIsAddRecordModalOpen(false);
                } catch (err) {
                  alert("Błąd podczas dodawania rekordu: " + err);
                }
              }}
            >
              {columnNames.map((col) => (
                <div key={col} className="form-group">
                  <label htmlFor={col}>{col}:</label>
                  <input type="text" id={col} name={col} />
                </div>
              ))}

              <div className="popup-actions">
                <button type="submit">Dodaj rekord</button>
                <button onClick={() => setIsAddRecordModalOpen(false)}>
                  Zamknij
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal aktualizacji rekordu */}
      {isUpdateRecordModalOpen && (
        <div className="popup-overlay">
          <div className="popup-modal">
            <h2>Aktualizuj rekord w tabeli {activeTable}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const recordId = formData.get("recordId");
                const updatedRecord: Record<string, any> = {};
                columnNames.forEach((col) => {
                  if (col !== "id") {
                    const value = formData.get(col);
                    updatedRecord[col] = value === "" ? null : value;
                  }
                });
                try {
                  await updateRecord(activeTable, recordId, updatedRecord);
                  alert("Rekord zaktualizowany pomyślnie!");
                  handleTableSelect(activeTable);
                  setIsUpdateRecordModalOpen(false);
                } catch (err) {
                  alert("Błąd podczas aktualizacji rekordu: " + err);
                }
              }}
            >
              <div className="form-group">
                <label htmlFor="recordId">ID rekordu do aktualizacji:</label>
                <input type="text" id="recordId" name="recordId" required />
              </div>
              {columnNames
                .filter((col) => col !== "id")
                .map((col) => (
                  <div key={col} className="form-group">
                    <label htmlFor={col}>{col}:</label>
                    <input type="text" id={col} name={col} />
                  </div>
                ))}

              <div className="popup-actions">
                <button type="submit">Aktualizuj rekord</button>
                <button onClick={() => setIsUpdateRecordModalOpen(false)}>
                  Zamknij
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Główny interfejs zarządzania bazą danych */}
      <div className="database-manager">
        <aside className="sidebar">
          <div className="sidebar-operations">
            <h3>Operacje</h3>
            <ul>
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsAddRecordModalOpen(true);
                  }}
                >
                  Dodaj rekord
                </a>
              </li>
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsUpdateRecordModalOpen(true);
                  }}
                >
                  Aktualizuj rekord
                </a>
              </li>
            </ul>
          </div>
          <div className="sidebar-tables">
            <h3>Tabele</h3>
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
              {activeTable
                ? `Tabela: ${activeTable}`
                : "Wybierz tabelę z listy"}
            </h1>
            <div className="action-buttons">
              <button className="btn" onClick={fetchTableNames}>
                Odśwież listę tabel
              </button>
            </div>
          </header>
          <div className="table-container">
            {error && <p className="error-message">{error}</p>}
            {status && !error && <p>{status}</p>}
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
                          {row[col] === null || row[col] === undefined ? (
                            <em>NULL</em>
                          ) : (
                            String(row[col])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              !status && activeTable && <p>Tabela jest pusta.</p>
            )}
            {!activeTable && (
              <p>
                Wybierz tabelę z panelu bocznego, aby wyświetlić jej zawartość.
              </p>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
