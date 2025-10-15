// src/components/CitySwitcher.js
import React from "react";
import { setCurrentCity, getCurrentCity } from "../services/api";

const CitySwitcher = ({ onCityChange }) => {
  const currentCity = getCurrentCity();

  const handleCityChange = (city) => {
    setCurrentCity(city);
    if (onCityChange) {
      onCityChange(city);
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
        <button
          onClick={() => handleCityChange("kurgan")}
          style={{
            padding: "8px 16px",
            backgroundColor: currentCity === "kurgan" ? "#DAB76F" : "#e0e0e0",
            color: currentCity === "kurgan" ? "#000" : "#666",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: currentCity === "kurgan" ? "bold" : "normal",
          }}
        >
          📍 Курган
        </button>
        <button
          onClick={() => handleCityChange("ekat")}
          style={{
            padding: "8px 16px",
            backgroundColor: currentCity === "ekat" ? "#DAB76F" : "#e0e0e0",
            color: currentCity === "ekat" ? "#000" : "#666",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: currentCity === "ekat" ? "bold" : "normal",
          }}
        >
          🏔️ Екатеринбург
        </button>
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
