import { useState, useEffect } from "react";
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

  const [selectedRecord, setSelectedRecord] = useState<Record<
    string,
    any
  > | null>(null);
  const [primaryKeyColumn, setPrimaryKeyColumn] = useState<string>("");

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
        if (names.length > 0 && !activeTable) {
          handleTableSelect(names[0]);
        } else if (names.length === 0) {
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
    setSelectedRecord(null);

    invoke<string[]>("get_table_columns", { tableName })
      .then((columns) => {
        setColumnNames(columns);
        const pk = columns.length > 0 ? columns[0] : "";
        setPrimaryKeyColumn(pk);

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
        setSelectedRecord(null);
        setStatus(`Błąd ładowania tabeli ${tableName}: ${errorMsg}`);
      });
  };

  const insertRecord = (tableName: string, record: Record<string, any>) => {
    return invoke("insert_record", { tableName, record });
  };

  const updateRecord = (
    tableName: string,
    recordId: any,
    primaryKeyColumn: string,
    updatedRecord: Record<string, any>,
  ) => {
    return invoke("update_record", {
      tableName,
      recordId: String(recordId),
      primaryKeyColumn,
      updatedRecord,
    });
  };

  useEffect(() => {
    const unlistenPromise = listen("database-connected", () => {
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
      {/* Modal dodawania rekordu */}
      {isAddRecordModalOpen && (
        <div className="popup-overlay">
          <div className="popup-modal">
            <h2>Dodaj rekord do tabeli {activeTable}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const record: Record<string, any> = {};
                columnNames
                  .filter((col) => col !== primaryKeyColumn)
                  .forEach((col) => {
                    const value = formData.get(col);
                    record[col] = value === "" ? null : value;
                  });
                try {
                  await insertRecord(activeTable, record);
                  alert("Rekord dodany pomyślnie!");
                  handleTableSelect(activeTable);
                  setIsAddRecordModalOpen(false);
                } catch (err) {
                  alert("Błąd podczas dodawania rekordu: " + String(err));
                }
              }}
            >
              {columnNames
                .filter((col) => col !== primaryKeyColumn)
                .map((col) => (
                  <div key={col} className="form-group">
                    <label htmlFor={col}>{col}:</label>
                    <input type="text" id={col} name={col} />
                  </div>
                ))}
              <div className="popup-actions">
                <button type="submit">Dodaj rekord</button>
                <button
                  type="button"
                  onClick={() => setIsAddRecordModalOpen(false)}
                >
                  Zamknij
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal aktualizacji rekordu */}
      {isUpdateRecordModalOpen && selectedRecord && (
        <div className="popup-overlay">
          <div className="popup-modal">
            <h2>Aktualizuj rekord w tabeli {activeTable}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updatedRecord: Record<string, any> = {};
                columnNames
                  .filter((col) => col !== primaryKeyColumn)
                  .forEach((col) => {
                    const value = formData.get(col);
                    updatedRecord[col] = value === "" ? null : value;
                  });
                try {
                  const recordId = selectedRecord[primaryKeyColumn];
                  await updateRecord(
                    activeTable,
                    recordId,
                    primaryKeyColumn,
                    updatedRecord,
                  );
                  alert("Rekord zaktualizowany pomyślnie!");
                  handleTableSelect(activeTable);
                  setIsUpdateRecordModalOpen(false);
                } catch (err) {
                  alert("Błąd podczas aktualizacji rekordu: " + String(err));
                }
              }}
            >
              <div className="form-group">
                <label htmlFor={primaryKeyColumn}>
                  {primaryKeyColumn} (ID):
                </label>
                <input
                  type="text"
                  id={primaryKeyColumn}
                  name={primaryKeyColumn}
                  value={selectedRecord[primaryKeyColumn]}
                  readOnly
                />
              </div>
              {columnNames
                .filter((col) => col !== primaryKeyColumn)
                .map((col) => (
                  <div key={col} className="form-group">
                    <label htmlFor={col}>{col}:</label>
                    <input
                      type="text"
                      id={col}
                      name={col}
                      defaultValue={selectedRecord[col] ?? ""}
                    />
                  </div>
                ))}
              <div className="popup-actions">
                <button type="submit">Aktualizuj rekord</button>
                <button
                  type="button"
                  onClick={() => setIsUpdateRecordModalOpen(false)}
                >
                  Zamknij
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Główny interfejs */}
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
                  className={!selectedRecord ? "disabled-link" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    if (selectedRecord) setIsUpdateRecordModalOpen(true);
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
                    <th>Zaznacz</th>
                    {columnNames.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableContent.map((row) => (
                    <tr
                      key={row[primaryKeyColumn]}
                      className={
                        selectedRecord?.[primaryKeyColumn] ===
                        row[primaryKeyColumn]
                          ? "selected-row"
                          : ""
                      }
                    >
                      <td>
                        <input
                          type="radio"
                          name="record-select"
                          checked={
                            selectedRecord?.[primaryKeyColumn] ===
                            row[primaryKeyColumn]
                          }
                          onChange={() => setSelectedRecord(row)}
                        />
                      </td>
                      {columnNames.map((col) => (
                        <td key={`${row[primaryKeyColumn]}-${col}`}>
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
