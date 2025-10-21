// src/components/ActiveSessions.js
import React, { useState, useEffect } from 'react';
import { getAuthHeaders, API_BASE } from '../services/api';
import { getCurrentUser } from '../services/authService';
import { toast } from 'react-toastify';

const ActiveSessions = () => {
  // Логи входов
  const [loginSessions, setLoginSessions] = useState([]);
  // Логи действий
  const [actionLogs, setActionLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // Загрузка обоих типов логов
  const fetchAllLogs = async () => {
    try {
      const [loginRes, actionRes] = await Promise.all([
        fetch(`${API_BASE}/active-sessions?limit=3`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/action-logs?limit=5`, { headers: getAuthHeaders() })
      ]);

      const loginData = await loginRes.json();
      const actionData = await actionRes.json();

      setLoginSessions(loginData.sessions || []);
      setActionLogs(actionData.logs || []);
    } catch (err) {
      toast.error('Ошибка загрузки логов: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Скачать логи входов
  const handleDownloadLoginLogs = () => {
    fetch(`${API_BASE}/download-logs`, { headers: getAuthHeaders() })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'login-logs.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(err => {
        toast.error('Ошибка скачивания логов входа: ' + err.message);
      });
  };

  // Скачать логи действий
  const handleDownloadActionLogs = () => {
    fetch(`${API_BASE}/download-action-logs`, { headers: getAuthHeaders() })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'action-logs.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(err => {
        toast.error('Ошибка скачивания логов действий: ' + err.message);
      });
  };

  // Человекочитаемые названия действий
  const getActionLabel = (action) => {
    const labels = {
      upload_video: 'Загрузка видео',
      delete_video: 'Удаление видео',
      restart_devices: 'Перезапуск устройств',
      run_concat_script: 'Запуск скрипта обработки',
      send_command: 'Отправка команды устройству',
    };
    return labels[action] || action;
  };

  // Хук useEffect должен быть ВСЕГДА вызван, независимо от условий
  useEffect(() => {
    if (isAdmin) {
      fetchAllLogs();
    }
  }, [isAdmin]); // Добавьте isAdmin в зависимости

  if (!isAdmin) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        ⚠️ Доступ запрещен. Требуются права администратора.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '20px', marginBottom: '0px' }}>
      {/* === Логи входов === */}
      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <table className="devices-table" style={{ marginBottom: '0px' }}>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>IP адрес</th>
              <th>Время входа</th>
              <th>Браузер/Устройство</th>
            </tr>
          </thead>
          <tbody>
            {loginSessions.map((log, i) => (
              <tr key={i}>
                <td>{log.username}</td>
                <td>{log.ip}</td>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td style={{ fontSize: '0.8rem' }}>{log.userAgent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* === Логи действий === */}
      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <table className="login-history-table" style={{ marginTop: '0px', marginBottom: '0px' }}>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Действие</th>
              <th>Детали</th>
              <th>IP</th>
              <th>Время</th>
            </tr>
          </thead>
          <tbody>
            {actionLogs.map((log, i) => (
              <tr key={i}>
                <td>{log.username || '—'}</td>
                <td>{getActionLabel(log.action)}</td>
                <td style={{ fontSize: '0.85rem' }}>
                  {log.filename && `Файл: ${log.filename}`}
                  {log.deviceId && `Устройство: ${log.deviceId.substring(0, 8)}...`}
                  {log.command && `Команда: ${log.command}`}
                  {!log.filename && !log.deviceId && !log.command && '—'}
                </td>
                <td>{log.ip}</td>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>)}
      <div className="global-actions-buttons">
        <button
          onClick={handleDownloadLoginLogs}
        >
          📥 Скачать логи входов
        </button>
        <button
          onClick={handleDownloadActionLogs}
        >
          📥 Скачать логи действий
        </button>
      </div>
    </div>
  );
};

export default ActiveSessions;