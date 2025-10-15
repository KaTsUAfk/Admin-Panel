// src/components/ThemeToggle.js
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = () => {
  const { darkMode, toggleDarkMode, loading } = useTheme();

  if (loading) return null;

  return (
    <button
      onClick={toggleDarkMode}
      className={`theme-toggle-btn ${darkMode ? 'dark' : 'light'}`}
      title={darkMode ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
    >
      <span className="theme-icon">{darkMode ? '🌙' : '☀️'}</span>
      <span className="theme-label">{darkMode ? 'Тёмная' : 'Светлая'}</span>
    </button>
  );
};

export default ThemeToggle;