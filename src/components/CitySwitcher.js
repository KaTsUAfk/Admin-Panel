// src/components/CitySwitcher.js
import React from "react";
import { setCurrentCity, getCurrentCity } from "../services/api";
import { getCurrentUser } from "../services/authService";

const CitySwitcher = ({ onCityChange }) => {
  const currentCity = getCurrentCity();
  const user = getCurrentUser();

  // Определяем, какие города доступны пользователю
  let allowedCities = ["kurgan", "ekat"]; // по умолчанию — все

  if (user) {
    if (user.username === "kurgan") {
      allowedCities = ["kurgan"];
    } else if (user.username === "ekat") {
      allowedCities = ["ekat"];
    }
  }

  // Если текущий город не в разрешённых — переключаем на первый доступный
  React.useEffect(() => {
    if (!allowedCities.includes(currentCity)) {
      const firstAllowed = allowedCities[0];
      setCurrentCity(firstAllowed);
      if (onCityChange) onCityChange(firstAllowed);
    }
  }, [currentCity, allowedCities, onCityChange]);

  const handleCityChange = (city) => {
    if (allowedCities.includes(city)) {
      setCurrentCity(city);
      if (onCityChange) onCityChange(city);
    }
  };

  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "15px",
        color: "var(--text-primary)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
      }}
    >
      <h3 className="sity-vibor">🌍 Выбор города</h3>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {allowedCities.includes("kurgan") && (
          <button
            className={`global-sity-buttons ${currentCity === "kurgan" ? "active" : ""}`}
            onClick={() => handleCityChange("kurgan")}
          >
            📍 Курган
          </button>
        )}

        {allowedCities.includes("ekat") && (
          <button
            className={`global-sity-buttons ${currentCity === "ekat" ? "active" : ""}`}
            onClick={() => handleCityChange("ekat")}
          >
            🏔️ Екатеринбург
          </button>
        )}

        <span
          style={{
            marginLeft: "10px",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
          }}
        >
          Текущий:{" "}
          <strong>
            {currentCity === "kurgan" ? "Курган" : "Екатеринбург"}
          </strong>
        </span>
      </div>
    </div>
  );
};

export default CitySwitcher;
