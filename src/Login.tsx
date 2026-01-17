import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./Login.css";

function Login() {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("3307");
  const [user, setUser] = useState("root");
  const [password, setPassword] = useState("root");
  const [dbName, setDbName] = useState("warehouse_db");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsConnecting(true);

    try {
      await invoke("connect_db", {
        details: {
          host,
          port: parseInt(port),
          user,
          password,
          dbName,
        },
      });
    } catch (err) {
      setError(err as string);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Logowanie do Bazy</h2>
        <div className="form-group">
          <label htmlFor="host">Host</label>
          <input
            id="host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="port">Port</label>
          <input
            id="port"
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="user">Użytkownik</label>
          <input
            id="user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Hasło</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="dbName">Nazwa Bazy</label>
          <input
            id="dbName"
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isConnecting}>
          {isConnecting ? "Łączenie..." : "Połącz"}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}

export default Login;
