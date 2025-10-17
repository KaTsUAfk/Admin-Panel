// src/components/LogoutButton.js
import React from "react";
import { logout } from "../services/authService";
import { useNavigate } from "react-router-dom";

const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
    } finally {
      logout(); // очистка localStorage
      navigate("/login");
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        margin: "0 0 0 10px",
        padding: "8px 16px",
        backgroundColor: "#dc3545",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "0.9rem",
      }}
    >
      🔒 Выйти
    </button>
  );
};

export default LogoutButton;
