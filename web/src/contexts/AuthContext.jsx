import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('authed_user');
      const token = localStorage.getItem('auth_token');
      
      if (savedUser && token) {
        try {
          setUser(JSON.parse(savedUser));
          // Optionally validate token here via GET /api/auth/me
        } catch (e) {
          console.error("Failed to parse user from local storage", e);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (credentials) => {
    try {
      const data = await api.post('/auth/login', credentials);
      setUser(data.user);
      localStorage.setItem('authed_user', JSON.stringify(data.user));
      localStorage.setItem('auth_token', data.token);
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authed_user');
    localStorage.removeItem('auth_token');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
