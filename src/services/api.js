class ApiClient {
  constructor() {
    this.BASE_URL = "/api";
    this.currentCity = localStorage.getItem("currentCity") || "kurgan";
  }

  setCurrentCity(city) {
    if (city === "kurgan" || city === "ekat") {
      this.currentCity = city;
      localStorage.setItem("currentCity", city);
    }
  }

  getCurrentCity() {
    return this.currentCity;
  }

  getHlsBaseUrl() {
    const cityConfig = {
      kurgan: "http://109.195.134.244:8096/kurgan",
      ekat: "http://109.195.134.244:8096/ekat",
    };
    return cityConfig[this.currentCity] || cityConfig.kurgan;
  }

  // Убираем Authorization из заголовков — аутентификация через куки
  getAuthHeaders(contentType = "application/json") {
    const headers = {};
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.BASE_URL}${endpoint}`;
    const config = {
      method: "GET",
      credentials: "include", // ← куки будут отправляться автоматически
      headers: this.getAuthHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401 || response.status === 403) {
        this.handleUnauthorized();
        throw new Error("Требуется повторная авторизация");
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  handleUnauthorized() {
    // Удаляем только данные пользователя, токен в localStorage не хранится
    localStorage.removeItem("user");
    // Не удаляем "authToken", потому что его там нет
    window.location.href = "/login";
  }

  // Специфичные методы API — без Authorization в headers
  async getStatus() {
    return this.request("/status");
  }

  async getScriptStatus() {
    return this.request("/script-status");
  }

  async uploadVideo(file) {
    const formData = new FormData();
    formData.append("video", file);

    return this.request("/upload-video", {
      method: "POST",
      body: formData,
      headers: {
        "X-City": this.currentCity,
      },
    });
  }

  async getVideoFiles(city) {
    return this.request("/video-files", {
      headers: { "X-City": city }
    });
  }

  async deleteVideoFile(filename) {
    const encodedName = encodeURIComponent(filename);
    return this.request(
      `/video-files/${encodedName}?city=${this.currentCity}`,
      {
        method: "DELETE",
      }
    );
  }

  async runConcatScript() {
    return this.request("/process-video", {
      method: "POST",
      headers: this.getAuthHeaders("application/json"),
      body: JSON.stringify({ city: this.currentCity }),
    });
  }
  async restartAllDevices() {
    return this.request("/restart", {
      method: "POST",
      headers: {
        ...this.getAuthHeaders("application/json"),
        "X-City": this.currentCity,
      },
      body: JSON.stringify({ city: this.currentCity }),
    });
  }

  async sendDeviceCommand(deviceId, command) {
    return this.request(`/device/${deviceId}/command`, {
      method: "POST",
      headers: this.getAuthHeaders("application/json"),
      body: JSON.stringify({ command }),
    });
  }
}

// Создаем экземпляр
const apiClient = new ApiClient();

// Экспортируем
export default apiClient;

export const API_BASE = "/api";
export const getCurrentCity = () => apiClient.getCurrentCity();
export const setCurrentCity = (city) => apiClient.setCurrentCity(city);
export const getHlsBaseUrl = () => apiClient.getHlsBaseUrl();
export const getAuthHeaders = (contentType) =>
  apiClient.getAuthHeaders(contentType);
export const getStatus = () => apiClient.getStatus();
export const getScriptStatus = () => apiClient.getScriptStatus();
export const uploadVideo = (file) => apiClient.uploadVideo(file);
export const getVideoFiles = () => apiClient.getVideoFiles();
export const deleteVideoFile = (filename) =>
  apiClient.deleteVideoFile(filename);
export const runConcatScript = () => apiClient.runConcatScript();
export const restartAllDevices = () => apiClient.restartAllDevices();
export const sendDeviceCommand = (deviceId, command) =>
  apiClient.sendDeviceCommand(deviceId, command);
