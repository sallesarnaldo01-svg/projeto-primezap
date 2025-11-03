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
  // Avoid pages stuck in loading when API is unreachable
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15000),
  withCredentials: true,
});

type PersistedAuthState = {
  state?: {
    token?: string;
    user?: { tenantId?: string; workspace?: string | null } | null;
  };
};

const AUTH_STORAGE_KEY = 'primezap-auth';
const TENANT_STORAGE_KEY = 'tenantId';

const safeParse = (value: string | null): PersistedAuthState | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as PersistedAuthState;
  } catch (error) {
    console.error('Error parsing auth storage', error);
    return null;
  }
};

const resolveTenantId = (authState: PersistedAuthState | null): string | null => {
  const storedTenant =
    authState?.state?.user?.tenantId ??
    authState?.state?.user?.workspace ??
    (typeof window !== 'undefined' ? window.localStorage.getItem(TENANT_STORAGE_KEY) : null);

  if (storedTenant && storedTenant.trim().length > 0) {
    return storedTenant.trim();
  }

  return null;
};

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window === 'undefined') {
      return config;
    }

    const authData = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const authState = safeParse(authData);

    if (authState?.state?.token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${authState.state.token}`;
    }

    const tenantId = resolveTenantId(authState);
    if (tenantId) {
      config.headers = config.headers ?? {};
      config.headers['x-tenant-id'] = tenantId;
    } else if (config.headers) {
      config.headers['x-tenant-id'] = 'default';
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
