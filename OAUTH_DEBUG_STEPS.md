# 🐦 OAuth Debug Steps

Follow these steps to debug the Twitter OAuth connection:

## 🔍 **Step 1: Open Browser Console**
1. Go to your app: http://localhost:3001
2. Open **Developer Tools** (F12)
3. Go to **Console** tab
4. Keep it open during the OAuth process

## 🔗 **Step 2: Try Twitter Connection**
1. Navigate to **"Twitter & YouTube"** section
2. Click **"Connect"** for Twitter
3. **Watch the console** for messages

## 📝 **Expected Console Messages:**
When working correctly, you should see:
```
OAuth callback received: {type: 'oauth_callback', platform: 'twitter', code: '...', state: '...'}
OAuth credentials received: {accessToken: '...', userId: '...', userName: '...'}
```

## 🚨 **If You Don't See Console Messages:**

### **Check 1: Popup Behavior**
- Does the Twitter authorization popup open?
- Do you see "Authentication Successful" page after authorizing?
- Does the popup close automatically after 2 seconds?

### **Check 2: Network Tab**
1. Open **Network** tab in Developer Tools
2. Try connecting again
3. Look for requests to:
   - `https://twitter.com/i/oauth2/authorize` (OAuth request)
   - `http://localhost:3001/auth/twitter/callback` (Our callback)
   - `https://api.twitter.com/2/oauth2/token` (Token exchange)

### **Check 3: Console Errors**
Look for any error messages like:
- CORS errors
- Network errors
- Authentication errors

## 🔧 **Common Issues & Solutions:**

### **Issue: "Popup blocked"**
**Solution:** Allow popups for localhost in your browser

### **Issue: No console messages**
**Solution:** The message listener might not be working
- Try refreshing the page and trying again
- Make sure you're using the latest code

### **Issue: "Invalid state parameter"**
**Solution:** Your Twitter app configuration might be wrong
- Check your Twitter app settings
- Make sure OAuth 2.0 is enabled
- Verify the callback URL is correct

### **Issue: "Token exchange failed"**
**Solution:** API credentials might be wrong
- Verify you're using OAuth 2.0 credentials (not API v1.1)
- Check your Client ID and Secret in .env file

## 📋 **Debug Checklist:**

- [ ] Backend server running on port 3001
- [ ] Frontend running on port 3002
- [ ] Browser console open and monitoring
- [ ] Twitter app configured for OAuth 2.0
- [ ] Correct credentials in .env file
- [ ] Popups allowed for localhost

## 🎯 **Success Indicators:**

When everything works correctly:
1. ✅ **Popup opens** with Twitter authorization
2. ✅ **You authorize** the app
3. ✅ **"Authentication Successful"** page shows
4. ✅ **Console shows** OAuth messages
5. ✅ **Platform status** changes to "Connected"
6. ✅ **Success toast** appears

---

**Try these steps and let me know what console messages (if any) you see!**
