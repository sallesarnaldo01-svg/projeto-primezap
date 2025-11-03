import axios from 'axios';

const sanitizeBaseUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const isLocalHostname = (hostname: string) => {
  if (!hostname) {
    return false;
  }

  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === 'host.docker.internal'
  ) {
    return true;
  }

  if (/^127\./.test(hostname)) {
    return true;
  }

  if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) {
    return true;
  }

  if (/^192\.168\.\d+\.\d+$/.test(hostname)) {
    return true;
  }

  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(hostname)) {
    return true;
  }

  return hostname.endsWith('.local') || hostname.endsWith('.localhost') || hostname.endsWith('.test');
};

const resolveApiBaseUrl = () => {
  const envUrl =
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://api.primezapia.com/api';
  const localUrl = import.meta.env.VITE_API_LOCAL_BASE_URL || 'http://localhost:4000/api';

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;

    if (isLocalHostname(hostname)) {
      return sanitizeBaseUrl(localUrl);
    }
  }

  return sanitizeBaseUrl(envUrl);
};

const API_URL = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const authData = localStorage.getItem('primezap-auth');
    if (authData) {
      try {
        const { state } = JSON.parse(authData);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch (error) {
        console.error('Error parsing auth data:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('primezap-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Mock flag for development
const ENABLE_DEV_MOCK = import.meta.env.VITE_ENABLE_DEV_MOCK === 'true';

export const mockApiCall = <T>(data: T, delay = 500): Promise<T> => {
  if (!ENABLE_DEV_MOCK) {
    throw new Error('Mock is disabled');
  }
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
};
