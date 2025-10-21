// src/components/GlobalActions.js
import React from 'react';
import { getCurrentCity } from '../services/api';
import { toast } from 'react-toastify';

const GlobalActions = ({
  restartAll,
  runConcatScript,
  monitorScriptProgress,
  fetchStatus,
  isProcessing
}) => {
  const currentCity = getCurrentCity();

  const handleRestartAll = async () => {
    try {
      const result = await restartAll();
      toast.success(result.message);
      fetchStatus();
    } catch (e) {
      toast.error('Ошибка: ' + e.message);
    }
  };

  const handleRunConcatScript = async () => {
    if (!window.confirm(`Запустить скрипт обработки видео для города ${currentCity === 'kurgan' ? 'Курган' : 'Екатеринбург'}?`)) return;

    try {
      const result = await runConcatScript();
      if (result.success) {
        toast.success(`Скрипт успешно запущен для города ${currentCity === 'kurgan' ? 'Курган' : 'Екатеринбург'}!`);
        if (monitorScriptProgress) monitorScriptProgress();
      } else {
        toast.error('Ошибка: ' + result.message);
      }
    } catch (e) {
      toast.error('Ошибка: ' + e.message);
    }
  };

  return (
    <div className='video-list-section'>
      <button
        className="global-actions-buttons"
        onClick={handleRestartAll}>Перезагрузить все устройства</button>
      <div className="upload-info"
      >
        <p>
          <strong>Правило:</strong>
        </p>
        <ul>
          <li>Данное действие полностью сбрасывает все устройства которые подключены, возвращает их в позицию 00:00 на видео.</li>
        </ul>
      </div>
    </div>
  );
};

export default GlobalActions;