import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";
import { getCurrentUser } from "../services/authService";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Загружаем настройки из localStorage или по умолчанию
  useEffect(() => {
    const savedSettings = localStorage.getItem("userSettings");
    let isDark = false;
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        isDark = settings.darkMode || false;
      } catch (e) {
        console.warn("Не удалось распарсить настройки пользователя");
      }
    }
    setDarkMode(isDark);
    applyTheme(isDark); // 👈 применяем сразу
    setLoading(false);
  }, []);

  // Применяем тему к DOM
  const applyTheme = (isDark) => {
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark-theme");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.body.classList.remove("dark-theme");
    }
  };

  // Переключение темы
  const toggleDarkMode = async () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    applyTheme(newDarkMode);

    // Сохраняем в localStorage
    const savedSettings = localStorage.getItem("userSettings");
    let settings = {};
    if (savedSettings) {
      try {
        settings = JSON.parse(savedSettings);
      } catch (e) {
        console.warn("Не удалось распарсить настройки пользователя");
      }
    }
    settings.darkMode = newDarkMode;
    localStorage.setItem("userSettings", JSON.stringify(settings));

    // Обновляем настройки на сервере (если пользователь авторизован)
    const user = getCurrentUser();
    if (user && user.id) {
      try {
        await api.updateUserSettings(user.id, { darkMode: newDarkMode });
      } catch (e) {
        console.error("Ошибка обновления настроек на сервере:", e);
      }
    }
  };

  const value = {
    darkMode,
    toggleDarkMode,
    loading,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
