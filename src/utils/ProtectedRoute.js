import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, checkAuth, logout } from "../services/authService";

const ProtectedRoute = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAuth = async () => {
      // Сначала проверяем наличие user в localStorage (быстро)
      if (!isAuthenticated()) {
        logout(); // на всякий случай
        navigate("/login");
        setIsAuthChecked(true);
        return;
      }

      // Затем проверяем сессию на сервере (точно)
      const result = await checkAuth();
      if (!result.authenticated) {
        logout();
        navigate("/login");
      } else {
        setIsAuthorized(true);
      }
      setIsAuthChecked(true);
    };

    verifyAuth();
  }, [navigate]);

  if (!isAuthChecked) {
    return <div>Проверка сессии...</div>;
  }

  return isAuthorized ? children : null;
};

export default ProtectedRoute;
