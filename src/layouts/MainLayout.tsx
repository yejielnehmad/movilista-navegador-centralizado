import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import SideMenu from '@/components/SideMenu';
import ProgressBar from '@/components/ProgressBar';
import { useGemini } from '@/contexts/GeminiContext';
import { GeminiConnectionStatus } from '@/services/gemini';
import { useMessageProcessing } from '@/contexts/MessageProcessingContext';
import { ProcessingProgress, ProcessingStage } from '@/types/processingTypes';

const MainLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { connectionStatus } = useGemini();
  const { registerGlobalListener, activeTask } = useMessageProcessing();
  
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  
  useEffect(() => {
    const unsubscribe = registerGlobalListener((task) => {
      if (task.stage === 'completed') {
        setProcessingStatus(task.status === 'success' ? 'complete' : 'error');
        setProcessingProgress(100);
      } else if (task.stage === 'failed') {
        setProcessingStatus('error');
        setProcessingProgress(100);
      } else {
        setProcessingStatus('loading');
        setProcessingProgress(task.progress);
      }
    });
    
    return unsubscribe;
  }, [registerGlobalListener]);
  
  useEffect(() => {
    if (activeTask) {
      if (activeTask.stage === 'completed') {
        setProcessingStatus(activeTask.status === 'success' ? 'complete' : 'error');
        setProcessingProgress(100);
      } else if (activeTask.stage === 'failed') {
        setProcessingStatus('error');
        setProcessingProgress(100);
      } else {
        setProcessingStatus('loading');
        setProcessingProgress(activeTask.progress);
      }
    }
  }, [activeTask]);
  
  const getProgressStatus = () => {
    if (processingStatus !== 'idle') {
      return processingStatus;
    }
    
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
  
  const getProgressPercentage = () => {
    if (processingStatus !== 'idle') {
      return processingProgress;
    }
    
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
