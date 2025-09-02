# 🐦 Twitter OAuth Setup & Debugging Guide

## 🔧 **What I Just Fixed:**

1. **Port Configuration**: Changed Vite config from port 3000 to 3001 to match OAuth callbacks
2. **WebSocket Issues**: Added proper HMR configuration for port 3001
3. **OAuth Callback Handler**: Added debug callback page for better error visibility

## 📋 **Twitter App Configuration Checklist**

### **Step 1: Verify Your Twitter App Settings**

Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard) → Your App → **User authentication settings**:

**✅ Required Settings:**
- **App permissions**: `Read` (minimum) or `Read and Write`
- **Type of App**: `Web App, Automated App or Bot`
- **Callback URI**: `http://localhost:3001/auth/twitter/callback` ⚠️ **Must be exactly this**
- **Website URL**: `http://localhost:3001`

### **Step 2: Get Your Correct Credentials**

In your Twitter app, go to **Keys and tokens** tab:

- **Client ID** (starts with `client_` or looks like `abc123xyz`)
- **Client Secret** (long random string)

⚠️ **Important**: Make sure you're using **OAuth 2.0** credentials, not the older API Key/Secret!

### **Step 3: Update Your .env File**

```bash
# Twitter API v2 - Use your actual credentials
VITE_TWITTER_CLIENT_ID=your_actual_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_actual_client_secret_here
```

## 🧪 **Testing Steps**

1. **Restart the dev server** (should now be on port 3001)
2. **Go to**: `http://localhost:3001` 
3. **Navigate to**: Social Moderation → Platforms tab
4. **Click "Connect"** on Twitter
5. **Check for errors** in the OAuth popup

## 🐛 **Common Twitter OAuth Errors & Solutions**

### **"Something went wrong" Error**

**Possible Causes:**
1. **Wrong Callback URI** - Must be exactly `http://localhost:3001/auth/twitter/callback`
2. **Wrong Credentials** - Using API Key instead of Client ID
3. **App Not Approved** - Some Twitter apps need approval for certain scopes
4. **Incorrect App Type** - Must be "Web App"

**Solutions:**
1. Double-check callback URI in Twitter app settings
2. Verify you're using OAuth 2.0 Client ID/Secret (not API Key/Secret)
3. Try with minimal scopes: just `tweet.read` and `users.read`

### **"Invalid Client" Error**

**Cause**: Wrong Client ID or Client Secret

**Solution**: 
1. Go to Twitter Developer Portal → Keys and tokens
2. Copy the **Client ID** and **Client Secret** exactly
3. Update your `.env` file
4. Restart the dev server

### **"Redirect URI Mismatch" Error**

**Cause**: Callback URI doesn't match exactly

**Solution**:
1. In Twitter app settings, set callback URI to: `http://localhost:3001/auth/twitter/callback`
2. No trailing slash, exact port (3001)

## 🔍 **Debug Information**

When you click "Connect" on Twitter, check:

1. **Browser Console** - Look for any JavaScript errors
2. **Network Tab** - Check if OAuth request is being made
3. **OAuth Popup URL** - Should start with `https://twitter.com/i/oauth2/authorize`

## 📝 **Example Working Twitter App Settings**

```
App Details:
├── App permissions: Read
├── Type of App: Web App, Automated App or Bot
├── Callback URI: http://localhost:3001/auth/twitter/callback
├── Website URL: http://localhost:3001
└── Terms of Service URL: (optional)

Authentication:
├── OAuth 2.0 is ON
├── OAuth 1.0a is OFF (optional)
└── Request email address: OFF (optional)
```

## 🆘 **Still Having Issues?**

If you're still getting the "Something went wrong" error:

1. **Try a different browser** or incognito mode
2. **Clear Twitter cookies** and try again
3. **Check Twitter API status**: https://api.twitterstat.us/
4. **Verify your Twitter developer account** is in good standing
5. **Try creating a new Twitter app** with the same settings

## 📞 **Next Steps**

Once Twitter is working:
1. ✅ You should see "Connected" status with your Twitter username
2. ✅ Try "Test Connection" button
3. ✅ Try "Sync All Platforms" to fetch real tweets
4. 🔄 Then we can move on to other platforms (Facebook, Instagram, etc.)

Let me know what happens when you try connecting to Twitter again with these fixes!
