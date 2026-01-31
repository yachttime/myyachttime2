import React, { createContext, useContext, useState, useEffect } from 'react';
import { Yacht } from '../lib/supabase';

interface YachtImpersonationContextType {
  impersonatedYacht: Yacht | null;
  setImpersonatedYacht: (yacht: Yacht | null) => void;
  getEffectiveYacht: (actualYacht: Yacht | null, userRole: string | undefined) => Yacht | null;
  isImpersonatingYacht: boolean;
}

const YachtImpersonationContext = createContext<YachtImpersonationContextType | undefined>(undefined);

export const YachtImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [impersonatedYacht, setImpersonatedYachtState] = useState<Yacht | null>(() => {
    try {
      const stored = localStorage.getItem('impersonatedYacht');
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      // Validate that it has required yacht properties
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.name) {
        return parsed as Yacht;
      }

      // Invalid data, clear it
      localStorage.removeItem('impersonatedYacht');
      return null;
    } catch (error) {
      console.error('Error loading impersonated yacht from localStorage:', error);
      localStorage.removeItem('impersonatedYacht');
      return null;
    }
  });

  const setImpersonatedYacht = (yacht: Yacht | null) => {
    setImpersonatedYachtState(yacht);
    try {
      if (yacht) {
        localStorage.setItem('impersonatedYacht', JSON.stringify(yacht));
      } else {
        localStorage.removeItem('impersonatedYacht');
      }
    } catch (error) {
      console.error('Error saving impersonated yacht to localStorage:', error);
    }
  };

  const getEffectiveYacht = (actualYacht: Yacht | null, userRole: string | undefined): Yacht | null => {
    if (userRole !== 'master') return actualYacht;
    return impersonatedYacht || actualYacht;
  };

  const isImpersonatingYacht = impersonatedYacht !== null;

  return (
    <YachtImpersonationContext.Provider
      value={{
        impersonatedYacht,
        setImpersonatedYacht,
        getEffectiveYacht,
        isImpersonatingYacht,
      }}
    >
      {children}
    </YachtImpersonationContext.Provider>
  );
};

export const useYachtImpersonation = () => {
  const context = useContext(YachtImpersonationContext);
  if (!context) {
    throw new Error('useYachtImpersonation must be used within YachtImpersonationProvider');
  }
  return context;
};
