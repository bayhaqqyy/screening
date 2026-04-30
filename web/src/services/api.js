const BASE_URL = import.meta.env.VITE_API_URL || 'http://0.0.0.0:8080/api';

async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('authed_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'API Error');
  }

  return data;
}

export const api = {
  get: (endpoint) => fetchWithAuth(endpoint, { method: 'GET' }),
  post: (endpoint, body) => fetchWithAuth(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => fetchWithAuth(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => fetchWithAuth(endpoint, { method: 'DELETE' }),
};
