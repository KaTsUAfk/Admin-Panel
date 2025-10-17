import React, { useState, useEffect, useRef } from "react";
import { useCity } from "./CityContext";
import api from "../services/api";
import "./VideoManager.css";
import { getCurrentUser } from "../services/authService";

// Подкомпонент для загрузки видео
const VideoUpload = ({ onUpload, uploading, setUploading, cityName }) => {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const [isDragging, setIsDragging] = useState(false);

  // Автоматически скрывать статус через 5 сек
  useEffect(() => {
    if (uploadStatus) {
      const timer = setTimeout(() => setUploadStatus(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadStatus]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleFiles = (files) => {
    const validFiles = files.filter((f) => {
      const isValidType =
        f.type.startsWith("video/") || f.name.toLowerCase().endsWith(".mp4");
      const isNotTooBig = f.size <= 500 * 1024 * 1024;
      return isValidType && isNotTooBig;
    });

    if (validFiles.length === 0) {
      setUploadStatus("❌ Ни один из файлов не прошёл валидацию");
      setFile(null);
      return;
    }

    // Берём первый файл (можно расширить до очереди)
    const selectedFile = validFiles[0];
    setFile(selectedFile);
    setUploadStatus("");
    setProgress(0);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("❌ Выберите файл для загрузки");
      return;
    }

    setUploadStatus("⏳ Загрузка...");
    setProgress(0);

    const result = await onUpload(
      file,
      (p) => setProgress(p),
      () => {
        abortControllerRef.current = new AbortController();
        return abortControllerRef.current.signal;
      }
    );

    if (result.success) {
      setUploadStatus(
        `✅ ${result.message} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
      );
      setFile(null);
      document.querySelector("#video-upload-input").value = "";
    } else {
      setUploadStatus(`❌ ${result.message}`);
    }
    setProgress(0);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setUploadStatus("❌ Загрузка отменена");
      setUploading(false);
    }
  };
  const handleDropzoneClick = () => {
    if (!uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  return (
    <div className="video-upload-section">
      <h3>📤 Загрузить новое видео</h3>

      <div className="upload-controls">
        <div
          className={`dropzone ${isDragging ? "dragging" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onClick={handleDropzoneClick}
          style={{ cursor: uploading ? "not-allowed" : "pointer" }}
        >
          {/* Скрытый input */}
          <input
            ref={fileInputRef} // ← привязка ref
            id="video-upload-input"
            type="file"
            accept="video/*,.mp4"
            onChange={handleFileChange}
            disabled={uploading}
            className="file-input"
            multiple
          />
          {isDragging
            ? "Отпустите файл сюда!"
            : "Перетащите видео или нажмите для выбора"}
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="upload-button"
        >
          {uploading ? "📤 Загрузка..." : "📤 Загрузить видео"}
        </button>

        {uploading && (
          <button onClick={handleCancel} className="cancel-button">
            ❌ Отменить
          </button>
        )}
      </div>

      {file && (
        <div className="file-preview">
          📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}

      {progress > 0 && progress < 100 && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
          <span className="progress-text">{progress}%</span>
        </div>
      )}

      {uploadStatus && (
        <div
          className={`upload-status ${
            uploadStatus.includes("✅") ? "success" : "error"
          }`}
          dangerouslySetInnerHTML={{ __html: uploadStatus }}
        />
      )}

      <div className="upload-info">
        <p>
          <strong>Требования:</strong>
        </p>
        <ul>
          <li>✅ Форматы: MP4, MOV, AVI (рекомендуется MP4)</li>
          <li>✅ Максимальный размер: 500MB</li>
          <li>
            📍 Файл будет загружен в город: <strong>{cityName}</strong>
          </li>
        </ul>
      </div>
    </div>
  );
};

// Подкомпонент для списка файлов
const VideoFileList = ({ files, loading, onDelete, onRefresh, cityName }) => {
  const [deletingFile, setDeletingFile] = useState(null);
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const handleDelete = async (filename) => {
    setDeletingFile(filename);
    const result = await onDelete(filename);
    setDeletingFile(null);

    if (!result.success) {
      alert(result.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("ru-RU");
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
          <p className="empty-hint">
            Загрузите первое видео используя форму выше
          </p>
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
                <tr
                  key={file.name}
                  className={deletingFile === file.name ? "deleting" : ""}
                >
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
                  <td className="size-cell">{formatFileSize(file.size)}</td>
                  <td className="date-cell">{formatDate(file.modified)}</td>
                  <td className="actions-cell">
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(file.name)}
                        disabled={deletingFile === file.name}
                        className="delete-button"
                        title={`Удалить файл ${file.name}`}
                      >
                        {deletingFile === file.name ? "⏳" : "🗑️"}
                        {deletingFile === file.name
                          ? " Удаление..."
                          : " Удалить"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="files-summary">
            Всего файлов: <strong>{files.length}</strong> | Общий размер:{" "}
            <strong>
              {formatFileSize(files.reduce((sum, file) => sum + file.size, 0))}
            </strong>
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
      if (onFilesChange) {
        onFilesChange(result.files || []);
      }
    } catch (error) {
      console.error("Error loading files:", error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file, onProgress, getSignal) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);

      const city = currentCity;

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const signal = getSignal();

        xhr.open("POST", "/api/upload-video");
        xhr.setRequestHeader("X-City", city);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText);
            if (result.success) {
              loadFiles();
              resolve({ success: true, message: result.message });
            } else {
              resolve({ success: false, message: result.message });
            }
          } else {
            resolve({
              success: false,
              message: "Ошибка сервера при загрузке",
            });
          }
        };

        xhr.onerror = () => {
          resolve({
            success: false,
            message: "Ошибка сети при загрузке",
          });
        };

        xhr.onabort = () => {
          resolve({
            success: false,
            message: "Загрузка отменена",
          });
        };

        if (signal.aborted) {
          xhr.abort();
        } else {
          signal.addEventListener("abort", () => xhr.abort());
          xhr.send(formData);
        }
      });
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
        await loadFiles();
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  useEffect(() => {
    loadFiles();
  }, [currentCity]);

  return (
    <div className="video-manager">
      <VideoUpload
        onUpload={handleUpload}
        uploading={uploading}
        setUploading={setUploading}
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
