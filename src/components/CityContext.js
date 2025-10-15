import React, { createContext, useContext, useState } from 'react';
import api from '../services/api';

const CityContext = createContext();

export const useCity = () => {
  const context = useContext(CityContext);
  if (!context) {
    throw new Error('useCity must be used within a CityProvider');
  }
  return context;
};

export const CityProvider = ({ children }) => {
  const [currentCity, setCurrentCity] = useState(api.getCurrentCity());

  const changeCity = (city) => {
    api.setCurrentCity(city);
    setCurrentCity(city);
  };

  const value = {
    currentCity,
    changeCity,
    cityName: currentCity === 'kurgan' ? 'Курган' : 'Екатеринбург'
  };

  return (
    <CityContext.Provider value={value}>
      {children}
    </CityContext.Provider>
  );
};