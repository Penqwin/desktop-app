import React from 'react';
import McpKeysConfig from '@/components/Settings/McpKeysConfig';

const SettingsPage = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        <McpKeysConfig />
      </div>
    </div>
  );
};

export default SettingsPage;
