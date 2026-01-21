import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

interface NotificationProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

function Notification({ message, type, onClose }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification ${type} show`}>
      <div className="notification-content">{message}</div>
      <div className="notification-progress"></div>
      <button onClick={onClose} className="notification-close-btn">
        &times;
      </button>
    </div>
  );
}

interface ForeignKeyInfo {
  column_name: string;
  referenced_table: string;
  referenced_column: string;
  descriptive_column: string;
  join_alias: string;
}

interface ForeignKeyValue {
  id: any;
  display: string;
}

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
  const [isDeleteRecordModalOpen, setIsDeleteRecordModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Record<
    string,
    any
  > | null>(null);
  const [primaryKeyColumn, setPrimaryKeyColumn] = useState<string>("");
  const [foreignKeys, setForeignKeys] = useState<
    Record<string, ForeignKeyInfo>
  >({});
  const [foreignKeyValues, setForeignKeyValues] = useState<
    Record<string, ForeignKeyValue[]>
  >({});
  const [displayColumns, setDisplayColumns] = useState<string[]>([]);

  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
  };

  const handleLogout = async () => {
    await invoke("disconnect_db");
  };

  const fetchForeignKeyValues = async (fks: Record<string, ForeignKeyInfo>) => {
    const newFkValues: Record<string, ForeignKeyValue[]> = {};
    for (const colName in fks) {
      try {
        const values = await invoke<ForeignKeyValue[]>(
          "get_foreign_key_values",
          { fkInfo: fks[colName] },
        );
        newFkValues[colName] = values;
      } catch (err) {
        console.error(
          `Błąd podczas pobierania wartości klucza obcego dla ${colName}:`,
          err,
        );
        showNotification(
          `Nie udało się pobrać opcji dla pola ${colName}.`,
          "error",
        );
      }
    }
    setForeignKeyValues(newFkValues);
  };

  const openAddModal = () => {
    if (activeTable) {
      fetchForeignKeyValues(foreignKeys);
      setIsAddRecordModalOpen(true);
    }
  };

  const openUpdateModal = () => {
    if (selectedRecord) {
      fetchForeignKeyValues(foreignKeys);
      setIsUpdateRecordModalOpen(true);
    }
  };

  const openDeleteModel = () => {
    if (selectedRecord) {
      setIsDeleteRecordModalOpen(true);
    }
  };

  const fetchTableNames = () => {
    setStatus("Pobieranie listy tabel...");
    setError(null);
    invoke<string[]>("get_table_names")
      .then((names) => {
        setTableNames(names);
        setStatus("");
        setIsReady(true);
        if (names.length > 0 && !activeTable) {
          handleTableSelect(names[0]);
        } else if (activeTable && !names.includes(activeTable)) {
          setActiveTable("");
          setColumnNames([]);
          setTableContent([]);
        } else if (names.length === 0) {
          setStatus("Baza danych nie zawiera tabel.");
        }
      })
      .catch((err) => {
        const errorMsg = String(err);
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

    invoke<{ columns: string[]; foreignKeys: Record<string, ForeignKeyInfo> }>(
      "get_table_columns",
      { tableName },
    )
      .then((schemaInfo) => {
        const { columns, foreignKeys } = schemaInfo;
        setColumnNames(columns);
        setForeignKeys(foreignKeys);

        const fkColumns = Object.keys(foreignKeys);
        const colsToDisplay = columns.filter((col) => !fkColumns.includes(col));
        Object.values(foreignKeys).forEach((fk) => {
          colsToDisplay.push(fk.join_alias);
        });
        setDisplayColumns(colsToDisplay);

        const pk = columns.length > 0 ? columns[0] : "";
        setPrimaryKeyColumn(pk);

        return invoke<any[]>("get_table_content", { tableName });
      })
      .then((content) => {
        setTableContent(content);
        setStatus("");
      })
      .catch((err) => {
        const errorMsg = String(err);
        setError(errorMsg);
        setColumnNames([]);
        setTableContent([]);
        setSelectedRecord(null);
        setStatus(`Błąd ładowania tabeli ${tableName}: ${errorMsg}`);
      });
  };

  const handleInsert = async (record: Record<string, any>) => {
    try {
      await invoke("insert_record", { tableName: activeTable, record });
      showNotification("Rekord dodany pomyślnie!", "success");
      setTimeout(() => {
        setIsAddRecordModalOpen(false);
        handleTableSelect(activeTable);
      }, 50);
    } catch (err) {
      showNotification(
        `Błąd podczas dodawania rekordu: ${String(err)}`,
        "error",
      );
    }
  };

  const handleUpdate = async (updatedRecord: Record<string, any>) => {
    if (!selectedRecord) return;
    try {
      const recordId = selectedRecord[primaryKeyColumn];
      await invoke("update_record", {
        tableName: activeTable,
        recordId: String(recordId),
        primaryKeyColumn,
        updatedRecord,
      });
      showNotification("Rekord zaktualizowany pomyślnie!", "success");
      setTimeout(() => {
        setIsUpdateRecordModalOpen(false);
        handleTableSelect(activeTable);
      }, 50);
    } catch (err) {
      showNotification(
        `Błąd podczas aktualizacji rekordu: ${String(err)}`,
        "error",
      );
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    try {
      const recordId = selectedRecord[primaryKeyColumn];
      await invoke("delete_record", {
        tableName: activeTable,
        recordId: String(recordId),
        primaryKeyColumn,
      });
      showNotification("Rekord usunięty pomyślnie!", "success");
      setTimeout(() => {
        setIsDeleteRecordModalOpen(false);
        setSelectedRecord(null);
        handleTableSelect(activeTable);
      }, 50);
    } catch (err) {
      showNotification(
        `Błąd podczas usuwania rekordu: ${String(err)}`,
        "error",
      );
    }
  };

  const renderFormField = (col: string, defaultValue?: any) => {
    const isForeignKey = foreignKeys[col];
    const finalDefaultValue = defaultValue === null ? "" : defaultValue;

    if (isForeignKey) {
      const options = foreignKeyValues[col] || [];
      return (
        <select
          id={col}
          name={col}
          defaultValue={finalDefaultValue}
          className="form-input"
        >
          <option value="">-- Wybierz --</option>
          {options.map((opt) => (
            <option key={String(opt.id)} value={opt.id}>
              {opt.display}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        id={col}
        name={col}
        defaultValue={finalDefaultValue}
        className="form-input"
      />
    );
  };

  useEffect(() => {
    const unlistenPromise = listen("database-connected", () => {
      fetchTableNames();
    });
    return () => {
      unlistenPromise.then((unlistenFn) => unlistenFn());
    };
  }, []);

  if (!isReady) {
    return (
      <div className="status-container">
        {notification && (
          <Notification
            {...notification}
            onClose={() => setNotification(null)}
          />
        )}
        {status}
      </div>
    );
  }

  return (
    <>
      {notification && (
        <Notification {...notification} onClose={() => setNotification(null)} />
      )}
      {isAddRecordModalOpen && (
        <div className="popup-overlay">
          <div className="popup-modal">
            <h2>Dodaj rekord do tabeli {activeTable}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const record: Record<string, any> = {};
                columnNames
                  .filter((col) => col !== primaryKeyColumn)
                  .forEach((col) => {
                    const value = formData.get(col);
                    record[col] = value === "" ? null : value;
                  });
                handleInsert(record);
              }}
            >
              {columnNames
                .filter((col) => col !== primaryKeyColumn)
                .map((col) => (
                  <div key={col} className="form-group">
                    <label htmlFor={col}>{col}:</label>
                    {renderFormField(col)}
                  </div>
                ))}
              <div className="popup-actions">
                <button type="submit" className="btn-primary">
                  Dodaj rekord
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddRecordModalOpen(false)}
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isUpdateRecordModalOpen && selectedRecord && (
        <div className="popup-overlay">
          <div className="popup-modal">
            <h2>Aktualizuj rekord w tabeli {activeTable}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updatedRecord: Record<string, any> = {};
                columnNames
                  .filter((col) => col !== primaryKeyColumn)
                  .forEach((col) => {
                    const value = formData.get(col);
                    updatedRecord[col] = value === "" ? null : value;
                  });
                handleUpdate(updatedRecord);
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
                  className="form-input"
                />
              </div>
              {columnNames
                .filter((col) => col !== primaryKeyColumn)
                .map((col) => (
                  <div key={col} className="form-group">
                    <label htmlFor={col}>{col}:</label>
                    {renderFormField(col, selectedRecord[col])}
                  </div>
                ))}
              <div className="popup-actions">
                <button type="submit" className="btn-primary">
                  Aktualizuj rekord
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsUpdateRecordModalOpen(false)}
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteRecordModalOpen && selectedRecord && (
        <div className="popup-overlay">
          <div className="popup-modal">
            <h2>Usuń rekord z tabeli {activeTable}</h2>
            <p>
              Czy na pewno chcesz usunąć rekord o ID:{" "}
              {selectedRecord[primaryKeyColumn]}?
            </p>
            <div className="popup-actions">
              <button
                className="btn-danger"
                onClick={() => {
                  handleDelete();
                }}
              >
                Usuń rekord
              </button>
              <button
                className="btn-secondary"
                onClick={() => setIsDeleteRecordModalOpen(false)}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="database-manager">
        <aside className="sidebar">
          <div className="sidebar-operations">
            <h3>Operacje</h3>
            <ul>
              <li>
                <a
                  href="#"
                  className={!activeTable ? "disabled-link" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    if (activeTable) openAddModal();
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
                    if (selectedRecord) openUpdateModal();
                  }}
                >
                  Aktualizuj rekord
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className={!selectedRecord ? "disabled-link" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    if (selectedRecord) openDeleteModel();
                  }}
                >
                  Usuń rekord
                </a>
              </li>
            </ul>
          </div>
          <div className="sidebar-tables">
            <h3>Tabele</h3>
            <ul>
              {tableNames.map((name) => (
                <li
                  key={name}
                  className={activeTable === name ? "active-table" : ""}
                >
                  <a
                    href="#"
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
          <div className="sidebar-footer">
            <a href="#" onClick={handleLogout}>
              Wyloguj
            </a>
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
                    {displayColumns.map((col) => (
                      <th key={col}>{col.replace(/__/g, " → ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableContent.map((row, index) => (
                    <tr
                      key={row[primaryKeyColumn] || index}
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
                      {displayColumns.map((col) => (
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
              !status &&
              activeTable && <p className="empty-state">Tabela jest pusta.</p>
            )}
            {!activeTable && (
              <p className="empty-state">
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
