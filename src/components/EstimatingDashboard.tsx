import React, { useState } from 'react';
import { FileText, Package, Briefcase, DollarSign, Settings } from 'lucide-react';
import { Estimates } from './Estimates';
import { PartsInventory } from './PartsInventory';
import { AccountingCodes } from './AccountingCodes';
import { LaborCodes } from './LaborCodes';

interface EstimatingDashboardProps {
  userId: string;
}

type TabType = 'estimates' | 'parts' | 'settings';

export function EstimatingDashboard({ userId }: EstimatingDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('estimates');

  const tabs = [
    { id: 'estimates' as TabType, label: 'Estimates & Work Orders', icon: FileText },
    { id: 'parts' as TabType, label: 'Parts Inventory', icon: Package },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings }
  ];

  const [settingsSubTab, setSettingsSubTab] = useState<'labor' | 'accounting'>('labor');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4 py-4">
            <Briefcase className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Estimating System</h1>
          </div>
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'estimates' && (
          <Estimates userId={userId} />
        )}

        {activeTab === 'parts' && (
          <PartsInventory userId={userId} />
        )}

        {activeTab === 'settings' && (
          <div className="p-6">
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                  <button
                    onClick={() => setSettingsSubTab('labor')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'labor'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Labor Codes
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('accounting')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'accounting'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Accounting Codes
                  </button>
                </nav>
              </div>
            </div>

            {settingsSubTab === 'labor' && <LaborCodes userId={userId} />}
            {settingsSubTab === 'accounting' && <AccountingCodes userId={userId} />}
          </div>
        )}
      </div>
    </div>
  );
}