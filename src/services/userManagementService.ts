// User Management Service
// Handles user authentication, roles, and permissions

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'moderator' | 'analyst' | 'viewer';
  permissions: Permission[];
  organizationId: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

interface Permission {
  resource: string; // 'content', 'rules', 'users', 'analytics', 'settings'
  actions: string[]; // 'read', 'write', 'delete', 'approve', 'reject'
}

interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'professional' | 'enterprise';
  settings: {
    maxUsers: number;
    maxPlatforms: number;
    aiAnalysisEnabled: boolean;
    customRulesEnabled: boolean;
    apiAccessEnabled: boolean;
  };
  createdAt: Date;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthToken {
  token: string;
  expiresAt: Date;
  user: User;
}

class UserManagementService {
  private currentUser: User | null = null;
  private authToken: string | null = null;

  // Role-based permissions configuration
  private readonly rolePermissions: Record<string, Permission[]> = {
    admin: [
      { resource: 'content', actions: ['read', 'write', 'delete', 'approve', 'reject'] },
      { resource: 'rules', actions: ['read', 'write', 'delete'] },
      { resource: 'users', actions: ['read', 'write', 'delete'] },
      { resource: 'analytics', actions: ['read', 'write'] },
      { resource: 'settings', actions: ['read', 'write'] },
      { resource: 'platforms', actions: ['read', 'write', 'delete'] }
    ],
    moderator: [
      { resource: 'content', actions: ['read', 'approve', 'reject'] },
      { resource: 'rules', actions: ['read'] },
      { resource: 'analytics', actions: ['read'] },
      { resource: 'platforms', actions: ['read'] }
    ],
    analyst: [
      { resource: 'content', actions: ['read'] },
      { resource: 'analytics', actions: ['read', 'write'] },
      { resource: 'rules', actions: ['read'] }
    ],
    viewer: [
      { resource: 'content', actions: ['read'] },
      { resource: 'analytics', actions: ['read'] }
    ]
  };

  constructor() {
    this.loadStoredAuth();
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    try {
      console.log('🔐 Attempting login for:', credentials.email);
      
      // In a real implementation, this would validate against the database
      // For now, we'll create a mock user for demonstration
      const mockUser: User = {
        id: 'user_' + Date.now(),
        email: credentials.email,
        name: credentials.email.split('@')[0],
        role: 'admin', // Default to admin for demo
        permissions: this.rolePermissions.admin,
        organizationId: 'org_demo',
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true
      };

      const token = this.generateAuthToken();
      const authToken: AuthToken = {
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        user: mockUser
      };

      this.currentUser = mockUser;
      this.authToken = token;
      this.storeAuth(authToken);

      console.log('✅ Login successful for:', mockUser.name);
      return authToken;
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw new Error('Invalid credentials');
    }
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    this.authToken = null;
    this.clearStoredAuth();
    console.log('👋 User logged out');
  }

  // User management
  async createUser(userData: {
    email: string;
    name: string;
    role: string;
    organizationId: string;
  }): Promise<User> {
    if (!this.hasPermission('users', 'write')) {
      throw new Error('Insufficient permissions to create users');
    }

    const newUser: User = {
      id: 'user_' + Date.now(),
      email: userData.email,
      name: userData.name,
      role: userData.role as any,
      permissions: this.rolePermissions[userData.role] || this.rolePermissions.viewer,
      organizationId: userData.organizationId,
      createdAt: new Date(),
      isActive: true
    };

    console.log('👤 Created new user:', newUser.name);
    return newUser;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    if (!this.hasPermission('users', 'write')) {
      throw new Error('Insufficient permissions to update users');
    }

    // In a real implementation, this would update the database
    console.log('📝 Updated user:', userId, updates);
    
    // Return updated user (mock)
    return {
      id: userId,
      email: updates.email || 'user@example.com',
      name: updates.name || 'User',
      role: updates.role || 'viewer',
      permissions: this.rolePermissions[updates.role || 'viewer'],
      organizationId: updates.organizationId || 'org_demo',
      createdAt: new Date(),
      isActive: updates.isActive !== undefined ? updates.isActive : true
    };
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.hasPermission('users', 'delete')) {
      throw new Error('Insufficient permissions to delete users');
    }

    console.log('🗑️ Deleted user:', userId);
  }

  async getUsers(organizationId: string): Promise<User[]> {
    if (!this.hasPermission('users', 'read')) {
      throw new Error('Insufficient permissions to view users');
    }

    // Mock users for demonstration
    return [
      {
        id: 'user_1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        permissions: this.rolePermissions.admin,
        organizationId,
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true
      },
      {
        id: 'user_2',
        email: 'moderator@example.com',
        name: 'Moderator User',
        role: 'moderator',
        permissions: this.rolePermissions.moderator,
        organizationId,
        createdAt: new Date(),
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
        isActive: true
      }
    ];
  }

  // Permission checking
  hasPermission(resource: string, action: string): boolean {
    if (!this.currentUser) return false;

    return this.currentUser.permissions.some(permission => 
      permission.resource === resource && permission.actions.includes(action)
    );
  }

  canModerateContent(): boolean {
    return this.hasPermission('content', 'approve') || this.hasPermission('content', 'reject');
  }

  canManageUsers(): boolean {
    return this.hasPermission('users', 'write');
  }

  canViewAnalytics(): boolean {
    return this.hasPermission('analytics', 'read');
  }

  canManageSettings(): boolean {
    return this.hasPermission('settings', 'write');
  }

  // Organization management
  async createOrganization(orgData: {
    name: string;
    plan: string;
  }): Promise<Organization> {
    const organization: Organization = {
      id: 'org_' + Date.now(),
      name: orgData.name,
      plan: orgData.plan as any,
      settings: {
        maxUsers: orgData.plan === 'enterprise' ? 100 : orgData.plan === 'professional' ? 25 : 5,
        maxPlatforms: orgData.plan === 'enterprise' ? 20 : orgData.plan === 'professional' ? 10 : 3,
        aiAnalysisEnabled: orgData.plan !== 'free',
        customRulesEnabled: orgData.plan !== 'free',
        apiAccessEnabled: orgData.plan === 'enterprise'
      },
      createdAt: new Date()
    };

    console.log('🏢 Created organization:', organization.name);
    return organization;
  }

  // Current user info
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.authToken !== null;
  }

  getUserRole(): string | null {
    return this.currentUser?.role || null;
  }

  // Activity logging
  async logUserActivity(action: string, resource: string, details?: any): Promise<void> {
    if (!this.currentUser) return;

    const activity = {
      userId: this.currentUser.id,
      action,
      resource,
      details,
      timestamp: new Date()
    };

    console.log('📝 User activity logged:', activity);
    // In a real implementation, this would be saved to the database
  }

  // Session management
  async refreshToken(): Promise<AuthToken | null> {
    if (!this.currentUser || !this.authToken) return null;

    const newToken = this.generateAuthToken();
    const authToken: AuthToken = {
      token: newToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      user: this.currentUser
    };

    this.authToken = newToken;
    this.storeAuth(authToken);

    return authToken;
  }

  // Utility methods
  private generateAuthToken(): string {
    return 'auth_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private storeAuth(authToken: AuthToken): void {
    localStorage.setItem('auth_token', JSON.stringify(authToken));
  }

  private loadStoredAuth(): void {
    try {
      const stored = localStorage.getItem('auth_token');
      if (stored) {
        const authToken: AuthToken = JSON.parse(stored);
        if (new Date() < new Date(authToken.expiresAt)) {
          this.currentUser = authToken.user;
          this.authToken = authToken.token;
          console.log('✅ Restored user session:', this.currentUser.name);
        } else {
          this.clearStoredAuth();
        }
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
      this.clearStoredAuth();
    }
  }

  private clearStoredAuth(): void {
    localStorage.removeItem('auth_token');
  }

  // Password management (placeholder for real implementation)
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    // In a real implementation, this would validate current password and update
    console.log('🔒 Password changed for user:', this.currentUser.email);
  }

  async resetPassword(email: string): Promise<void> {
    // In a real implementation, this would send a password reset email
    console.log('📧 Password reset requested for:', email);
  }
}

// Singleton instance
export const userManagementService = new UserManagementService();

// Export types
export type { User, Permission, Organization, LoginCredentials, AuthToken };
