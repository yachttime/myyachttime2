import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { isFeatureEnabled as checkFeature } from '../utils/featureFlags';

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
  feature_flags?: Record<string, boolean> | null;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  userCompany: Company | null;
  isLoadingCompanies: boolean;
  isMaster: boolean;
  featureFlags: Record<string, boolean> | null;
  isFeatureEnabled: (key: string) => boolean;
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

        // Load selected company from localStorage or default to user's company
        const savedCompanyId = localStorage.getItem('selectedCompanyId');
        let activeCompanyId: string | null = null;
        if (savedCompanyId) {
          const saved = data?.find(c => c.id === savedCompanyId);
          if (saved) {
            setSelectedCompany(saved);
            activeCompanyId = saved.id;
          } else if (userProfile?.company_id) {
            const userComp = data?.find(c => c.id === userProfile.company_id);
            if (userComp) {
              setSelectedCompany(userComp);
              activeCompanyId = userComp.id;
            }
          }
        } else if (userProfile?.company_id) {
          const userComp = data?.find(c => c.id === userProfile.company_id);
          if (userComp) {
            setSelectedCompany(userComp);
            activeCompanyId = userComp.id;
          }
        }

        // Sync the selected company to the database for RLS filtering
        if (activeCompanyId) {
          await supabase
            .from('user_profiles')
            .update({ selected_company_id: activeCompanyId })
            .eq('user_id', user.id);
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
  const refreshCompanies = useCallback(async () => {
    await fetchCompanies();
  }, [user, userProfile, isMaster]); // eslint-disable-line react-hooks/exhaustive-deps

  // Select a company (masters only)
  // Updates both the local state and the master's selected_company_id in the database
  // so RLS policies filter data by the selected company
  const selectCompany = useCallback(async (companyId: string) => {
    if (!isMaster) return;

    const company = companies.find(c => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      localStorage.setItem('selectedCompanyId', companyId);

      // Clear stale drafts from the previous company so they don't trigger
      // failed lookups (and white-screen delays) in the new company's context
      localStorage.removeItem('estimate_draft');

      // Update the master's selected_company_id in user_profiles so that
      // get_user_company_id() returns the selected company for RLS filtering
      try {
        await supabase
          .from('user_profiles')
          .update({ selected_company_id: companyId })
          .eq('user_id', user?.id);
      } catch (error) {
        console.error('Error updating selected company:', error);
      }
    }
  }, [isMaster, companies, user?.id]);

  // Load companies on mount and when user/profile changes
  useEffect(() => {
    fetchCompanies();
  }, [user, userProfile, isMaster]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<CompanyContextType>(() => ({
    companies,
    selectedCompany,
    userCompany,
    isLoadingCompanies,
    isMaster,
    featureFlags: selectedCompany?.feature_flags ?? null,
    isFeatureEnabled: (key: string) => checkFeature(selectedCompany?.feature_flags, key),
    selectCompany,
    refreshCompanies,
  }), [companies, selectedCompany, userCompany, isLoadingCompanies, isMaster, selectCompany, refreshCompanies]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
