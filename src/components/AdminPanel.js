// src/components/AdminPanel.js
import React, { useState, useEffect } from "react";
import VideoManager from "./VideoManager";
import DevicesTable from "./DevicesTable";
import GlobalActions from "./GlobalActions";
import Layout from "./Layout";
import ActiveSessions from "./ActiveSessions";
import VideoPlayer from "./VideoPlayer";
import CitySwitcher from "./CitySwitcher";
import { useCity } from "./CityContext";
import {
  getStatus,
  getScriptStatus,
  sendDeviceCommand,
  restartAllDevices,
  runConcatScript,
} from "../services/api";
import { isAuthenticated, getCurrentUser } from "../services/authService";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { changeCity } = useCity();
  const currentUser = getCurrentUser();

  
  const isAdmin = currentUser?.role === "admin";
  const isModerator = currentUser?.role === "moderator";

  const [serverData, setServerData] = useState(null);
  const [localTime, setLocalTime] = useState(new Date());
  const [devices, setDevices] = useState([]);

  const handleCityChange = (city) => {
    changeCity(city);
  };

  // Защита маршрута
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
    }
  }, [navigate]);

  // Загрузка статуса с сервера
  const fetchStatus = async () => {
    try {
      const data = await getStatus();
      setServerData(data);
      setDevices(data.devices || []);
    } catch (e) {
      if (e.message === "Требуется повторная авторизация") {
        setServerData({ error: "Сессия истекла. Пожалуйста, войдите снова." });
        toast.error("Сессия истекла. Пожалуйста, войдите снова.");
      } else {
        setServerData({ error: "Ошибка загрузки статуса" });
        toast.error("Ошибка загрузки статуса");
      }
    }
  };

  // Таймер для обновления времени каждую секунду
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Мониторинг скрипта обработки видео
  const monitorScriptProgress = () => {
    const interval = setInterval(async () => {
      try {
        const data = await getScriptStatus();
        if (data.status === "completed" || data.status === "error") {
          clearInterval(interval);
          fetchStatus();
          if (data.status === "completed") {
            toast.success("Скрипт обработки видео завершён успешно!");
          } else {
            toast.error(`Ошибка выполнения скрипта: ${data.message}`);
          }
        }
      } catch (e) {
        console.error("Ошибка мониторинга:", e);
        toast.error("Ошибка при мониторинге выполнения скрипта");
      }
    }, 2000);
    return () => clearInterval(interval);
  };

  // Загрузка статуса при монтировании
  useEffect(() => {
    fetchStatus();
  }, []);

  // Защита от рендеринга до загрузки данных
  if (!serverData) {
    return (
      <Layout>
        <div className="admin-admin-container">
          <div className="admin-container">Загрузка...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-admin-container">
        <div className="admin-container">
          {/* Статус сервера — безопасный JSX */}
          <div className="status_div">
            {serverData.error ? (
              <span style={{ color: "red" }}>{serverData.error}</span>
            ) : (
              <>
                <strong>Статус:</strong> {serverData.status} |{" "}
                <strong>Время:</strong> {localTime.toLocaleTimeString()} |{" "}
                <strong>Устройство:</strong> {serverData.activeDevices} |{" "}
                <strong>Сессия:</strong> {serverData.session.phase} (
                {serverData.session.id})
              </>
            )}
          </div>

          {/* Кнопка обновления */}
          <button
            onClick={fetchStatus}
            style={{
              marginTop: "8px",
              padding: "6px 12px",
              backgroundColor: "#DAB76F",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            🔄 Обновить статус
          </button>

          {/* Переключатель городов */}
          <CitySwitcher onCityChange={handleCityChange} />

          {/* Плеер для админа и модератора */}
          {(isAdmin || isModerator) && <VideoPlayer />}

          <div className="main">
            <h2 style={{ marginTop: "50px" }}>Управление видеофайлами</h2>
            <VideoManager onFilesChange={fetchStatus} />

            <h2>Активные устройства</h2>
            <DevicesTable
              devices={devices}
              sendCommand={sendDeviceCommand}
              onCommandSent={fetchStatus}
            />

            {(isAdmin || isModerator) && (
              <>
                <h2>Глобальные действия</h2>
                <GlobalActions
                  restartAll={restartAllDevices}
                  runConcatScript={runConcatScript}
                  monitorScriptProgress={monitorScriptProgress}
                  fetchStatus={fetchStatus}
                />
              </>
            )}

            {isAdmin && (
              <>
                <h2>Логирование</h2>
                <ActiveSessions />
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminPanel;
