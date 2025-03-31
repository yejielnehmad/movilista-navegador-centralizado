
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import SideMenu from '@/components/SideMenu';
import ProgressBar from '@/components/ProgressBar';

const MainLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [progressStatus, setProgressStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <TopBar onMenuToggle={toggleMenu} />
      <ProgressBar progress={progress} status={progressStatus} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <main className="flex-1 pt-[calc(3.5rem+0.25rem)] pb-4 px-4 max-w-screen-xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
