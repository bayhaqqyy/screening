import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Scalping from './pages/Scalping';
import Swing from './pages/Swing';
import BSJP from './pages/BSJP';
import News from './pages/News';
import Watchlist from './pages/Watchlist';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import StockDetail from './pages/StockDetail';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

import { useWebSocket } from './hooks/useWebSocket';
import { settingsService } from './services/settingsService';

function AppRoutes() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Initialize WS and Global Theme when user is authenticated
  useEffect(() => {
    if (user) {
      settingsService.getSettings().then(res => {
        if (res.data && res.data.theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      }).catch(console.error);
    }
  }, [user]);

  if (user) {
    useWebSocket(); // Starts connection globally
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/register" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="scalping" element={<Scalping />} />
          <Route path="swing" element={<Swing />} />
          <Route path="bsjp" element={<BSJP />} />
          <Route path="news" element={<News />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="settings" element={<Settings />} />
          <Route path="stock/:ticker" element={<StockDetail />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
