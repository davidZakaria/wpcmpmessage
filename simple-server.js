import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Store code verifiers temporarily (in production, use Redis or database)
const codeVerifiers = new Map();

// OAuth configurations
const getOAuthConfig = (platform) => {
  const configs = {
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      userInfoUrl: 'https://api.twitter.com/2/users/me'
    },
    youtube: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true'
    }
  };
  return configs[platform];
};

// Exchange authorization code for access token
const exchangeCodeForToken = async (platform, code, state) => {
  const config = getOAuthConfig(platform);
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  console.log(`🔄 Exchanging code for ${platform} token...`, {
    hasClientId: !!config.clientId,
    hasClientSecret: !!config.clientSecret,
    codeLength: code?.length || 0,
    state
  });

  let tokenRequestBody;
  
  if (platform === 'twitter') {
    // Get stored code verifier
    const codeVerifier = codeVerifiers.get(state);
    if (!codeVerifier) {
      throw new Error('Code verifier not found for state: ' + state);
    }
    
    tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `http://localhost:${PORT}/auth/${platform}/callback`,
      client_id: config.clientId,
      code_verifier: codeVerifier
    });
    
    // Clean up code verifier
    codeVerifiers.delete(state);
  } else {
    // Standard OAuth2 flow for other platforms
    tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `http://localhost:${PORT}/auth/${platform}/callback`,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenRequestBody
  });

  const responseText = await response.text();
  console.log(`📡 Token exchange response for ${platform}:`, {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    responseLength: responseText.length
  });

  if (!response.ok) {
    console.error(`❌ Token exchange failed for ${platform}:`, responseText);
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  return JSON.parse(responseText);
};

// Get user info
const getUserInfo = async (platform, accessToken) => {
  const config = getOAuthConfig(platform);
  const response = await fetch(config.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  const responseText = await response.text();
  console.log(`📡 User info response for ${platform}:`, {
    status: response.status,
    ok: response.ok,
    responseLength: responseText.length
  });

  if (!response.ok) {
    console.error(`❌ User info failed for ${platform}:`, responseText);
    throw new Error(`User info failed: ${response.status} ${response.statusText}`);
  }

  return JSON.parse(responseText);
};

// Store code verifier endpoint
app.post('/auth/:platform/store-verifier', (req, res) => {
  const { platform } = req.params;
  const { state, codeVerifier } = req.body;
  
  console.log(`💾 Storing code verifier for ${platform}:`, { state, hasVerifier: !!codeVerifier });
  codeVerifiers.set(state, codeVerifier);
  
  res.json({ success: true });
});

// Enhanced OAuth callback with server-side token exchange
app.get('/auth/:platform/callback', async (req, res) => {
  const { platform } = req.params;
  const { code, state, error } = req.query;
  
  console.log(`✅ OAuth callback for ${platform}:`, { 
    code: code ? 'received' : 'missing', 
    state, 
    error 
  });

  // Handle OAuth errors
  if (error) {
    console.log(`❌ OAuth error for ${platform}:`, error);
    return res.send(createErrorPage(platform, error));
  }

  if (!code) {
    console.log(`❌ No code for ${platform}`);
    return res.send(createErrorPage(platform, 'No authorization code'));
  }

  try {
    // Exchange code for access token
    console.log(`🔄 Starting server-side token exchange for ${platform}...`);
    const tokenData = await exchangeCodeForToken(platform, code, state);
    
    if (!tokenData.access_token) {
      throw new Error('No access token in response');
    }

    // Get user info
    console.log(`👤 Getting user info for ${platform}...`);
    const userInfo = await getUserInfo(platform, tokenData.access_token);
    
    // Create credentials object
    const credentials = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      userInfo: userInfo,
      connectedAt: new Date().toISOString()
    };

    console.log(`🎉 Successfully completed OAuth for ${platform}:`, {
      hasAccessToken: !!credentials.accessToken,
      hasRefreshToken: !!credentials.refreshToken,
      expiresIn: credentials.expiresIn,
      userId: userInfo.id || userInfo.data?.[0]?.id
    });

    // Send success page with credentials
    return res.send(createSuccessPageWithCredentials(platform, credentials));

  } catch (error) {
    console.error(`💥 OAuth processing failed for ${platform}:`, error);
    return res.send(createErrorPage(platform, error.message));
  }
});

// Helper functions for creating response pages
const createErrorPage = (platform, error) => {
  return `
    <!DOCTYPE html>
    <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px; background: #ff6b6b; color: white;">
        <h1>❌ Authorization Failed</h1>
        <p>Platform: ${platform}</p>
        <p>Error: ${error}</p>
        <script>
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.location.href = 'http://localhost:3001?oauth_error=${platform}&error=${encodeURIComponent(error)}';
            }
          } catch (e) {
            console.log('⚠️ Redirect failed:', e);
          }
          setTimeout(() => window.close(), 2000);
        </script>
      </body>
    </html>
  `;
};

const createSuccessPageWithCredentials = (platform, credentials) => {
  const userName = credentials.userInfo?.username || credentials.userInfo?.name || credentials.userInfo?.data?.[0]?.name || 'User';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth Success</title>
        <meta charset="utf-8">
      </head>
      <body style="font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
        <h1>✅ Authorization Successful!</h1>
        <p>Successfully connected to ${platform}</p>
        <p>Welcome, ${userName}!</p>
        <p>Saving credentials and closing window...</p>
        <script>
          console.log('🎉 OAuth success for ${platform} with credentials');
          
          // Store credentials directly from server data
          const credentialsData = {
            accessToken: '${credentials.accessToken}',
            refreshToken: '${credentials.refreshToken || ''}',
            expiresIn: ${credentials.expiresIn || 3600},
            scope: '${credentials.scope || ''}',
            userInfo: ${JSON.stringify(credentials.userInfo || {}).replace(/"/g, '\\"')},
            connectedAt: '${credentials.connectedAt}'
          };
          
          // Store credentials in localStorage
          try {
            localStorage.setItem('social_mod_${platform}_credentials', JSON.stringify(credentialsData));
            console.log('💾 Stored credentials for ${platform}');
          } catch (e) {
            console.log('⚠️ Credential storage failed:', e);
          }
          
          // Store success flag
          try {
            localStorage.setItem('oauth_result_${platform}', JSON.stringify({
              success: true,
              platform: '${platform}',
              timestamp: Date.now(),
              credentials: credentialsData
            }));
            console.log('💾 Stored success flag for ${platform}');
          } catch (e) {
            console.log('⚠️ Success flag storage failed:', e);
          }
          
          // Redirect parent to show success
          try {
            if (window.opener && !window.opener.closed) {
              const url = 'http://localhost:3001?oauth_success=${platform}&user=${encodeURIComponent(userName)}';
              window.opener.location.href = url;
              console.log('🔄 Redirected parent to show success');
            }
          } catch (e) {
            console.log('⚠️ Redirect failed:', e);
          }
          
          // Close window
          setTimeout(() => {
            console.log('🔚 Closing OAuth popup');
            try {
              window.close();
            } catch (e) {
              console.log('⚠️ Could not close window:', e);
            }
          }, 2000);
        </script>
      </body>
    </html>
  `;
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Simple OAuth Server running on port ${PORT}`);
  console.log(`✅ OAuth callbacks: http://localhost:${PORT}/auth/{platform}/callback`);
});
