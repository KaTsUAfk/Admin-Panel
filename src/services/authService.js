const API_BASE = "/api";

// Вход — без сохранения токена в localStorage
export const login = async (username, password, clientIp) => {
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, clientIp }),
      credentials: "include",
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    // ❌ НЕ сохраняем токен в localStorage — используем только куки
    if (result.user) {
      localStorage.setItem("user", JSON.stringify(result.user));
    }
    return result;
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: "Ошибка соединения с сервером. Проверьте подключение к интернету.",
    };
  }
};

// Проверка аутентификации — через сервер
export const checkAuth = async () => {
  try {
    const response = await fetch("/api/check-auth", {
      method: "GET",
      credentials: "include",
    });
    return await response.json();
  } catch (error) {
    console.error("Check auth error:", error);
    return { authenticated: false };
  }
};

// Получение текущего пользователя — из localStorage (только данные, не токен!)
export const getCurrentUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

// Регистрация — сохраняем user, но не токен
export const register = async (username, password) => {
  const response = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }
  return data;
};

// Выход — очищаем localStorage и куку
export const logout = async () => {
  localStorage.removeItem("user");
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }
};

// Проверка авторизации — через localStorage (только наличие user)
export const isAuthenticated = () => {
  return !!localStorage.getItem("user");
};
