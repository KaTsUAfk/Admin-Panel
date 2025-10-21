import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
//import RegisterPage from "./components/RegisterPage";
import AdminPanel from "./components/AdminPanel";
import "./App.css";
import ProtectedRoute from "./utils/ProtectedRoute";
import { CityProvider } from "./components/CityContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useState } from "react";
import { checkAuth } from "./services/authService";
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    // Проверяем авторизацию при загрузке
    checkAuth().then((result) => {
      setIsAuthenticated(result.authenticated);
    });
  }, []);

  if (isAuthenticated === null) {
    return <div>Загрузка...</div>;
  }
  return (
    <ThemeProvider>
      <CityProvider>
        <Router>
          {/* ✅ ToastContainer ВНЕ Routes */}
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/*<Route path="/register" element={<RegisterPage />} />*/}

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
