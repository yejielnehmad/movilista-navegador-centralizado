
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import SideMenu from '@/components/SideMenu';
import ProgressBar from '@/components/ProgressBar';
import { useGemini } from '@/contexts/GeminiContext';
import { GeminiConnectionStatus } from '@/services/gemini';

const MainLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { connectionStatus } = useGemini();
  
  // Map Gemini connection status to progress bar status
  const getProgressStatus = () => {
    switch (connectionStatus) {
      case GeminiConnectionStatus.CONNECTED:
        return 'complete';
      case GeminiConnectionStatus.CONNECTING:
        return 'loading';
      case GeminiConnectionStatus.ERROR:
        return 'error';
      case GeminiConnectionStatus.DISCONNECTED:
      default:
        return 'idle';
    }
  };
  
  // Calculate progress percentage based on connection status
  const getProgressPercentage = () => {
    switch (connectionStatus) {
      case GeminiConnectionStatus.CONNECTED:
        return 100;
      case GeminiConnectionStatus.CONNECTING:
        return 50;
      case GeminiConnectionStatus.ERROR:
      case GeminiConnectionStatus.DISCONNECTED:
      default:
        return 0;
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <TopBar onMenuToggle={toggleMenu} />
      <ProgressBar 
        progress={getProgressPercentage()} 
        status={getProgressStatus()} 
      />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <main className="flex-1 pt-[calc(3.5rem+0.25rem)] pb-4 px-4 max-w-screen-xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
