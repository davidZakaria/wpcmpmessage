# 🚀 Quick .env File Setup

Since you have all your API credentials ready, let's create the `.env` file quickly:

## Step 1: Create the .env file

Create a new file called `.env` in your project root (same folder as `package.json`) with the following content:

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

# YouTube Data API v3
VITE_YOUTUBE_CLIENT_ID=your_youtube_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_youtube_client_secret_here

# TikTok API (optional - leave empty if not using)
VITE_TIKTOK_CLIENT_ID=
VITE_TIKTOK_CLIENT_SECRET=
```

## Step 2: Replace the placeholder values

Replace each `your_*_here` with your actual API credentials:

- **Facebook**: App ID and App Secret from Facebook Developers Console
- **Instagram**: Client ID and Client Secret from Instagram Basic Display
- **Twitter**: Client ID and Client Secret from Twitter Developer Portal  
- **LinkedIn**: Client ID and Client Secret from LinkedIn Developer Portal
- **YouTube**: Client ID and Client Secret from Google Cloud Console

## Step 3: Save and restart

1. Save the `.env` file
2. Restart your development server: `npm run dev`
3. Go to Social Moderation → Platforms tab
4. Start connecting your platforms!

## ⚠️ Important Notes

- **Never commit the `.env` file** to version control (it's already in .gitignore)
- **Use the exact variable names** shown above (with VITE_ prefix)
- **No spaces** around the = sign
- **No quotes** needed around the values

## 🧪 Testing Setup

After creating the `.env` file:

1. Open Social Moderation tab
2. Go to Platforms section  
3. Click "Connect" on any platform
4. OAuth popup should open
5. Complete authentication
6. You should see "Connected" status with your username

## 🆘 Need Help?

If you get errors:
1. Check the browser console for detailed error messages
2. Verify your redirect URIs are set to `http://localhost:3001/auth/{platform}/callback`
3. Make sure your API credentials have the correct permissions/scopes
4. Restart the dev server after making changes to `.env`

Ready to connect your platforms? Let's do it! 🎉
