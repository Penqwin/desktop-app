import React from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GeminiKeyConfig from '@/components/Settings/GeminiKeyConfig';

const SettingsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
            title="Go back"
          >
            <ArrowBackIcon />
          </button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <GeminiKeyConfig />
      </div>
    </div>
  );
};

export default SettingsPage;
