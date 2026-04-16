import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Scalping from './pages/Scalping';
import Swing from './pages/Swing';
import BSJP from './pages/BSJP';
import News from './pages/News';
import Watchlist from './pages/Watchlist';
import Settings from './pages/Settings';
import Login from './pages/Login';

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="scalping" element={<Scalping />} />
          <Route path="swing" element={<Swing />} />
          <Route path="bsjp" element={<BSJP />} />
          <Route path="news" element={<News />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
