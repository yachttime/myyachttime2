import React, { createContext, useContext, useState } from 'react';
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
    const stored = localStorage.getItem('impersonatedYacht');
    return stored ? JSON.parse(stored) : null;
  });

  const setImpersonatedYacht = (yacht: Yacht | null) => {
    setImpersonatedYachtState(yacht);
    if (yacht) {
      localStorage.setItem('impersonatedYacht', JSON.stringify(yacht));
    } else {
      localStorage.removeItem('impersonatedYacht');
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
