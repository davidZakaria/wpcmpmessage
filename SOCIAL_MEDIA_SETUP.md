# Social Media Platform Integration Setup Guide

This guide will help you set up API credentials for connecting real social media accounts to the Social Media Moderation system.

## 🚀 Quick Start

1. Copy `env.example` to `.env`
2. Follow the platform-specific setup instructions below
3. Add your API credentials to the `.env` file
4. Restart the development server
5. Navigate to Social Moderation → Platforms tab
6. Click "Connect" on each platform you want to integrate

## 📱 Platform Setup Instructions

### 1. Facebook/Meta API Setup

**What you'll get:** Access to Facebook pages, posts, and comments for moderation.

**Steps:**
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add "Facebook Login" product to your app
4. In App Settings → Basic:
   - Note your **App ID** (this is your `VITE_FACEBOOK_CLIENT_ID`)
   - Note your **App Secret** (this is your `VITE_FACEBOOK_CLIENT_SECRET`)
5. In Facebook Login → Settings:
   - Add redirect URI: `http://localhost:3001/auth/facebook/callback`
6. In App Review → Permissions and Features:
   - Request these permissions: `pages_read_engagement`, `pages_manage_posts`, `pages_show_list`

**Required Environment Variables:**
```bash
VITE_FACEBOOK_CLIENT_ID=your_facebook_app_id_here
VITE_FACEBOOK_CLIENT_SECRET=your_facebook_app_secret_here
```

### 2. Instagram Basic Display API Setup

**What you'll get:** Access to your Instagram media and basic profile info.

**Steps:**
1. Go to [Facebook Developers](https://developers.facebook.com/) (Instagram uses Facebook's platform)
2. Create a new app or use existing one
3. Add "Instagram Basic Display" product
4. In Instagram Basic Display → Basic Display:
   - Note your **Instagram App ID** (this is your `VITE_INSTAGRAM_CLIENT_ID`)
   - Note your **Instagram App Secret** (this is your `VITE_INSTAGRAM_CLIENT_SECRET`)
5. Add redirect URI: `http://localhost:3001/auth/instagram/callback`

### 3. TikTok API Setup

**What you'll get:** Access to TikTok videos and basic profile info for content moderation.

**Steps:**
1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Create a new app or use an existing one
3. In App Settings → Basic:
   - Note your **Client Key** (this is your `VITE_TIKTOK_CLIENT_ID`)
   - Note your **Client Secret** (this is your `VITE_TIKTOK_CLIENT_SECRET`)
4. In OAuth → Settings:
   - Add redirect URI: `http://localhost:3001/auth/tiktok/callback`
5. Request these scopes: `user.info.basic`, `video.list`, `video.publish`

**Required Environment Variables:**
```bash
VITE_TIKTOK_CLIENT_ID=your_tiktok_client_key_here
VITE_TIKTOK_CLIENT_SECRET=your_tiktok_client_secret_here
```

**Note:** TikTok API has limited functionality for content moderation. Video posting requires TikTok for Business API access.
6. Add test users (including your own Instagram account)

**Required Environment Variables:**
```bash
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id_here
VITE_INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret_here
```

### 3. Twitter API v2 Setup

**What you'll get:** Access to tweets, user profiles, and engagement metrics.

**Steps:**
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Apply for a developer account (if you don't have one)
3. Create a new project and app
4. In your app settings:
   - Note your **Client ID** (this is your `VITE_TWITTER_CLIENT_ID`)
   - Note your **Client Secret** (this is your `VITE_TWITTER_CLIENT_SECRET`)
5. Enable OAuth 2.0 and set redirect URI: `http://localhost:3001/auth/twitter/callback`
6. Set required scopes: `tweet.read`, `users.read`, `follows.read`

**Required Environment Variables:**
```bash
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret_here
```

### 4. LinkedIn API Setup

**What you'll get:** Access to LinkedIn posts and professional network content.

**Steps:**
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create a new app
3. In Auth tab:
   - Note your **Client ID** (this is your `VITE_LINKEDIN_CLIENT_ID`)
   - Note your **Client Secret** (this is your `VITE_LINKEDIN_CLIENT_SECRET`)
4. Add redirect URL: `http://localhost:3002/auth/linkedin/callback`
5. **Request these scopes:** `openid`, `profile`, `email`, `w_member_social`, `r_member_social`
6. **Important:** You may need to apply for LinkedIn Partner Program for full content access
7. **Note:** LinkedIn has strict content access policies - some features may require approval

**Required Environment Variables:**
```bash
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
VITE_LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
```

## 🔧 Environment Configuration

Create a `.env` file in your project root with all the credentials:

```bash
# Facebook/Meta API
VITE_FACEBOOK_CLIENT_ID=your_facebook_app_id_here
VITE_FACEBOOK_CLIENT_SECRET=your_facebook_app_secret_here

# Instagram Basic Display API
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id_here
VITE_INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret_here

# Twitter API v2
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret_here

# LinkedIn API
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
VITE_LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
```

## 🚀 Testing Your Setup

1. Restart your development server after adding credentials
2. Go to Social Moderation → Platforms tab
3. You should see setup instructions and platform cards
4. Click "Connect" on a platform to test OAuth flow
5. If successful, you'll see "Connected" status and user info
6. Use "Test Connection" to verify the API integration works
7. Use "Sync All Platforms" to fetch real content

## 🔒 Security Notes

- Never commit your `.env` file to version control
- Keep your API secrets secure and rotate them regularly
- Use environment-specific credentials for production
- Consider using a secrets manager for production deployments

## 🐛 Troubleshooting

### "Invalid redirect URI" error
- Make sure redirect URIs in your app settings exactly match: `http://localhost:3001/auth/{platform}/callback`
- Check for trailing slashes or typos

### "Invalid client credentials" error
- Verify your Client ID and Client Secret are correct
- Make sure you're using the right credentials for each platform

### "Insufficient permissions" error
- Check that you've requested the required scopes/permissions
- Some platforms require app review for certain permissions

### OAuth popup blocked
- Allow popups for localhost in your browser
- Try connecting in an incognito/private window

### Content not loading
- Check browser console for API errors
- Verify your app has the required permissions
- Some platforms have rate limits - wait a few minutes and try again

## 📊 What You Can Do Once Connected

Once platforms are connected, you can:

- **Monitor Real Content**: View actual posts from your social media accounts
- **AI Moderation**: Apply AI filtering to real content
- **Analytics**: Get insights from your actual social media data
- **User Management**: Control who can access different platform data
- **Custom Rules**: Create moderation rules based on your real content patterns

## 🔄 Next Steps

After connecting platforms, explore:
1. **Real-time Monitor** tab - See your actual social media content
2. **AI Filtering** tab - Create rules based on your content
3. **Analytics** tab - View insights from your real data
4. **Settings** tab - Configure how content is processed and stored

Need help? Check the browser console for detailed error messages or create an issue in the project repository.
