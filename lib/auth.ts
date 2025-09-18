const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  plan: string;
  tokensUsed: number;
  tokensLimit: number;
  createdAt: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionEndDate?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  accessToken?: string;
  requiresVerification?: boolean;
  userId?: string; // Added for verification flow
}

export interface AuthError {
  error: string;
}

class AuthService {
  private isAuthenticated: boolean = false;
  private accessToken: string | null = null;

  constructor() {
    // Check if user data exists
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');
      this.isAuthenticated = !!userData;
      this.accessToken = accessToken;
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for refresh token
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    // Special handling for verification required
    if (response.status === 403 && data.requiresVerification) {
      return {
        message: data.error,
        requiresVerification: true,
        userId: data.userId,
        user: data.user
      };
    }

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store non-sensitive user data
    if (typeof window !== 'undefined') {
      const safeUserData = {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        role: data.user.role,
        plan: data.user.plan
      };
      localStorage.setItem('user', JSON.stringify(safeUserData));
    }

    this.isAuthenticated = true;
    return data;
  }

  async register(email: string, password: string, firstName?: string, lastName?: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // If verification is required, don't store tokens yet
    if (data.requiresVerification) {
      return data;
    }

    // Store access token only if no verification required
    this.accessToken = data.accessToken;
    if (typeof window !== 'undefined' && data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  }

  async verifyEmail(userId: string, code: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ userId, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Verification failed');
    }

    // Store tokens after successful verification
    if (data.accessToken) {
      this.accessToken = data.accessToken;
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    }

    return data;
  }

  async resendVerification(userId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to resend verification code');
    }

    return data;
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint to clear server-side session and cookies
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear auth state
      this.isAuthenticated = false;
      
      if (typeof window !== 'undefined') {
        // Clear non-sensitive user data
        localStorage.removeItem('user');
        localStorage.removeItem('preferences');
      }
    }
  }

  async getProfile(): Promise<User> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      credentials: 'include', // Sends cookies automatically
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try to refresh
        await this.refreshToken();
        return this.getProfile(); // Retry with new token
      }
      throw new Error(data.error || 'Failed to get profile');
    }

    return data.user;
  }

  async refreshToken(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      // Refresh failed, user needs to login again
      this.logout();
      throw new Error('Session expired');
    }

    this.accessToken = data.accessToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', data.accessToken);
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getIsAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  setCurrentUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  // Helper method for making authenticated API calls
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('No access token');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
      },
      credentials: 'include',
    });

    if (response.status === 401) {
      // Try to refresh token
      try {
        await this.refreshToken();
        // Retry the original request with new token
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${this.accessToken}`,
          },
          credentials: 'include',
        });
      } catch {
        // Refresh failed, redirect to login
        this.logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Session expired');
      }
    }

    return response;
  }
}

// Export singleton instance
export const authService = new AuthService(); 