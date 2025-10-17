import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let publicIp = "unknown";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      publicIp = data.ip;
    } catch (e) {
      console.warn("Не удалось определить внешний IP");
      return "unknown";
    }

    try {
      const result = await login(username, password, publicIp);
      if (result.success) {
        navigate("/admin");
      } else {
        setError(result.error || "Ошибка входа");
      }
    } catch (err) {
      if (
        err.message.includes("429") ||
        err.message.includes("Too Many Requests")
      ) {
        setError("Слишком много попыток входа. Повторите через 15 минут.");
      } else {
        setError("Ошибка соединения с сервером");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Вход в админ-панель</h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Логин:</label>
          <input
            id="username"
            type="text"
            value={username}
            autocomplete="username"
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Пароль:</label>
          <input
            id="password"
            type="password"
            value={password}
            autocomplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
