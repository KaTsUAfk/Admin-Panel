// src/components/AdminPanel.js
import React, { useState, useEffect } from "react";
import VideoManager from "./VideoManager";
import DevicesTable from "./DevicesTable";
import Layout from "./Layout";
import ActiveSessions from "./ActiveSessions";
import VideoPlayer from "./VideoPlayer";
import CitySwitcher from "./CitySwitcher";
import VideoProgress from "./VideoProgress";
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

  // Состояния для прогресса
  const [showProgress, setShowProgress] = useState(false);
  const [processingCity, setProcessingCity] = useState('');

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

  // Обработчик запуска обработки видео
  const handleProcessVideo = async (city) => {
    try {
      console.log('Starting video processing for:', city); // Отладка
      setProcessingCity(city);
      setShowProgress(true);

      const result = await runConcatScript(city);

      console.log('Script start result:', result); // Отладка

      if (!result.success) {
        toast.error(result.message || 'Ошибка при запуске обработки видео');
        setShowProgress(false);
      }
      // Прогресс будет отслеживаться автоматически через polling в VideoProgress
    } catch (error) {
      console.error('Error processing video:', error);
      toast.error('Ошибка при запуске обработки видео');
      setShowProgress(false);
    }
  };

  // Обработчик завершения прогресса
  const handleProgressComplete = () => {
    console.log('Progress complete called'); // Отладка
    setShowProgress(false);
    setProcessingCity('');
    // Обновляем список файлов
    fetchStatus();
    toast.success(`Обработка видео для ${processingCity} завершена!`);
  };

  // Мониторинг скрипта обработки видео (оставляем для обратной совместимости)
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
            className="global-actions-buttons"
            onClick={fetchStatus}
          >
            🔄 Обновить статус
          </button>

          {/* Переключатель городов */}
          <CitySwitcher onCityChange={handleCityChange} />

          {/* Компонент прогресса обработки видео */}
          {showProgress && (
            <VideoProgress
              city={processingCity}
              onComplete={handleProgressComplete}
            />
          )}

          {/* Плеер для админа и модератора */}
          {(isAdmin || isModerator) && <VideoPlayer />}

          <div className="main">
            <h2 style={{ marginTop: "50px" }}>Управление видеофайлами</h2>
            <VideoManager
              onFilesChange={fetchStatus}
              onProcessVideo={handleProcessVideo} 
              isProcessing={showProgress}
            />



            {(isAdmin || isModerator) && (
              <>
                <h2>Активные устройства</h2>
                <DevicesTable
                  devices={devices}
                  sendCommand={sendDeviceCommand}
                  onCommandSent={fetchStatus}
                  restartAll={restartAllDevices}
                  runConcatScript={handleProcessVideo} // Используем новый обработчик
                  monitorScriptProgress={monitorScriptProgress}
                  fetchStatus={fetchStatus}
                  currentUser={currentUser}
                  isProcessing={showProgress}
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