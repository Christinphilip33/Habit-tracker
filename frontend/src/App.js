import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import Layout from './components/Layout';
import './index.css';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6]" data-testid="loading-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#E6DFD4] border-t-[#C86B53] animate-spin mx-auto mb-4" />
          <p className="text-[#5C6B61] font-medium" style={{ fontFamily: 'Outfit' }}>Loading HabitFlow...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <Layout />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
