import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Company {
  id: string;
  company_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  timezone: string;
  default_tax_rate: number;
  is_active: boolean;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  userCompany: Company | null;
  isLoadingCompanies: boolean;
  isMaster: boolean;
  selectCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, userProfile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [userCompany, setUserCompany] = useState<Company | null>(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  const isMaster = userProfile?.role === 'master';

  // Fetch all companies (for masters) or user's company
  const fetchCompanies = async () => {
    if (!user) {
      setIsLoadingCompanies(false);
      return;
    }

    try {
      setIsLoadingCompanies(true);

      if (isMaster) {
        // Masters can see all companies
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('company_name');

        if (error) throw error;
        setCompanies(data || []);

        // Load selected company from localStorage or default to first
        const savedCompanyId = localStorage.getItem('selectedCompanyId');
        if (savedCompanyId) {
          const saved = data?.find(c => c.id === savedCompanyId);
          if (saved) {
            setSelectedCompany(saved);
          } else if (data && data.length > 0) {
            setSelectedCompany(data[0]);
          }
        } else if (data && data.length > 0) {
          setSelectedCompany(data[0]);
        }
      } else {
        // Regular users only see their company
        if (userProfile?.company_id) {
          const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', userProfile.company_id)
            .single();

          if (error) throw error;
          if (data) {
            setUserCompany(data);
            setSelectedCompany(data);
            setCompanies([data]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  // Refresh companies list
  const refreshCompanies = async () => {
    await fetchCompanies();
  };

  // Select a company (masters only)
  const selectCompany = (companyId: string) => {
    if (!isMaster) return;

    const company = companies.find(c => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      localStorage.setItem('selectedCompanyId', companyId);
    }
  };

  // Load companies on mount and when user/profile changes
  useEffect(() => {
    fetchCompanies();
  }, [user, userProfile, isMaster]);

  const value: CompanyContextType = {
    companies,
    selectedCompany,
    userCompany,
    isLoadingCompanies,
    isMaster,
    selectCompany,
    refreshCompanies,
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
