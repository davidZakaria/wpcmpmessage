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
          const userInfo = ${JSON.stringify(credentials.userInfo || {}).replace(/"/g, '\\"')};
          const userId = userInfo.data ? userInfo.data.id : userInfo.id;
          const userName = userInfo.data ? (userInfo.data.name || userInfo.data.username) : (userInfo.name || userInfo.username);
          
          const credentialsData = {
            accessToken: '${credentials.accessToken}',
            refreshToken: '${credentials.refreshToken || ''}',
            expiresIn: ${credentials.expiresIn || 3600},
            scope: '${credentials.scope || ''}',
            userId: userId,
            userName: userName,
            userInfo: userInfo,
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
};

// Twitter content endpoint
app.get('/api/twitter/content', async (req, res) => {
  const { userId, accessToken, limit = 25 } = req.query;
  
  console.log(`📱 Twitter content request:`, { 
    userId: userId ? 'present' : 'missing',
    hasAccessToken: !!accessToken,
    limit 
  });

  if (!userId || userId === 'undefined') {
    return res.status(400).json({ 
      error: 'Missing or invalid userId',
      details: 'userId is required and cannot be undefined'
    });
  }

  if (!accessToken) {
    return res.status(400).json({ 
      error: 'Missing access token',
      details: 'accessToken is required'
    });
  }

  try {
    // Fetch user's tweets from Twitter API with conversation data
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=${Math.min(limit, 100)}&tweet.fields=created_at,author_id,public_metrics,context_annotations,conversation_id,in_reply_to_user_id,referenced_tweets&expansions=author_id,in_reply_to_user_id,referenced_tweets.id&user.fields=name,username,profile_image_url,verified`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const tweetsData = await tweetsResponse.json();

    if (!tweetsResponse.ok) {
      console.error(`❌ Twitter API error:`, tweetsData);
      return res.status(tweetsResponse.status).json({
        error: 'Twitter API error',
        details: tweetsData.detail || tweetsData.title || 'Unknown error',
        twitterError: tweetsData
      });
    }

    console.log(`✅ Successfully fetched ${tweetsData.data?.length || 0} tweets for user ${userId}`);

    // For each tweet, fetch replies if it has any
    const tweetsWithReplies = [];
    
    if (tweetsData.data) {
      for (const tweet of tweetsData.data) {
        const tweetWithReplies = { ...tweet, replies: [] };
        
        // Fetch replies to this tweet
        try {
          const repliesResponse = await fetch(
            `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${tweet.conversation_id} -from:${userId}&max_results=100&tweet.fields=created_at,author_id,public_metrics,in_reply_to_user_id&expansions=author_id&user.fields=name,username,profile_image_url,verified`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );
          
          if (repliesResponse.ok) {
            const repliesData = await repliesResponse.json();
            tweetWithReplies.replies = repliesData.data || [];
            
            // Merge reply authors into includes
            if (repliesData.includes?.users) {
              if (!tweetsData.includes) tweetsData.includes = {};
              if (!tweetsData.includes.users) tweetsData.includes.users = [];
              
              // Add new users, avoiding duplicates
              for (const user of repliesData.includes.users) {
                if (!tweetsData.includes.users.find(u => u.id === user.id)) {
                  tweetsData.includes.users.push(user);
                }
              }
            }
            
            console.log(`📬 Found ${tweetWithReplies.replies.length} replies for tweet ${tweet.id}`);
          }
        } catch (replyError) {
          console.warn(`⚠️ Could not fetch replies for tweet ${tweet.id}:`, replyError.message);
        }
        
        tweetsWithReplies.push(tweetWithReplies);
      }
    }
    
    res.json({
      data: tweetsWithReplies,
      includes: tweetsData.includes || {},
      meta: tweetsData.meta || {}
    });

  } catch (error) {
    console.error(`💥 Twitter content fetch error:`, error);
    res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
});

// Twitter moderation actions
app.post('/api/twitter/mute-user', async (req, res) => {
  const { userId, targetUserId, accessToken } = req.body;
  
  console.log(`🔇 Muting user ${targetUserId} for ${userId}`);

  try {
    const response = await fetch(
      `https://api.twitter.com/2/users/${userId}/muting`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_user_id: targetUserId
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Mute user failed:`, data);
      return res.status(response.status).json({
        error: 'Mute failed',
        details: data.detail || data.title || 'Unknown error',
        twitterError: data
      });
    }

    console.log(`✅ Successfully muted user ${targetUserId}`);
    res.json({ success: true, data });

  } catch (error) {
    console.error(`💥 Mute user error:`, error);
    res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
});

app.post('/api/twitter/block-user', async (req, res) => {
  const { userId, targetUserId, accessToken } = req.body;
  
  console.log(`🚫 Blocking user ${targetUserId} for ${userId}`);

  try {
    const response = await fetch(
      `https://api.twitter.com/2/users/${userId}/blocking`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_user_id: targetUserId
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Block user failed:`, data);
      return res.status(response.status).json({
        error: 'Block failed',
        details: data.detail || data.title || 'Unknown error',
        twitterError: data
      });
    }

    console.log(`✅ Successfully blocked user ${targetUserId}`);
    res.json({ success: true, data });

  } catch (error) {
    console.error(`💥 Block user error:`, error);
    res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
});

app.post('/api/twitter/hide-reply', async (req, res) => {
  const { tweetId, accessToken } = req.body;
  
  console.log(`👁️ Hiding reply ${tweetId}`);

  try {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}/hidden`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hidden: true
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Hide reply failed:`, data);
      return res.status(response.status).json({
        error: 'Hide reply failed',
        details: data.detail || data.title || 'Unknown error',
        twitterError: data
      });
    }

    console.log(`✅ Successfully hid reply ${tweetId}`);
    res.json({ success: true, data });

  } catch (error) {
    console.error(`💥 Hide reply error:`, error);
    res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
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
