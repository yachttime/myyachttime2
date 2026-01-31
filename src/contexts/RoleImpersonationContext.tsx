import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../lib/supabase';

interface RoleImpersonationContextType {
  impersonatedRole: UserRole | null;
  setImpersonatedRole: (role: UserRole | null) => void;
  getEffectiveRole: (actualRole: UserRole | undefined) => UserRole | undefined;
  isImpersonating: boolean;
}

const RoleImpersonationContext = createContext<RoleImpersonationContextType | undefined>(undefined);

export const RoleImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [impersonatedRole, setImpersonatedRoleState] = useState<UserRole | null>(() => {
    const stored = localStorage.getItem('impersonatedRole');
    return stored ? (stored as UserRole) : null;
  });

  const setImpersonatedRole = (role: UserRole | null) => {
    setImpersonatedRoleState(role);
    if (role) {
      localStorage.setItem('impersonatedRole', role);
    } else {
      localStorage.removeItem('impersonatedRole');
    }
  };

  const getEffectiveRole = (actualRole: UserRole | undefined): UserRole | undefined => {
    if (!actualRole) return undefined;
    if (actualRole !== 'master') return actualRole;
    return impersonatedRole || actualRole;
  };

  const isImpersonating = impersonatedRole !== null;

  return (
    <RoleImpersonationContext.Provider
      value={{
        impersonatedRole,
        setImpersonatedRole,
        getEffectiveRole,
        isImpersonating,
      }}
    >
      {children}
    </RoleImpersonationContext.Provider>
  );
};

export const useRoleImpersonation = () => {
  const context = useContext(RoleImpersonationContext);
  if (!context) {
    throw new Error('useRoleImpersonation must be used within RoleImpersonationProvider');
  }
  return context;
};
