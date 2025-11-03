import { api } from './api';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

export interface ResetPasswordData {
  email: string;
}

export interface NewPasswordData {
  token: string;
  password: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'agent';
  workspace?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface SSOInitResponse {
  redirectUrl: string;
  state: string;
  codeChallenge: string;
}

export interface SSOCallbackData {
  provider: 'google' | 'apple';
  code: string;
  state: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse | { data?: AuthResponse; success?: boolean }>(
      '/auth/login',
      credentials,
    );

    const payload =
      (response.data as { data?: AuthResponse; success?: boolean })?.data ??
      (response.data as AuthResponse);

    if (!payload?.user || !payload?.token) {
      throw new Error('Resposta de autenticação inválida');
    }

    return {
      user: payload.user,
      token: payload.token,
      refreshToken: payload.refreshToken ?? payload.token,
      expiresIn: payload.expiresIn,
    };
  },

  async register(data: RegisterData): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/register', data);
    return response.data;
  },

  async resetPassword(data: ResetPasswordData): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/reset-password', data);
    return response.data;
  },

  async newPassword(data: NewPasswordData): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/new-password', data);
    return response.data;
  },

  async ssoInit(provider: 'google' | 'apple'): Promise<SSOInitResponse> {
    const response = await api.post<SSOInitResponse>(`/auth/sso/${provider}/init`);
    return response.data;
  },

  async ssoCallback(data: SSOCallbackData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(`/auth/sso/${data.provider}/callback`, data);
    return response.data;
  },

  async refreshToken(token: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse | { data?: AuthResponse; success?: boolean }>(
      '/auth/refresh',
      { token },
    );

    const payload =
      (response.data as { data?: AuthResponse; success?: boolean })?.data ??
      (response.data as AuthResponse);

    if (!payload?.user || !payload?.token) {
      throw new Error('Resposta de autenticação inválida');
    }

    return {
      user: payload.user,
      token: payload.token,
      refreshToken: payload.refreshToken ?? payload.token,
      expiresIn: payload.expiresIn,
    };
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async me(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};
