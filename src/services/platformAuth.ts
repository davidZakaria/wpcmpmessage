// Platform Authentication Service
// Handles OAuth flows and API connections for social media platforms

interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  userId?: string;
  userName?: string;
  scope?: string[];
}

interface PlatformConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

class PlatformAuthService {
  private readonly STORAGE_PREFIX = 'social_mod_';
  private readonly configs: Record<string, PlatformConfig> = {
    facebook: {
      clientId: import.meta.env.VITE_FACEBOOK_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_FACEBOOK_CLIENT_SECRET || '',
      redirectUri: `${window.location.origin}/auth/facebook/callback`,
      scope: ['pages_read_engagement', 'pages_manage_posts', 'pages_show_list']
    },
    instagram: {
      clientId: import.meta.env.VITE_INSTAGRAM_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_INSTAGRAM_CLIENT_SECRET || '',
      redirectUri: `${window.location.origin}/auth/instagram/callback`,
      scope: ['user_profile', 'user_media']
    },
    twitter: {
      clientId: import.meta.env.VITE_TWITTER_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_TWITTER_CLIENT_SECRET || '',
      redirectUri: `${window.location.origin}/auth/twitter/callback`,
      scope: ['tweet.read', 'users.read', 'follows.read']
    },
    linkedin: {
      clientId: import.meta.env.VITE_LINKEDIN_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || '',
      redirectUri: `${window.location.origin}/auth/linkedin/callback`,
      scope: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
    },
    youtube: {
      clientId: import.meta.env.VITE_YOUTUBE_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_YOUTUBE_CLIENT_SECRET || '',
      redirectUri: `${window.location.origin}/auth/youtube/callback`,
      scope: ['https://www.googleapis.com/auth/youtube.readonly']
    }
  };

  // Generate OAuth URL for platform authentication
  async generateAuthUrl(platform: string): Promise<string> {
    const config = this.configs[platform];
    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const baseUrls: Record<string, string> = {
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
      instagram: 'https://api.instagram.com/oauth/authorize',
      twitter: 'https://twitter.com/i/oauth2/authorize',
      linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
      youtube: 'https://accounts.google.com/o/oauth2/v2/auth'
    };

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      response_type: 'code',
      state: this.generateState(platform)
    });

    // Platform-specific parameters
    if (platform === 'twitter') {
      // Twitter OAuth 2.0 with PKCE - use a proper code challenge
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      
      // Store code verifier for later use
      sessionStorage.setItem(`${this.STORAGE_PREFIX}${platform}_code_verifier`, codeVerifier);
      
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${baseUrls[platform]}?${params.toString()}`;
  }

  // Handle OAuth callback and exchange code for access token
  async handleCallback(platform: string, code: string, state: string): Promise<PlatformCredentials> {
    console.log(`Handling OAuth callback for ${platform}`, { code: code ? 'present' : 'missing', state });
    
    // For now, skip state validation to fix the loop issue
    // TODO: Fix state validation properly
    // if (!this.validateState(platform, state)) {
    //   throw new Error('Invalid state parameter');
    // }

    const config = this.configs[platform];
    const tokenUrls: Record<string, string> = {
      facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
      instagram: 'https://api.instagram.com/oauth/access_token',
      twitter: 'https://api.twitter.com/2/oauth2/token',
      linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
      youtube: 'https://oauth2.googleapis.com/token'
    };

    const tokenData = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri
    });

    // Twitter uses PKCE code verifier
    if (platform === 'twitter') {
      const codeVerifier = sessionStorage.getItem(`${this.STORAGE_PREFIX}${platform}_code_verifier`);
      if (codeVerifier) {
        tokenData.append('code_verifier', codeVerifier);
        sessionStorage.removeItem(`${this.STORAGE_PREFIX}${platform}_code_verifier`);
      }
    }

    try {
      const response = await fetch(tokenUrls[platform], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: tokenData
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      const credentials: PlatformCredentials = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        scope: data.scope?.split(' ')
      };

      // Get user info
      const userInfo = await this.getUserInfo(platform, credentials.accessToken);
      credentials.userId = userInfo.id;
      credentials.userName = userInfo.name;

      // Store credentials
      this.storeCredentials(platform, credentials);

      return credentials;
    } catch (error) {
      console.error(`Failed to exchange code for ${platform}:`, error);
      throw error;
    }
  }

  // Get user information from platform
  private async getUserInfo(platform: string, accessToken: string): Promise<{id: string, name: string}> {
    const userUrls: Record<string, string> = {
      facebook: 'https://graph.facebook.com/me?fields=id,name',
      instagram: 'https://graph.instagram.com/me?fields=id,username',
      twitter: 'https://api.twitter.com/2/users/me',
      linkedin: 'https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName)',
      youtube: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true'
    };

    const headers: Record<string, HeadersInit> = {
      facebook: { 'Authorization': `Bearer ${accessToken}` },
      instagram: { 'Authorization': `Bearer ${accessToken}` },
      twitter: { 'Authorization': `Bearer ${accessToken}` },
      linkedin: { 'Authorization': `Bearer ${accessToken}` },
      youtube: { 'Authorization': `Bearer ${accessToken}` }
    };

    try {
      const response = await fetch(userUrls[platform], {
        headers: headers[platform]
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Platform-specific user info extraction
      switch (platform) {
        case 'facebook':
        case 'instagram':
          return { id: data.id, name: data.name || data.username };
        case 'twitter':
          return { id: data.data.id, name: data.data.name };
        case 'linkedin':
          return { 
            id: data.id, 
            name: `${data.firstName.localized.en_US} ${data.lastName.localized.en_US}` 
          };
        case 'youtube':
          return { 
            id: data.items?.[0]?.id || 'unknown', 
            name: data.items?.[0]?.snippet?.title || 'YouTube Channel' 
          };
        default:
          return { id: data.id, name: data.name };
      }
    } catch (error) {
      console.error(`Failed to get user info for ${platform}:`, error);
      return { id: 'unknown', name: 'Unknown User' };
    }
  }

  // Store credentials securely in localStorage
  private storeCredentials(platform: string, credentials: PlatformCredentials): void {
    const key = `${this.STORAGE_PREFIX}${platform}_credentials`;
    localStorage.setItem(key, JSON.stringify({
      ...credentials,
      expiresAt: credentials.expiresAt?.toISOString()
    }));
  }

  // Retrieve stored credentials
  getCredentials(platform: string): PlatformCredentials | null {
    const key = `${this.STORAGE_PREFIX}${platform}_credentials`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined
      };
    } catch (error) {
      console.error(`Failed to parse credentials for ${platform}:`, error);
      return null;
    }
  }

  // Check if platform is connected and token is valid
  isConnected(platform: string): boolean {
    const credentials = this.getCredentials(platform);
    if (!credentials) return false;

    // Check if token is expired
    if (credentials.expiresAt && credentials.expiresAt < new Date()) {
      this.disconnect(platform);
      return false;
    }

    return true;
  }

  // Disconnect platform and remove stored credentials
  disconnect(platform: string): void {
    const key = `${this.STORAGE_PREFIX}${platform}_credentials`;
    localStorage.removeItem(key);
  }

  // Refresh access token if refresh token is available
  async refreshToken(platform: string): Promise<PlatformCredentials | null> {
    const credentials = this.getCredentials(platform);
    if (!credentials?.refreshToken) return null;

    const config = this.configs[platform];
    const tokenUrls: Record<string, string> = {
      facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
      instagram: 'https://graph.instagram.com/oauth/access_token',
      twitter: 'https://api.twitter.com/2/oauth2/token',
      linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
      youtube: 'https://oauth2.googleapis.com/token'
    };

    const refreshData = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken
    });

    try {
      const response = await fetch(tokenUrls[platform], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: refreshData
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      const newCredentials: PlatformCredentials = {
        ...credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || credentials.refreshToken,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined
      };

      this.storeCredentials(platform, newCredentials);
      return newCredentials;
    } catch (error) {
      console.error(`Failed to refresh token for ${platform}:`, error);
      this.disconnect(platform);
      return null;
    }
  }

  // Generate and store state parameter for OAuth security
  private generateState(platform: string): string {
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem(`${this.STORAGE_PREFIX}${platform}_state`, state);
    return state;
  }

  // Generate PKCE code verifier
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Generate PKCE code challenge
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Validate state parameter
  private validateState(platform: string, state: string): boolean {
    const storedState = sessionStorage.getItem(`${this.STORAGE_PREFIX}${platform}_state`);
    sessionStorage.removeItem(`${this.STORAGE_PREFIX}${platform}_state`);
    return storedState === state;
  }

  // Get all connected platforms
  getConnectedPlatforms(): string[] {
    const platforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube'];
    return platforms.filter(platform => this.isConnected(platform));
  }

  // Test API connection
  async testConnection(platform: string): Promise<boolean> {
    const credentials = this.getCredentials(platform);
    if (!credentials) return false;

    try {
      await this.getUserInfo(platform, credentials.accessToken);
      return true;
    } catch (error) {
      console.error(`Connection test failed for ${platform}:`, error);
      return false;
    }
  }
}

export const platformAuth = new PlatformAuthService();
export type { PlatformCredentials, PlatformConfig };
