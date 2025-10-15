import React from 'react';

const DevicesTable = ({ devices, sendCommand, onCommandSent }) => {
  const handleSendCommand = async (deviceId, command) => {
    try {
      const result = await sendCommand(deviceId, command);
      alert(`Команда ${command} отправлена устройству ${deviceId}: ${result.status}`);
      if (onCommandSent) onCommandSent();
    } catch (e) {
      alert('Ошибка отправки команды: ' + e.message);
    }
  };

  return (
   <table className="devices-table">
  <thead>
    <tr>
      <th>Устройство ID</th>
      <th>Позиция</th>
      <th>Последняя видимость</th>
      <th>Мастер</th>
      <th>Активность</th>
    </tr>
  </thead>
  <tbody>
    {devices.map((dev) => (
      <tr key={dev.id}>
        <td>{dev.id.substring(0, 8)}...</td>
        <td>{Math.round(dev.position / 1000)}s</td>
        <td>{new Date(dev.lastSeen).toLocaleTimeString()}</td>
        <td>{dev.isMaster ? '✅ Мастер' : ''}</td>
        <td>
          {/* Команды пока закомментированы, но можно раскомментировать */}
          {/* <button onClick={() => handleSendCommand(dev.id, 'reload')}>Перезапуск стрима</button>
          <button onClick={() => handleSendCommand(dev.id, 'restart')}>Перезапуск устройств</button>
          <button onClick={() => handleSendCommand(dev.id, 'pause')}>Пауза</button>
          <button onClick={() => handleSendCommand(dev.id, 'play')}>Пуск</button> */}
        </td>
      </tr>
    ))}
  </tbody>
</table>
  );
};

export default DevicesTable;