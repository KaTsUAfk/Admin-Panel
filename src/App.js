import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import './App.css'; 
import ProtectedRoute from './utils/ProtectedRoute';
import { CityProvider } from './components/CityContext';
import { ThemeProvider } from './contexts/ThemeContext';
// import RegisterPage from './components/RegisterPage'; - если нужно добавить страницу регистрации
// <Route path="/register" element={<RegisterPage />} />  - если нужно добавить страницу регистрации, добавтьб внутрь Routes
function App() {
  return (
    <ThemeProvider>
      <CityProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} /> 
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<LoginPage />} />
          </Routes>
        </Router>
      </CityProvider>
    </ThemeProvider>
  );
}

export default App;