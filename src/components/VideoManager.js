import React, { useState, useEffect } from 'react';
import { useCity } from './CityContext';
import api from '../services/api';
import './VideoManager.css';

// Подкомпонент для загрузки видео
const VideoUpload = ({ onUpload, uploading, cityName }) => {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploadStatus('');

    // Валидация файла
    if (selectedFile) {
      if (!selectedFile.type.startsWith('video/') && !selectedFile.name.toLowerCase().endsWith('.mp4')) {
        setUploadStatus('❌ Разрешены только видеофайлы');
        setFile(null);
        return;
      }

      if (selectedFile.size > 500 * 1024 * 1024) {
        setUploadStatus('❌ Файл слишком большой. Максимальный размер: 500MB');
        setFile(null);
        return;
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus('❌ Выберите файл для загрузки');
      return;
    }

    setUploadStatus('⏳ Загрузка...');
    const result = await onUpload(file);

    if (result.success) {
      setUploadStatus(`✅ ${result.message} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      setFile(null);
      // Очищаем input file
      document.querySelector('#video-upload-input').value = '';
    } else {
      setUploadStatus(`❌ ${result.message}`);
    }
  };

  return (
    <div className="video-upload-section">
      <h3>📤 Загрузить новое видео</h3>
      
      <div className="upload-controls">
        <input
          id="video-upload-input"
          type="file"
          accept="video/*,.mp4"
          onChange={handleFileChange}
          disabled={uploading}
          className="file-input"
        />
        
        <button 
          onClick={handleUpload}
          disabled={!file || uploading}
          className="upload-button"
        >
          {uploading ? '📤 Загрузка...' : '📤 Загрузить видео'}
        </button>
      </div>

      {uploadStatus && (
        <div 
          className={`upload-status ${uploadStatus.includes('✅') ? 'success' : 'error'}`}
          dangerouslySetInnerHTML={{ __html: uploadStatus }}
        />
      )}

      <div className="upload-info">
        <p>
          <strong>Требования:</strong>
        </p>
        <ul>
          <li>✅ Формат: MP4</li>
          <li>✅ Максимальный размер: 500MB</li>
          <li>📍 Файл будет загружен в город: <strong>{cityName}</strong></li>
        </ul>
      </div>
    </div>
  );
};

// Подкомпонент для списка файлов
const VideoFileList = ({ files, loading, onDelete, onRefresh, cityName }) => {
  const [deletingFile, setDeletingFile] = useState(null);

  const handleDelete = async (filename) => {
    setDeletingFile(filename);
    const result = await onDelete(filename);
    setDeletingFile(null);

    if (!result.success) {
      alert(result.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  if (loading) {
    return (
      <div className="video-list-section">
        <h3>📁 Доступные видеофайлы ({cityName})</h3>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Загрузка списка файлов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-list-section">
      <div className="list-header">
        <h3>📁 Доступные видеофайлы ({cityName})</h3>
        <button 
          onClick={onRefresh}
          className="refresh-button"
          title="Обновить список"
        >
          🔄 Обновить
        </button>
      </div>

      {files.length === 0 ? (
        <div className="empty-state">
          <p>📭 Нет видеофайлов в городе {cityName}</p>
          <p className="empty-hint">Загрузите первое видео используя форму выше</p>
        </div>
      ) : (
        <div className="files-table-container">
          <table className="video-files-table">
            <thead>
              <tr>
                <th>Имя файла</th>
                <th>Размер</th>
                <th>Изменен</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.name} className={deletingFile === file.name ? 'deleting' : ''}>
                  <td className="filename-cell">
                    <span className="filename" title={file.name}>
                      {file.name}
                    </span>
                    {file.error && (
                      <span className="file-error" title={file.error}>
                        ⚠️
                      </span>
                    )}
                  </td>
                  <td className="size-cell">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="date-cell">
                    {formatDate(file.modified)}
                  </td>
                  <td className="actions-cell">
                    <button
                      onClick={() => handleDelete(file.name)}
                      disabled={deletingFile === file.name}
                      className="delete-button"
                      title={`Удалить файл ${file.name}`}
                    >
                      {deletingFile === file.name ? '⏳' : '🗑️'}
                      {deletingFile === file.name ? ' Удаление...' : ' Удалить'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="files-summary">
            Всего файлов: <strong>{files.length}</strong> | 
            Общий размер: <strong>{formatFileSize(files.reduce((sum, file) => sum + file.size, 0))}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

// Основной компонент VideoManager
const VideoManager = ({ onFilesChange }) => {
  const { currentCity, cityName } = useCity();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await api.getVideoFiles();
      setFiles(result.files || []);
      
      // Уведомляем родительский компонент об изменении файлов
      if (onFilesChange) {
        onFilesChange(result.files || []);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const result = await api.uploadVideo(file);
      
      if (result.success) {
        // Обновляем список после успешной загрузки
        await loadFiles();
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    try {
      const result = await api.deleteVideoFile(filename);
      
      if (result.success) {
        // Обновляем список после успешного удаления
        await loadFiles();
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Загружаем файлы при монтировании и при изменении города
  useEffect(() => {
    loadFiles();
  }, [currentCity]);

  return (
    <div className="video-manager">
      <VideoUpload 
        onUpload={handleUpload}
        uploading={uploading}
        cityName={cityName}
      />
      
      <VideoFileList 
        files={files}
        loading={loading}
        onDelete={handleDelete}
        onRefresh={loadFiles}
        cityName={cityName}
      />
    </div>
  );
};

export default VideoManager;