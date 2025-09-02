# Platform Connection Testing Guide

## 🚀 Quick Start

While you're waiting for Meta permissions, you can test and prepare all your platform connections using the new **Platform Testing** section.

### How to Access Platform Testing

1. Start your development server: `npm run dev`
2. Navigate to the **Platform Testing** section in the sidebar
3. Click **"Test All Platforms"** to run comprehensive tests

## 📋 What Each Test Does

### WhatsApp Business API Testing
- ✅ Validates your access token
- ✅ Verifies phone number ID
- ✅ Checks WhatsApp Business permissions
- ✅ Fetches business profile information
- ✅ Tests API connectivity

### Social Platform Testing
- ✅ Checks if API credentials are configured
- ✅ Tests existing OAuth connections
- ✅ Validates API endpoints
- ✅ Shows connection status and user info

### Meta/Facebook Special Handling
- ⏳ Shows "Pending Approval" status while waiting for Meta permissions
- ✅ Validates that credentials are properly configured
- ✅ Prepares OAuth flow for when permissions are approved

## 🔧 Platform Setup Status

### Current Status
- **WhatsApp Business**: ✅ Ready to test (if you have access token)
- **Facebook/Meta**: ⏳ Waiting for platform permissions
- **Twitter/X**: ✅ Ready to connect (needs API keys)
- **Instagram**: ✅ Ready to connect (needs API keys)
- **LinkedIn**: ✅ Ready to connect (needs API keys)
- **YouTube**: ✅ Ready to connect (needs API keys)

## 📝 Testing Checklist

### Before Testing
- [ ] Copy `env.example` to `.env`
- [ ] Add your API credentials to `.env` file
- [ ] Restart the development server
- [ ] Have your WhatsApp Business access token ready (if available)

### During Testing
- [ ] Test WhatsApp Business connection
- [ ] Test each social platform individually
- [ ] Run comprehensive test suite
- [ ] Review test logs for any issues
- [ ] Check environment variable configuration

### After Testing
- [ ] Note which platforms are ready to connect
- [ ] Document any missing credentials
- [ ] Prepare for Meta approval (Facebook/Instagram)
- [ ] Set up OAuth callbacks for other platforms

## 🛠️ Environment Variables Required

```bash
# Facebook/Meta API (for when permissions are approved)
VITE_FACEBOOK_CLIENT_ID=your_facebook_app_id
VITE_FACEBOOK_CLIENT_SECRET=your_facebook_app_secret

# Instagram Basic Display API
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id
VITE_INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret

# Twitter API v2
VITE_TWITTER_CLIENT_ID=your_twitter_client_id
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret

# LinkedIn API
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id
VITE_LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# YouTube API (Google)
VITE_YOUTUBE_CLIENT_ID=your_google_client_id
VITE_YOUTUBE_CLIENT_SECRET=your_google_client_secret
```

## 🔍 Test Results Interpretation

### Status Indicators
- 🟢 **Connected**: Platform is authenticated and API is working
- 🔴 **Disconnected**: Platform needs authentication or has issues
- 🟡 **Pending**: Meta approval pending or credentials missing
- 🔵 **Testing**: Currently running connection test

### Common Test Results
- **"Credentials configured but not connected"**: Ready for OAuth flow
- **"Missing credentials"**: Add API keys to `.env` file
- **"Waiting for platform permissions"**: Meta approval pending
- **"Connection working properly"**: Platform is fully operational
- **"Connection has issues"**: May need re-authentication

## 🚨 Troubleshooting

### WhatsApp Issues
- **Invalid token**: Check your access token from Meta Business
- **Invalid phone number ID**: Verify ID from WhatsApp Business dashboard
- **Permission denied**: Ensure WhatsApp Business messaging permission is granted

### Social Platform Issues
- **Missing client ID/secret**: Add credentials to `.env` file
- **Invalid redirect URI**: Check OAuth settings in platform developer console
- **Connection timeout**: Check internet connection and API status

### General Issues
- **Environment variables not loading**: Restart development server after adding to `.env`
- **CORS errors**: Expected for some platforms, OAuth popup should work
- **Rate limiting**: Wait a few minutes between tests

## 📞 Next Steps

1. **While waiting for Meta approval**:
   - Set up other platform credentials
   - Test WhatsApp Business integration
   - Familiarize yourself with the testing interface

2. **When Meta approves your permissions**:
   - Facebook/Instagram status will change to "Ready to connect"
   - You'll be able to complete OAuth flow
   - All platforms will be testable

3. **For production deployment**:
   - Use production API credentials
   - Set up proper OAuth redirect URIs
   - Configure environment variables for production

## 🎯 Pro Tips

- Use the **"View Logs"** button to see detailed test information
- Copy logs to clipboard for troubleshooting
- Test individual platforms before running full suite
- Keep your API credentials secure and rotate regularly
- Check platform developer consoles for any required approvals

---

**Need help?** Check the browser console for detailed error messages or refer to the SOCIAL_MEDIA_SETUP.md file for platform-specific setup instructions.
