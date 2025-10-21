// src/components/DevicesTable.js
import React from "react";
import { useCity } from "./CityContext";
import { toast } from 'react-toastify';

const DevicesTable = ({
  devices,
  sendCommand,
  onCommandSent,
  restartAll,
  runConcatScript,
  monitorScriptProgress,
  fetchStatus,
  currentUser,
  isProcessing,
  cityName
}) => {
  const { currentCity } = useCity(); // Получаем текущий выбранный город


  const handleRestartAll = async () => {
    try {
      // Передаем текущий город в функцию restartAll
      await restartAll(currentCity);
      fetchStatus();
      toast.success(`Команда перезагрузки отправлена для города ${currentCity}`);
    } catch (error) {
      console.error("Restart all error:", error);
      toast.error("Ошибка при отправке команды перезагрузки");
    }
  };

  const handleRunConcatScript = async () => {
    try {
      await runConcatScript(currentCity);
      monitorScriptProgress();
    } catch (error) {
      console.error("Run concat script error:", error);
      toast.error("Ошибка при запуске обработки видео");
    }
  };

  return (
    <div className="video-list-section">
      <div className="devices-table">
        <table className="devices">
          <thead>
            <tr>
              <th>ID устройства</th>
              <th>Позиция</th>
              <th>Последний контакт</th>
              <th>Мастер</th>
              <th>Команды</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.id}</td>
                <td>{device.position}ms</td>
                <td>{new Date(device.lastSeen).toLocaleTimeString()}</td>
                <td>{device.isMaster ? "✅" : "❌"}</td>
                <td>{device.commandCount}</td>
                <td>
                  <button
                    className="device-command-button"
                    onClick={() => {
                      sendCommand(device.id, "reload");
                      onCommandSent();
                    }}
                  >
                    Перезагрузить
                  </button>
                  <button
                    className="device-command-button"
                    onClick={() => {
                      sendCommand(device.id, "restart");
                      onCommandSent();
                    }}
                  >
                    Сбросить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="global-actions">
        <button
          className="global-actions-buttons"
          onClick={handleRestartAll}
          disabled={isProcessing}
        >
          🔄 Перезагрузить устройства ({cityName})
        </button>

        {/* <button 
          className="global-actions-buttons" 
          onClick={handleRunConcatScript}
          disabled={isProcessing}
        >
          🎬 Обработать видео ({currentCity})
        </button> */}
      </div>
      <div className="upload-info"
      >
        <p>
          <strong>Правило:</strong>
        </p>
        <ul>
          <li>Данное действие полностью сбрасывает все устройства которые подключены к городу, возвращает их в позицию 00:00 на видео.</li>
        </ul>
      </div>
    </div>
  );
};

export default DevicesTable;