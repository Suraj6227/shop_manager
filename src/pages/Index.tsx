import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/Layout/Sidebar';
import InventoryManager from '@/components/Inventory/InventoryManager';
import SalesInterface from '@/components/Sales/SalesInterface';
import BarcodeScannerInterface from '@/components/Scanner/BarcodeScannerInterface';
import ReportsSection from '@/components/Reports/ReportsSection';
import SettingsSection from '@/components/Settings/SettingsSection';

const Index = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'inventory':
        return <InventoryManager />;
      case 'sales':
        return <SalesInterface />;
      case 'scanner':
        return <BarcodeScannerInterface />;
      case 'reports':
        return <ReportsSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <InventoryManager />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="lg:ml-64">
        <main className="min-h-screen">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;
