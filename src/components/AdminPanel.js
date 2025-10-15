// src/components/AdminPanel.js
import React, { useState, useEffect } from "react";
import VideoManager from "./VideoManager";
import DevicesTable from "./DevicesTable";
import GlobalActions from "./GlobalActions";
import Layout from "./Layout";
import ActiveSessions from "./ActiveSessions";
import VideoPlayer from "./VideoPlayer";
import CitySwitcher from "./CitySwitcher";
import { useCity } from "./CityContext"; // Добавить эту строку
import {
  getStatus,
  getScriptStatus,
  sendDeviceCommand,
  restartAllDevices,
  runConcatScript,
} from "../services/api";
import { isAuthenticated, getCurrentUser } from "../services/authService"; // ← getCurrentUser из authService
import { useNavigate } from "react-router-dom";

const AdminPanel = () => {
  const navigate = useNavigate();
  const [serverStatus, setServerStatus] = useState("Загрузка...");
  const [devices, setDevices] = useState([]);
  const { currentCity, changeCity } = useCity(); // ← только из контекста
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  console.log("Current user:", currentUser);
  console.log("Is admin:", isAdmin);

  // Обработчик изменения города
  const handleCityChange = (city) => {
    changeCity(city);
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
    }
  }, [navigate]);

  const fetchStatus = async () => {
    try {
      const data = await getStatus();
      setServerStatus(
        `<strong>Статус:</strong> ${data.status} | 
         <strong>Время:</strong> ${new Date(
           data.serverTime
         ).toLocaleTimeString()} | 
         <strong>Устройство:</strong> ${data.activeDevices} | 
         <strong>Сессия:</strong> ${data.session.phase} (${data.session.id})`
      );
      setDevices(data.devices || []);
    } catch (e) {
      if (e.message === "Требуется повторная авторизация") {
        setServerStatus("Сессия истекла. Пожалуйста, войдите снова.");
      } else {
        setServerStatus("Ошибка загрузки статуса");
      }
    }
  };

  const monitorScriptProgress = () => {
    const originalStatus = serverStatus;
    setServerStatus(
      "<strong>Статус:</strong> Выполняется скрипт обработки видео..."
    );

    const interval = setInterval(async () => {
      try {
        const data = await getScriptStatus();

        if (data.status === "completed" || data.status === "error") {
          clearInterval(interval);
          setServerStatus(originalStatus);
          alert(
            data.status === "completed"
              ? "Скрипт обработки видео завершен успешно!"
              : `Ошибка выполнения скрипта: ${data.message}`
          );
          fetchStatus();
        } else if (data.status === "running") {
          setServerStatus(
            `<strong>Статус:</strong> Скрипт выполняется... (${
              data.progress || "выполняется"
            })`
          );
        }
      } catch (e) {
        console.error("Ошибка мониторинга:", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    fetchStatus();
    const intervalId = setInterval(fetchStatus, 3000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <Layout>
      <div className="admin-admin-container">
        <div className="admin-container">
          <div
            className="status_div"
            dangerouslySetInnerHTML={{ __html: serverStatus }}
          ></div>

          {/* Переключатель городов */}
          <CitySwitcher onCityChange={handleCityChange} />

          {/* Плеер только для админа */}
          {isAdmin && <VideoPlayer />}

          <div className="main">
            <h2 style={{ marginTop: "50px" }}>Управление видеофайлами</h2>
            <VideoManager onFilesChange={() => fetchStatus()} />

            <h2>Активные устройства</h2>
            <DevicesTable
              devices={devices}
              sendCommand={sendDeviceCommand}
              onCommandSent={fetchStatus}
            />

            <h2>Глобальные действия</h2>
            <GlobalActions
              restartAll={restartAllDevices}
              runConcatScript={runConcatScript}
              monitorScriptProgress={monitorScriptProgress}
              fetchStatus={fetchStatus}
            />

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
