// src/components/GlobalActions.js
import React from 'react';
import { getCurrentCity } from '../services/api';

const GlobalActions = ({ restartAll, runConcatScript, monitorScriptProgress, fetchStatus }) => {
  const currentCity = getCurrentCity();

  const handleRestartAll = async () => {
    try {
      const result = await restartAll();
      alert(result.message);
      fetchStatus();
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  const handleRunConcatScript = async () => {
    if (!window.confirm(`Запустить скрипт обработки видео для города ${currentCity === 'kurgan' ? 'Курган' : 'Екатеринбург'}?`)) return;

    try {
      const result = await runConcatScript();
      if (result.success) {
        alert(`Скрипт успешно запущен для города ${currentCity === 'kurgan' ? 'Курган' : 'Екатеринбург'}!`);
        if (monitorScriptProgress) monitorScriptProgress();
      } else {
        alert('Ошибка: ' + result.message);
      }
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  return (
    <div className="global-actions-buttons">
      <button onClick={handleRestartAll}>Перезагрузить все устройства</button>
      <button onClick={handleRunConcatScript}>
        🔄 Обновить видео на сервер ({currentCity === 'kurgan' ? 'Курган' : 'Екатеринбург'})
      </button>
    </div>
  );
};

export default GlobalActions;