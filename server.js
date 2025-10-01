import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

// Create HTTP server and WebSocket server
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit for media uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increase URL-encoded payload limit

// Store for PKCE code verifiers
const codeVerifiers = new Map();

// Initialize SQLite database
const { Database } = sqlite3.verbose();
const db = new Database('./whatsapp_reports.db');

// Create tables if they don't exist and handle schema migration
db.serialize(() => {
  // First, create campaigns table
  db.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    template_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_numbers INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active'
  )`);
  
  // Create scheduled posts table
  db.run(`CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    platforms TEXT NOT NULL,
    media_urls TEXT,
    hashtags TEXT,
    mentions TEXT,
    scheduled_time TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    published_at TEXT,
    error_message TEXT,
    credentials TEXT
  )`);

  // Create message_status table (original structure first)
  db.run(`CREATE TABLE IF NOT EXISTS message_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    message_id TEXT,
    error TEXT
  )`);

  // Check if campaign_id column exists, if not, add it
  db.all("PRAGMA table_info(message_status)", (err, rows) => {
    if (err) {
      console.error('Error checking table schema:', err);
      return;
    }
    
    const hasCampaignId = rows.some(row => row.name === 'campaign_id');
    
    if (!hasCampaignId) {
      console.log('Adding campaign_id column to message_status table...');
      db.run(`ALTER TABLE message_status ADD COLUMN campaign_id INTEGER`, (err) => {
        if (err) {
          console.error('Error adding campaign_id column:', err);
        } else {
          console.log('✅ campaign_id column added successfully');
          
          // Create indexes after column is added
          db.run(`CREATE INDEX IF NOT EXISTS idx_message_status_campaign ON message_status(campaign_id)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_message_status_recipient ON message_status(recipient)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_message_status_message_id ON message_status(message_id)`);
        }
      });
    } else {
      console.log('✅ campaign_id column already exists');
      // Create indexes if they don't exist
      db.run(`CREATE INDEX IF NOT EXISTS idx_message_status_campaign ON message_status(campaign_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_message_status_recipient ON message_status(recipient)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_message_status_message_id ON message_status(message_id)`);
    }
  });

  // Incoming messages table
  db.run(`CREATE TABLE IF NOT EXISTS incoming_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_number TEXT NOT NULL,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    media_url TEXT,
    media_type TEXT
  )`);

  // Chat messages table for both incoming and outgoing messages
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    text TEXT,
    media_url TEXT,
    media_type TEXT,
    direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
    whatsapp_message_id TEXT,
    status TEXT DEFAULT 'sent',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create indexes for chat messages
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_messages_whatsapp_id ON chat_messages(whatsapp_message_id)`);
  
  // Create unique index on whatsapp_message_id to prevent duplicates (if not exists)
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_whatsapp_id_unique ON chat_messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL`);

  // Conversations table to track active chats
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    contact_number TEXT NOT NULL,
    contact_name TEXT,
    last_message_text TEXT,
    last_message_timestamp DATETIME,
    unread_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Webhook endpoint for WhatsApp Business API
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', JSON.stringify(req.body, null, 2));
  
  try {
    const { entry } = req.body;
    
    if (entry && entry.length > 0) {
      entry.forEach(entryItem => {
        const changes = entryItem.changes || [];
        
        changes.forEach(change => {
          if (change.field === 'messages') {
            const value = change.value;
            
            // Handle message status updates with proper status tracking
            if (value.statuses && value.statuses.length > 0) {
              value.statuses.forEach(status => {
                // Store error details if present
                const errorDetail = status.errors ? JSON.stringify(status.errors) : null;
                
                // Extract campaign_id from the webhook data or custom fields
                const campaignId = status.campaign_id || 
                                 (change.value.metadata && change.value.metadata.campaign_id) ||
                                 null;
                
                // Always insert a new row for every status event
                const insertStmt = db.prepare(`INSERT INTO message_status (recipient, status, message_id, timestamp, error, campaign_id) VALUES (?, ?, ?, ?, ?, ?)`);
                insertStmt.run([status.recipient_id, status.status, status.id, getCorrectedTimestamp(), errorDetail, campaignId]);
                insertStmt.finalize();
                console.log(`Inserted status event: ${status.recipient_id} - ${status.status} (message_id: ${status.id}, campaign_id: ${campaignId})`);
              });
            }
            
            // Handle incoming messages
            if (value.messages && value.messages.length > 0) {
              value.messages.forEach(message => {
                console.log(`Processing incoming message ID: ${message.id} from ${message.from}`);
                
                // Check if this message already exists to prevent duplicates
                const existingMessage = db.prepare(`SELECT id FROM chat_messages WHERE whatsapp_message_id = ?`).get(message.id);
                
                if (existingMessage) {
                  console.log(`⏭️  Message ${message.id} already exists, skipping duplicate`);
                  return; // Skip this message
                }
                
                // Store in legacy incoming_messages table (check for duplicates here too)
                const existingIncoming = db.prepare(`SELECT id FROM incoming_messages WHERE from_number = ? AND text = ? AND timestamp > datetime('now', '-1 hour')`).get(
                  message.from,
                  message.text ? message.text.body : null
                );
                
                if (!existingIncoming) {
                  const stmt = db.prepare(`INSERT INTO incoming_messages (from_number, text, media_url, media_type, timestamp) VALUES (?, ?, ?, ?, ?)`);
                  stmt.run([
                    message.from,
                    message.text ? message.text.body : null,
                    message.image ? message.image.id : (message.document ? message.document.id : null),
                    message.type,
                    getCorrectedTimestamp()
                  ]);
                  stmt.finalize();
                }
                
                // Store in new chat_messages table for chat interface
                const businessNumber = "+20107081505"; // Your WhatsApp business number
                const conversationId = getConversationId(businessNumber, message.from);
                
                const chatStmt = db.prepare(`INSERT OR IGNORE INTO chat_messages 
                  (conversation_id, from_number, to_number, message_type, text, media_url, media_type, direction, whatsapp_message_id, status, timestamp) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'inbound', ?, 'delivered', ?)`);
                const result = chatStmt.run([
                  conversationId,
                  message.from,
                  businessNumber,
                  message.type,
                  message.text ? message.text.body : null,
                  message.image ? message.image.id : (message.document ? message.document.id : null),
                  message.type === 'image' ? 'image' : message.type === 'document' ? 'document' : null,
                  message.id,
                  getCorrectedTimestamp()
                ]);
                chatStmt.finalize();
                
                if (result.changes === 0) {
                  console.log(`⏭️  Message ${message.id} already exists in database, skipped by IGNORE constraint`);
                  return; // Skip conversation update if message already existed
                }
                
                console.log(`✅ New message stored: ${message.id} from ${message.from}`);
                
                // Update or create conversation
                updateConversation(conversationId, message.from, message.text ? message.text.body : `[${message.type} message]`);
                
                console.log(`Incoming message from: ${message.from} - ${message.text ? message.text.body : message.type}`);
              });
            }
          }
        });
      });
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = 'whatsapp_secret_2024';

  // Debug log
  console.log('Webhook verify:', { mode, token, challenge, VERIFY_TOKEN });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verification failed');
  }
});

// API endpoint to fetch reports with enhanced status tracking and campaign support
app.get('/reports', (req, res) => {
  const { campaign_id } = req.query;
  
  // Build query with optional campaign filter
  let statusQuery = `SELECT recipient, status, message_id, timestamp, error, campaign_id FROM message_status`;
  let summaryQuery = `
    SELECT 
      status,
      COUNT(*) as count
    FROM (
      SELECT 
        message_id,
        status,
        ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY 
          CASE 
            WHEN status = 'sent' THEN 1
            WHEN status = 'delivered' THEN 2
            WHEN status = 'read' THEN 3
            WHEN status = 'failed' THEN 0
            ELSE 0
          END DESC, timestamp DESC
        ) as rn
      FROM message_status
  `;
  
  const params = [];
  if (campaign_id) {
    statusQuery += ` WHERE campaign_id = ?`;
    summaryQuery += ` WHERE campaign_id = ?`;
    params.push(campaign_id);
  }
  
  statusQuery += ` ORDER BY message_id, timestamp ASC`;
  summaryQuery += `
    ) ranked
    WHERE rn = 1
    GROUP BY status
  `;
  
  // Get all statuses for all messages (or filtered by campaign)
  db.all(statusQuery, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    // Group by message_id
    const messageMap = new Map();
    rows.forEach(row => {
      if (!messageMap.has(row.message_id)) {
        messageMap.set(row.message_id, { 
          message_id: row.message_id, 
          recipient: row.recipient, 
          campaign_id: row.campaign_id,
          history: [] 
        });
      }
      messageMap.get(row.message_id).history.push({ 
        status: row.status, 
        timestamp: row.timestamp, 
        error: row.error 
      });
    });
    
    // Get incoming messages
    db.all('SELECT * FROM incoming_messages ORDER BY timestamp DESC', (err2, incomingRows) => {
      if (err2) {
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      // Get status summary statistics (latest status per message)
      db.all(summaryQuery, params, (err3, summaryRows) => {
        if (err3) {
          res.status(500).json({ error: 'Database error' });
          return;
        }
        
        // Get campaign info if filtering by campaign
        if (campaign_id) {
          db.get('SELECT * FROM campaigns WHERE id = ?', [campaign_id], (err4, campaign) => {
            if (err4) {
              res.status(500).json({ error: 'Database error' });
              return;
            }
            
            res.json({
              deliveryStatus: Array.from(messageMap.values()),
              incomingMessages: incomingRows,
              summary: summaryRows,
              totalMessages: messageMap.size,
              totalIncoming: incomingRows.length,
              campaign: campaign,
              filtered: true
            });
          });
        } else {
          res.json({
            deliveryStatus: Array.from(messageMap.values()),
            incomingMessages: incomingRows,
            summary: summaryRows,
            totalMessages: messageMap.size,
            totalIncoming: incomingRows.length,
            filtered: false
          });
        }
      });
    });
  });
});

// Campaign Management Endpoints

// Create new campaign
app.post('/campaigns', (req, res) => {
  const { name, description, templateName } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Campaign name is required' });
  }
  
  const stmt = db.prepare(`INSERT INTO campaigns (name, description, template_name) VALUES (?, ?, ?)`);
  stmt.run([name, description || null, templateName || null], function(err) {
    if (err) {
      console.error('Error creating campaign:', err);
      return res.status(500).json({ error: 'Failed to create campaign' });
    }
    
    res.json({
      id: this.lastID,
      name,
      description,
      templateName,
      message: 'Campaign created successfully'
    });
  });
  stmt.finalize();
});

// LinkedIn cache to prevent repeated API calls
const linkedinCache = new Map();
const LINKEDIN_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// LinkedIn failure tracking to prevent spam
const linkedinFailures = new Map();
const LINKEDIN_FAILURE_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown after failure

// Clean up old failure records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of linkedinFailures.entries()) {
    if (now - timestamp > LINKEDIN_FAILURE_COOLDOWN) {
      linkedinFailures.delete(key);
    }
  }
  if (linkedinFailures.size > 0) {
    console.log(`🧹 Cleaned up old LinkedIn failure records. Active failures: ${linkedinFailures.size}`);
  }
}, 10 * 60 * 1000);

// Fetch LinkedIn content (server-side to avoid CORS)
app.get('/api/linkedin/content', async (req, res) => {
  try {
    const { userId, accessToken, limit = 25 } = req.query;
    
    if (!userId || !accessToken) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'userId and accessToken are required'
      });
    }

    // Check if this user has recent failures
    const failureKey = `failure_${userId}`;
    const lastFailure = linkedinFailures.get(failureKey);
    if (lastFailure && (Date.now() - lastFailure) < LINKEDIN_FAILURE_COOLDOWN) {
      const remainingTime = Math.ceil((LINKEDIN_FAILURE_COOLDOWN - (Date.now() - lastFailure)) / 1000);
      console.log(`⏸️ Skipping LinkedIn API call for user ${userId} due to recent failure. Retry in ${remainingTime}s`);
      return res.json({ 
        posts: [], 
        message: `LinkedIn API temporarily disabled due to recent failures. Retry in ${remainingTime} seconds.`,
        apiUsed: 'rate-limited'
      });
    }

    console.log(`🔄 Fetching LinkedIn content for user: ${userId}`);

    // Check cache first
    const cacheKey = `linkedin_${userId}`;
    const cached = linkedinCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < LINKEDIN_CACHE_DURATION) {
      console.log(`🎯 Returning cached LinkedIn data for user: ${userId}`);
      return res.json(cached.data);
    }

    // Try to fetch LinkedIn posts using the UGC API
    try {
      console.log(`🔍 Attempting to fetch LinkedIn posts for user: ${userId}`);
      
      // First, get user profile to get the person URN
      const profileResponse = await fetch('https://api.linkedin.com/v2/people/~', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!profileResponse.ok) {
        throw new Error(`Profile fetch failed: ${profileResponse.status}`);
      }

      const profileData = await profileResponse.json();
      const personUrn = profileData.id;
      console.log(`✅ Got LinkedIn profile URN: ${personUrn}`);

      // Try multiple LinkedIn API endpoints for posts
      let postsResponse;
      let apiUrl;
      
      // First try UGC Posts API
      apiUrl = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn:li:person:${personUrn})&count=${limit}&sortBy=CREATED`;
      console.log(`🔍 Trying LinkedIn UGC API: ${apiUrl}`);
      
      postsResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      // If UGC API fails or returns empty, try shares API
      if (!postsResponse.ok) {
        console.log(`⚠️ UGC API failed (${postsResponse.status}), trying shares API...`);
        
        apiUrl = `https://api.linkedin.com/v2/shares?q=owners&owners=List(urn:li:person:${personUrn})&count=${limit}&sortBy=CREATED`;
        console.log(`🔍 Trying LinkedIn Shares API: ${apiUrl}`);
        
        postsResponse = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });
      }

      if (!postsResponse.ok) {
        const errorData = await postsResponse.json();
        console.error(`❌ LinkedIn posts fetch failed:`, errorData);
        throw new Error(`Posts fetch failed: ${postsResponse.status} - ${JSON.stringify(errorData)}`);
      }

      const postsData = await postsResponse.json();
      console.log(`✅ LinkedIn API Response from ${apiUrl.includes('ugcPosts') ? 'UGC' : 'Shares'} API:`, {
        elementsCount: postsData.elements?.length || 0,
        valuesCount: postsData.values?.length || 0, // Shares API uses 'values'
        hasElements: !!postsData.elements,
        hasValues: !!postsData.values,
        responseKeys: Object.keys(postsData),
        apiEndpoint: apiUrl.includes('ugcPosts') ? 'UGC Posts' : 'Shares'
      });

      // Handle both UGC API (elements) and Shares API (values) response formats
      const posts = postsData.elements || postsData.values || [];
    const response = {
        success: true,
        posts: posts,
        totalCount: posts.length,
        message: `Successfully fetched ${posts.length} posts from ${apiUrl.includes('ugcPosts') ? 'UGC' : 'Shares'} API`,
        rawData: postsData,
        apiUsed: apiUrl.includes('ugcPosts') ? 'UGC Posts' : 'Shares'
      };
    } catch (apiError) {
      console.error(`❌ LinkedIn API error:`, apiError);
      
      // Track this failure to prevent repeated attempts
      linkedinFailures.set(failureKey, Date.now());
      console.log(`🚫 LinkedIn API failure recorded for user ${userId}. Cooldown period: ${LINKEDIN_FAILURE_COOLDOWN / 1000}s`);
      
      // Return helpful error information
      const response = {
        success: false,
        posts: [],
        totalCount: 0,
        error: apiError.message,
        message: 'LinkedIn API access failed - check permissions and scopes',
      info: {
          reason: 'LinkedIn API requires proper scopes and permissions',
          requiredScopes: ['r_member_social', 'w_member_social'],
          currentError: apiError.message,
          solution: 'Ensure your LinkedIn app has the required permissions and is approved for content access'
        }
      };
    }

    // Cache the response
    linkedinCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    console.log(`ℹ️ LinkedIn API limitations - returning empty result for user: ${userId}`);
    
    // Make sure response is defined before using it
    if (typeof response === 'undefined') {
      response = {
        success: false,
        posts: [],
        totalCount: 0,
        message: 'LinkedIn API access failed',
        error: 'No response generated'
      };
    }
    
    res.json(response);

  } catch (error) {
    console.error(`❌ LinkedIn content fetch error:`, error);
    
    // Track this failure to prevent repeated attempts
    const failureKey = `failure_${req.query.userId}`;
    linkedinFailures.set(failureKey, Date.now());
    console.log(`🚫 LinkedIn API outer failure recorded. Cooldown period: ${LINKEDIN_FAILURE_COOLDOWN / 1000}s`);
    
    // Always return a successful response for LinkedIn to prevent 500 errors
    const fallbackResponse = {
      success: true,
      posts: [],
      totalCount: 0,
      message: 'LinkedIn API access limited',
      error: error.message
    };
    
    res.json(fallbackResponse);
  }
});

// Rate limiting and caching for Twitter API
const twitterCache = new Map();
const twitterRateLimit = new Map();
const twitterRateLimitedUsers = new Map(); // Track rate-limited users
const TWITTER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (extended)
const TWITTER_RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const TWITTER_MAX_REQUESTS = 75; // Twitter API v2 limit
const TWITTER_RATE_LIMIT_COOLDOWN = 16 * 60 * 1000; // 16 minutes cooldown

// Fetch Twitter content (server-side to avoid CORS)
app.get('/api/twitter/content', async (req, res) => {
  try {
    const { userId, accessToken, limit = 25 } = req.query;
    
    if (!userId || !accessToken) {
      return res.status(400).json({ error: 'Missing userId or accessToken' });
    }

    console.log(`📱 Fetching Twitter content for user: ${userId}`);

    // Check if user is currently rate-limited
    const rateLimitedUntil = twitterRateLimitedUsers.get(userId);
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const waitTime = Math.ceil((rateLimitedUntil - Date.now()) / 1000 / 60);
      console.log(`⏰ User ${userId} is rate-limited. Wait ${waitTime} minutes.`);
      
      // Return cached data if available, even if expired
      const cacheKey = `${userId}_${limit}`;
      const cached = twitterCache.get(cacheKey);
      if (cached) {
        console.log(`🎯 Returning cached data during rate limit for user: ${userId}`);
        return res.json({
          ...cached.data,
          _cached: true,
          _rateLimited: true,
          _message: `Using cached data. Rate limit active for ${waitTime} more minutes.`
        });
      }
      
      return res.status(429).json({ 
        error: 'Rate limit active', 
        details: `Please wait ${waitTime} minutes before trying again. Twitter rate limit is active.`,
        retryAfter: waitTime * 60
      });
    }

    // Check cache first (extended check)
    const cacheKey = `${userId}_${limit}`;
    const cached = twitterCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < TWITTER_CACHE_DURATION) {
      console.log(`🎯 Returning cached Twitter data for user: ${userId} (${Math.round((Date.now() - cached.timestamp) / 1000 / 60)} minutes old)`);
      return res.json({
        ...cached.data,
        _cached: true,
        _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000 / 60)
      });
    }

    // Check rate limiting
    const now = Date.now();
    const userRateLimit = twitterRateLimit.get(userId) || { requests: 0, resetTime: now + TWITTER_RATE_LIMIT_WINDOW };
    
    if (now < userRateLimit.resetTime && userRateLimit.requests >= TWITTER_MAX_REQUESTS) {
      const waitTime = Math.ceil((userRateLimit.resetTime - now) / 1000 / 60);
      console.log(`⏰ Twitter rate limit exceeded for user ${userId}. Wait ${waitTime} minutes.`);
      
      // Mark user as rate-limited
      twitterRateLimitedUsers.set(userId, now + TWITTER_RATE_LIMIT_COOLDOWN);
      
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        details: `Please wait ${waitTime} minutes before trying again. Twitter allows 75 requests per 15 minutes.`,
        retryAfter: waitTime * 60
      });
    }

    // Reset rate limit window if expired
    if (now >= userRateLimit.resetTime) {
      userRateLimit.requests = 0;
      userRateLimit.resetTime = now + TWITTER_RATE_LIMIT_WINDOW;
    }

    const expansions = 'author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id';
    const tweetFields = 'created_at,text,public_metrics,context_annotations,attachments,conversation_id,in_reply_to_user_id';
    const userFields = 'name,username,profile_image_url,verified';
    const mediaFields = 'url,preview_image_url,type';

    // Get user's recent tweets to find conversations (but we'll filter these out later)
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?` +
      `max_results=${Math.min(limit, 10)}&expansions=${expansions}&tweet.fields=${tweetFields}&user.fields=${userFields}&media.fields=${mediaFields}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    userRateLimit.requests++;
    twitterRateLimit.set(userId, userRateLimit);

    const tweetsData = await tweetsResponse.json();

    if (!tweetsResponse.ok) {
      console.error(`❌ Twitter tweets fetch failed:`, tweetsData);
      
      if (tweetsResponse.status === 429) {
        console.log(`🚫 Rate limit hit! Marking user ${userId} as rate-limited for 16 minutes`);
        
        // Mark user as rate-limited for 16 minutes
        twitterRateLimitedUsers.set(userId, now + TWITTER_RATE_LIMIT_COOLDOWN);
        
        const resetTime = tweetsResponse.headers.get('x-rate-limit-reset');
        const waitTime = resetTime ? Math.ceil((parseInt(resetTime) * 1000 - now) / 1000 / 60) : 16;
        
        // Try to return cached data if available
        const cached = twitterCache.get(cacheKey);
        if (cached) {
          console.log(`🎯 Returning cached data due to rate limit for user: ${userId}`);
          return res.json({
            ...cached.data,
            _cached: true,
            _rateLimited: true,
            _message: `Using cached data due to rate limit. Wait ${waitTime} minutes for fresh data.`
          });
        }
        
        return res.status(429).json({ 
          error: 'Twitter API rate limit exceeded', 
          details: `Please wait ${waitTime} minutes before trying again. You've been temporarily rate-limited.`,
          retryAfter: waitTime * 60
        });
      }
      
      return res.status(tweetsResponse.status).json({ 
        error: 'Twitter API error', 
        details: tweetsData.detail || tweetsData.title || tweetsData.error 
      });
    }

    // Now get replies to user's tweets
    let allReplies = [];
    let allReplyUsers = [];
    if (tweetsData.data && tweetsData.data.length > 0) {
      for (const tweet of tweetsData.data.slice(0, 3)) { // Limit to first 3 tweets to avoid rate limits
        try {
          // Check rate limit before each request
          const currentRateLimit = twitterRateLimit.get(userId);
          if (currentRateLimit.requests >= TWITTER_MAX_REQUESTS - 5) { // Leave some buffer
            console.log(`⚠️ Approaching rate limit, skipping replies for tweet ${tweet.id}`);
            break;
          }

          const repliesResponse = await fetch(
            `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${tweet.conversation_id} -from:${userId}&max_results=10&expansions=${expansions}&tweet.fields=${tweetFields}&user.fields=${userFields}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );

          currentRateLimit.requests++;
          twitterRateLimit.set(userId, currentRateLimit);

          if (repliesResponse.ok) {
            const repliesData = await repliesResponse.json();
            if (repliesData.data) {
              // Collect reply users
              if (repliesData.includes?.users) {
                allReplyUsers.push(...repliesData.includes.users);
              }
              
              allReplies.push(...repliesData.data.map(reply => ({
                ...reply,
                parent_tweet_id: tweet.id
              })));
            }
          } else {
            console.log(`⚠️ Failed to fetch replies for tweet ${tweet.id}: ${repliesResponse.status}`);
          }
        } catch (replyError) {
          console.error(`Error fetching replies for tweet ${tweet.id}:`, replyError);
        }
      }
    }

    // Focus on replies only - filter out user's own tweets
    const combinedData = {
      ...tweetsData,
      data: allReplies, // Only show replies from others, not user's own tweets
      replies: allReplies,
      includes: {
        ...tweetsData.includes,
        users: [...(tweetsData.includes?.users || []), ...allReplyUsers],
        media: [...(tweetsData.includes?.media || [])]
      }
    };

    // Add replies to their parent tweets and filter moderated content
    const moderationActions = getUserModerationActions(userId);
    
    if (combinedData.data) {
      combinedData.data = combinedData.data.map(tweet => {
        // Filter replies based on moderation actions
        const filteredReplies = allReplies
          .filter(reply => reply.parent_tweet_id === tweet.id)
          .filter(reply => {
            // Hide replies from blocked users
            if (moderationActions.blocked.has(reply.author_id)) {
              console.log(`🚫 Filtering reply from blocked user: ${reply.author_id}`);
              return false;
            }
            // Hide replies from muted users
            if (moderationActions.muted.has(reply.author_id)) {
              console.log(`🔇 Filtering reply from muted user: ${reply.author_id}`);
              return false;
            }
            // Hide specifically hidden replies
            if (moderationActions.hiddenReplies.has(reply.id)) {
              console.log(`👁️ Filtering hidden reply: ${reply.id}`);
              return false;
            }
            return true;
          });
        
        return {
          ...tweet,
          replies: filteredReplies,
          _moderationStats: {
            totalReplies: allReplies.filter(reply => reply.parent_tweet_id === tweet.id).length,
            visibleReplies: filteredReplies.length,
            filteredReplies: allReplies.filter(reply => reply.parent_tweet_id === tweet.id).length - filteredReplies.length
          }
        };
      });
    }

    // Cache the result
    twitterCache.set(cacheKey, {
      data: combinedData,
      timestamp: now
    });

    console.log(`✅ Fetched ${combinedData.data?.length || 0} tweets and ${allReplies.length} replies for user ${userId}`);
    console.log(`📊 Rate limit status: ${userRateLimit.requests}/${TWITTER_MAX_REQUESTS} requests used`);
    
    res.json(combinedData);

  } catch (error) {
    console.error('💥 Twitter content fetch error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Reply to a Twitter tweet
app.post('/api/twitter/reply', async (req, res) => {
  try {
    const { userId, accessToken, tweetId, replyText } = req.body;
    
    if (!userId || !accessToken || !tweetId || !replyText) {
      return res.status(400).json({ error: 'Missing required fields: userId, accessToken, tweetId, replyText' });
    }

    console.log(`📝 Posting Twitter reply for user: ${userId} to tweet: ${tweetId}`);

    // Check if user is currently rate-limited
    const rateLimitedUntil = twitterRateLimitedUsers.get(userId);
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const waitTime = Math.ceil((rateLimitedUntil - Date.now()) / 1000 / 60);
      console.log(`⏰ User ${userId} is rate-limited. Cannot post reply. Wait ${waitTime} minutes.`);
      return res.status(429).json({ 
        error: 'Rate limited', 
        details: `Please wait ${waitTime} minutes before posting replies.`,
        retryAfter: waitTime * 60
      });
    }

    // Post the reply
    const replyResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        text: replyText,
        reply: {
          in_reply_to_tweet_id: tweetId
        }
      })
    });

    const replyData = await replyResponse.json();

    if (!replyResponse.ok) {
      console.error(`❌ Twitter reply failed:`, replyData);
      
      if (replyResponse.status === 429) {
        console.log(`🚫 Rate limit hit while posting reply! Marking user ${userId} as rate-limited`);
        twitterRateLimitedUsers.set(userId, Date.now() + TWITTER_RATE_LIMIT_COOLDOWN);
        
        return res.status(429).json({ 
          error: 'Twitter API rate limit exceeded', 
          details: 'Rate limit hit while posting reply. Please wait before trying again.',
          retryAfter: 16 * 60
        });
      }
      
      return res.status(replyResponse.status).json({ 
        error: 'Twitter API error', 
        details: replyData.detail || replyData.title || replyData.error 
      });
    }

    console.log(`✅ Twitter reply posted successfully:`, replyData.data?.id);

    res.json({
      success: true,
      data: replyData.data,
      message: 'Reply posted successfully'
    });

  } catch (error) {
    console.error('❌ Twitter reply error:', error);
    res.status(500).json({ error: 'Failed to post Twitter reply', details: error.message });
  }
});

// Twitter rate limit status endpoint
app.get('/api/twitter/rate-limit-status/:userId', (req, res) => {
  const { userId } = req.params;
  
  const rateLimitedUntil = twitterRateLimitedUsers.get(userId);
  const userRateLimit = twitterRateLimit.get(userId);
  const now = Date.now();
  
  const status = {
    userId,
    isRateLimited: rateLimitedUntil && now < rateLimitedUntil,
    rateLimitedUntil: rateLimitedUntil || null,
    waitTimeMinutes: rateLimitedUntil && now < rateLimitedUntil ? Math.ceil((rateLimitedUntil - now) / 1000 / 60) : 0,
    requestsUsed: userRateLimit?.requests || 0,
    maxRequests: TWITTER_MAX_REQUESTS,
    windowResetTime: userRateLimit?.resetTime || null,
    hasCachedData: twitterCache.has(`${userId}_25`) || twitterCache.has(`${userId}_50`) || twitterCache.has(`${userId}_100`)
  };
  
  console.log(`📊 Rate limit status for user ${userId}:`, status);
  res.json(status);
});

// Local moderation storage
const userModerationActions = new Map(); // userId -> { blocked: Set, muted: Set, hiddenReplies: Set }

// Get user's moderation actions
function getUserModerationActions(userId) {
  if (!userModerationActions.has(userId)) {
    userModerationActions.set(userId, {
      blocked: new Set(),
      muted: new Set(),
      hiddenReplies: new Set()
    });
  }
  return userModerationActions.get(userId);
}

// Twitter moderation endpoints (Local implementation due to API restrictions)
app.post('/api/twitter/block-user', async (req, res) => {
  try {
    const { userId, targetUserId, accessToken, targetUsername } = req.body;
    
    if (!userId || !targetUserId || !accessToken) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'userId, targetUserId, and accessToken are required'
      });
    }

    console.log(`🚫 Locally blocking Twitter user ${targetUserId} for user ${userId}`);

    // Store the block action locally
    const moderationActions = getUserModerationActions(userId);
    moderationActions.blocked.add(targetUserId);
    
    // Also add to muted (blocked users are also muted)
    moderationActions.muted.add(targetUserId);

    console.log(`✅ Successfully blocked user ${targetUserId} locally`);
    console.log(`📊 User ${userId} has blocked ${moderationActions.blocked.size} users`);
    
    // Create better Twitter URLs
    const twitterProfileUrl = targetUsername 
      ? `https://twitter.com/${targetUsername.replace('@', '')}`
      : `https://twitter.com/i/user/${targetUserId}`;
    
    res.json({ 
      success: true, 
      action: 'blocked',
      targetUserId,
      targetUsername,
      message: 'User filtered from app view. To block on Twitter, visit their profile.',
      localOnly: true,
      twitterBlockUrl: twitterProfileUrl,
      instructions: 'This filters the user from your app view only. Visit their Twitter profile and use the "Block" option from the menu.',
      blockInstructions: '1. Click the link above\n2. Click the "..." menu on their profile\n3. Select "Block @username"',
      totalBlocked: moderationActions.blocked.size
    });

  } catch (error) {
    console.error('💥 Twitter block error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/twitter/mute-user', async (req, res) => {
  try {
    const { userId, targetUserId, accessToken, targetUsername } = req.body;
    
    if (!userId || !targetUserId || !accessToken) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'userId, targetUserId, and accessToken are required'
      });
    }

    console.log(`🔇 Locally muting Twitter user ${targetUserId} for user ${userId}`);

    // Store the mute action locally
    const moderationActions = getUserModerationActions(userId);
    moderationActions.muted.add(targetUserId);

    console.log(`✅ Successfully muted user ${targetUserId} locally`);
    console.log(`📊 User ${userId} has muted ${moderationActions.muted.size} users`);
    
    // Create better Twitter URLs
    const twitterProfileUrl = targetUsername 
      ? `https://twitter.com/${targetUsername.replace('@', '')}`
      : `https://twitter.com/i/user/${targetUserId}`;
    
    res.json({ 
      success: true, 
      action: 'muted',
      targetUserId,
      targetUsername,
      message: 'User filtered from app view. To mute on Twitter, visit their profile.',
      localOnly: true,
      twitterMuteUrl: twitterProfileUrl,
      instructions: 'This filters the user from your app view only. Visit their Twitter profile and use the "Mute" option from the menu.',
      muteInstructions: '1. Click the link above\n2. Click the "..." menu on their profile\n3. Select "Mute @username"',
      totalMuted: moderationActions.muted.size
    });

  } catch (error) {
    console.error('💥 Twitter mute error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/twitter/hide-reply', async (req, res) => {
  try {
    const { tweetId, accessToken, userId, replyAuthorUsername, parentTweetId } = req.body;
    
    if (!tweetId || !accessToken || !userId) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'tweetId, accessToken, and userId are required'
      });
    }

    console.log(`👁️ Locally hiding Twitter reply ${tweetId} for user ${userId}`);

    // Store the hide action locally
    const moderationActions = getUserModerationActions(userId);
    moderationActions.hiddenReplies.add(tweetId);

    console.log(`✅ Successfully hid reply ${tweetId} locally`);
    console.log(`📊 User ${userId} has hidden ${moderationActions.hiddenReplies.size} replies`);
    
    // Create Twitter URL for the specific reply
    const twitterReplyUrl = replyAuthorUsername && parentTweetId
      ? `https://twitter.com/${replyAuthorUsername.replace('@', '')}/status/${tweetId}`
      : `https://twitter.com/i/web/status/${tweetId}`;
    
    res.json({ 
      success: true, 
      action: 'hidden',
      tweetId,
      replyAuthorUsername,
      message: 'Reply hidden from app view. To hide on Twitter, visit the reply.',
      localOnly: true,
      twitterReplyUrl,
      instructions: 'This hides the reply from your app view only. To hide it on Twitter, visit the reply and use the "..." menu.',
      hideInstructions: '1. Click the link above to open the reply\n2. Click the "..." menu on the reply\n3. Select "Hide reply" (only available on your own tweets)',
      totalHidden: moderationActions.hiddenReplies.size,
      note: 'Note: You can only hide replies on your own tweets on Twitter.'
    });

  } catch (error) {
    console.error('💥 Twitter hide reply error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get user's moderation actions
app.get('/api/twitter/moderation-actions/:userId', (req, res) => {
  const { userId } = req.params;
  const moderationActions = getUserModerationActions(userId);
  
  res.json({
    userId,
    blocked: Array.from(moderationActions.blocked),
    muted: Array.from(moderationActions.muted),
    hiddenReplies: Array.from(moderationActions.hiddenReplies),
    totals: {
      blocked: moderationActions.blocked.size,
      muted: moderationActions.muted.size,
      hiddenReplies: moderationActions.hiddenReplies.size
    }
  });
});

// Clear user's moderation actions
app.delete('/api/twitter/moderation-actions/:userId', (req, res) => {
  const { userId } = req.params;
  userModerationActions.delete(userId);
  
  console.log(`🗑️ Cleared all moderation actions for user ${userId}`);
  res.json({ success: true, message: 'All moderation actions cleared' });
});

// Twitter media upload endpoint
app.post('/api/twitter/upload-media', async (req, res) => {
  try {
    const { accessToken, mediaData, mediaType } = req.body;
    
    console.log(`📤 Twitter media upload request received`);
    console.log(`📊 Request details:`, {
      hasAccessToken: !!accessToken,
      hasMediaData: !!mediaData,
      mediaType: mediaType,
      mediaDataLength: mediaData?.length || 0
    });
    
    if (!accessToken || !mediaData) {
      console.error(`❌ Missing required parameters:`, {
        hasAccessToken: !!accessToken,
        hasMediaData: !!mediaData
      });
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'accessToken and mediaData are required'
      });
    }

    // Validate base64 data format
    if (!mediaData.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
      console.error(`❌ Invalid base64 data format`);
      return res.status(400).json({
        error: 'Invalid media data',
        details: 'Media data must be valid base64'
      });
    }
    
    // Twitter has a 5MB limit for images
    const estimatedSize = mediaData.length * 0.75; // Base64 is ~33% larger than binary
    console.log(`📊 Estimated file size: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (estimatedSize > 5 * 1024 * 1024) {
      console.error(`❌ File too large: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
      return res.status(400).json({
        error: 'File too large',
        details: `Media file too large: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB (max 5MB)`
      });
    }
    
    // Prepare upload parameters
    const uploadParams = new URLSearchParams();
    uploadParams.append('media_data', mediaData);
    uploadParams.append('media_category', mediaType?.startsWith('video/') ? 'tweet_video' : 'tweet_image');
    
    console.log(`📤 Uploading to Twitter API...`);
    console.log(`🔑 Using access token: ${accessToken.substring(0, 20)}...`);
    
    // Twitter v1.1 media API often requires OAuth 1.0a, but let's try Bearer first
    console.log(`🔍 Attempting Twitter media upload with Bearer token...`);
    
    let uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: uploadParams
    });
    
    console.log(`📡 Twitter v1.1 response:`, {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      ok: uploadResponse.ok
    });

    // If v1.1 fails, try a different approach - skip media upload for now
    if (!uploadResponse.ok) {
      console.log(`⚠️ Twitter v1.1 media API failed, this is expected with Bearer tokens`);
      console.log(`ℹ️ Twitter v1.1 media API typically requires OAuth 1.0a authentication`);
      
      return res.status(501).json({
        error: 'Twitter media upload not implemented',
        details: 'Twitter v1.1 media API requires OAuth 1.0a authentication which is not implemented yet',
        suggestion: 'Text-only posting is available. Media upload requires additional OAuth 1.0a implementation.',
        workaround: 'Use text-only posts for now'
      });
    }

    console.log(`📡 Twitter API response:`, {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      ok: uploadResponse.ok
    });

    const responseText = await uploadResponse.text();
    console.log(`📄 Twitter API response body:`, responseText.substring(0, 500));

    let uploadData;
    try {
      uploadData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`❌ Failed to parse Twitter response:`, responseText);
      return res.status(500).json({
        error: 'Invalid Twitter API response',
        details: 'Failed to parse Twitter response as JSON',
        rawResponse: responseText.substring(0, 200)
      });
    }

    if (!uploadResponse.ok) {
      console.error(`❌ Twitter media upload failed:`, uploadData);
      return res.status(uploadResponse.status).json({
        error: 'Twitter media upload failed',
        details: uploadData.errors?.[0]?.message || uploadData.error || 'Unknown error',
        twitterError: uploadData
      });
    }

    console.log(`✅ Media uploaded to Twitter successfully:`, {
      mediaId: uploadData.media_id_string,
      size: uploadData.size,
      type: uploadData.image?.image_type || 'unknown'
    });

    res.json({
      success: true,
      mediaId: uploadData.media_id_string,
      message: 'Media uploaded successfully',
      twitterResponse: uploadData
    });

  } catch (error) {
    console.error('💥 Twitter media upload error:', error);
    console.error('💥 Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack?.substring(0, 500)
    });
  }
});

// Twitter posting endpoint
app.post('/api/twitter/post', async (req, res) => {
  try {
    const { userId, accessToken, text, mediaIds } = req.body;
    
    if (!userId || !accessToken || !text) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'userId, accessToken, and text are required'
      });
    }

    console.log(`📝 Publishing Twitter post for user: ${userId}`);
    console.log(`📄 Post content: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    // Prepare tweet data
    const tweetData = {
      text: text
    };

    // Add media IDs if provided (media should be uploaded separately first)
    if (mediaIds && mediaIds.length > 0) {
      console.log(`📎 Attaching ${mediaIds.length} media files to tweet:`, mediaIds);
      tweetData.media = {
        media_ids: mediaIds
      };
    }

    // Post to Twitter API v2
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`❌ Twitter posting failed:`, responseData);
      return res.status(response.status).json({
        error: 'Twitter posting failed',
        details: responseData.detail || responseData.title || responseData.error,
        twitterError: responseData
      });
    }

    console.log(`✅ Successfully posted to Twitter:`, responseData);

    res.json({
      success: true,
      tweetId: responseData.data.id,
      tweetText: responseData.data.text,
      message: 'Tweet posted successfully'
    });

  } catch (error) {
    console.error('💥 Twitter posting error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Schedule post endpoint
app.post('/api/posts/schedule', async (req, res) => {
  try {
    const { userId, content, platforms, mediaUrls, hashtags, mentions, scheduledTime, credentials } = req.body;
    
    if (!userId || !content || !platforms || !scheduledTime) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'userId, content, platforms, and scheduledTime are required'
      });
    }

    // Validate scheduled time is in the future
    const scheduledDate = new Date(scheduledTime);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ 
        error: 'Invalid scheduled time',
        details: 'Scheduled time must be in the future'
      });
    }

    console.log(`📅 Scheduling post for user: ${userId} at ${scheduledTime}`);

    // Store in database
    const stmt = db.prepare(`
      INSERT INTO scheduled_posts 
      (user_id, content, platforms, media_urls, hashtags, mentions, scheduled_time, status, credentials)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
    `);
    
    stmt.run([
      userId,
      content,
      JSON.stringify(platforms),
      JSON.stringify(mediaUrls || []),
      JSON.stringify(hashtags || []),
      JSON.stringify(mentions || []),
      scheduledTime,
      JSON.stringify(credentials || {})
    ], function(err) {
      if (err) {
        console.error('❌ Error scheduling post:', err);
        return res.status(500).json({ 
          error: 'Failed to schedule post',
          details: err.message
        });
      }

      console.log(`✅ Post scheduled with ID: ${this.lastID}`);
      res.json({
        success: true,
        postId: this.lastID,
        message: 'Post scheduled successfully',
        scheduledTime: scheduledTime
      });
    });

    stmt.finalize();

  } catch (error) {
    console.error('💥 Schedule post error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message
    });
  }
});

// Get scheduled posts endpoint
app.get('/api/posts/scheduled/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all(`
    SELECT * FROM scheduled_posts 
    WHERE user_id = ? 
    ORDER BY scheduled_time ASC
  `, [userId], (err, rows) => {
    if (err) {
      console.error('❌ Error fetching scheduled posts:', err);
      return res.status(500).json({ 
        error: 'Failed to fetch scheduled posts',
        details: err.message
      });
    }

    // Parse JSON fields
    const posts = rows.map(row => ({
      ...row,
      platforms: JSON.parse(row.platforms),
      mediaUrls: JSON.parse(row.media_urls),
      hashtags: JSON.parse(row.hashtags),
      mentions: JSON.parse(row.mentions),
      scheduledTime: new Date(row.scheduled_time)
    }));

    res.json(posts);
  });
});

// Debug endpoint to check all scheduled posts
app.get('/debug/scheduled-posts', (req, res) => {
  db.all(`
    SELECT * FROM scheduled_posts 
    ORDER BY scheduled_time ASC
  `, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching scheduled posts:', err);
      return res.status(500).json({ 
        error: 'Failed to fetch scheduled posts',
        details: err.message
      });
    }

    console.log(`📊 Found ${rows.length} scheduled posts in database`);
    res.json({
      count: rows.length,
      posts: rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        content: row.content.substring(0, 50) + '...',
        platforms: row.platforms,
        scheduled_time: row.scheduled_time,
        status: row.status,
        has_credentials: !!row.credentials
      }))
    });
  });
});

// Get recent posts endpoint (last 25 posts)
app.get('/api/posts/recent', (req, res) => {
  db.all(`
    SELECT * FROM scheduled_posts 
    ORDER BY created_at DESC 
    LIMIT 25
  `, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching recent posts:', err);
      return res.status(500).json({ 
        error: 'Failed to fetch recent posts',
        details: err.message
      });
    }

    // Parse JSON fields and format for frontend
    const posts = rows.map(row => ({
      id: row.id,
      text: row.content,
      platforms: JSON.parse(row.platforms),
      mediaUrls: JSON.parse(row.media_urls),
      hashtags: JSON.parse(row.hashtags),
      mentions: JSON.parse(row.mentions),
      status: row.status,
      createdAt: new Date(row.created_at),
      publishedAt: row.published_at ? new Date(row.published_at) : null,
      scheduledTime: row.scheduled_time ? new Date(row.scheduled_time) : null,
      errorMessage: row.error_message
    }));

    console.log(`📊 Returning ${posts.length} recent posts`);
    res.json(posts);
  });
});

// LinkedIn posting endpoint
app.post('/api/linkedin/post', async (req, res) => {
  try {
    const { userId, accessToken, text, mediaUrls } = req.body;
    
    if (!userId || !accessToken || !text) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'userId, accessToken, and text are required'
      });
    }

    console.log(`📝 Publishing LinkedIn post for user: ${userId}`);
    console.log(`📄 Post content: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    console.log(`🖼️ Media URLs: ${mediaUrls ? mediaUrls.length : 0} files`);

    // Try UGC API first, then fallback to Share API
    let response;
    let postData;
    let apiEndpoint;

    try {
    // Handle media upload first if mediaUrls are provided
    let mediaUrns = [];
    if (mediaUrls && mediaUrls.length > 0) {
      console.log(`📤 Processing ${mediaUrls.length} media files for LinkedIn...`);
      
      for (const mediaUrl of mediaUrls) {
        try {
          console.log(`🔄 Processing media: ${mediaUrl}`);
          
          // For LinkedIn, we'll include the media URL in the text as a workaround
          // This is a temporary solution until we implement proper LinkedIn media upload
          console.log(`ℹ️ Media detected: ${mediaUrl}`);
          console.log(`📝 Will include media URL in post text`);
          
        } catch (mediaError) {
          console.error(`❌ Error processing media ${mediaUrl}:`, mediaError);
        }
      }
    }

      // First try UGC API (requires special permissions)
      apiEndpoint = 'https://api.linkedin.com/v2/ugcPosts';
      
      // Include media URLs in the text if present
      let postText = text;
      if (mediaUrls && mediaUrls.length > 0) {
        postText += '\n\n📎 Media attached:';
        mediaUrls.forEach((url, index) => {
          postText += `\n${index + 1}. ${url}`;
        });
      }
      
      const shareContent = {
        shareCommentary: {
          text: postText
        },
        shareMediaCategory: 'NONE' // LinkedIn media upload is complex, using text-only for now
      };
      
      // Add media if available
      if (mediaUrns.length > 0) {
        shareContent.media = mediaUrns.map(urn => ({
          status: 'READY',
          description: {
            text: 'Image shared via social media app'
          },
          media: urn,
          title: {
            text: 'Shared Image'
          }
        }));
      }
      
      postData = {
        author: `urn:li:person:${userId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': shareContent
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };

      console.log(`🔍 Trying LinkedIn UGC API for posting...`);
      response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify(postData)
      });

      // If UGC API fails with permissions, try Share API
      if (!response.ok) {
        const errorData = await response.json();
        console.log(`❌ UGC API failed:`, errorData);
        
        if (errorData.message?.includes('permissions') || errorData.message?.includes('ugcPosts.CREATE')) {
          console.log(`⚠️ UGC API failed due to permissions, trying Share API...`);
          
          // Fallback to Share API (older, more widely available)
          apiEndpoint = 'https://api.linkedin.com/v2/shares';
          postData = {
            owner: `urn:li:person:${userId}`,
            text: {
              text: text
            },
            distribution: {
              linkedInDistributionTarget: {}
            }
          };
          
          // Note: Share API doesn't support media attachments
          if (mediaUrns.length > 0) {
            console.log(`⚠️ Share API doesn't support media. Posting text only.`);
          }

          console.log(`🔄 Attempting Share API with data:`, JSON.stringify(postData, null, 2));
          response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify(postData)
          });
          
          console.log(`📡 Share API response:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
          });
        } else {
          // If it's not a permissions error, don't try fallback
          console.log(`❌ UGC API failed with non-permission error, not trying fallback`);
        }
      }
    } catch (apiError) {
      console.error(`❌ LinkedIn API error:`, apiError);
      throw apiError;
    }

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`❌ LinkedIn posting failed:`, responseData);
      return res.status(response.status).json({
        error: 'LinkedIn posting failed',
        details: responseData.message || responseData.error || 'Unknown error',
        linkedinError: responseData
      });
    }

    const apiUsed = apiEndpoint.includes('ugcPosts') ? 'UGC API' : 'Share API';
    console.log(`✅ Successfully posted to LinkedIn via ${apiUsed}:`, responseData);

    res.json({
      success: true,
      postId: responseData.id,
      apiUsed: apiUsed,
      message: `LinkedIn post published successfully via ${apiUsed}`
    });

  } catch (error) {
    console.error('💥 LinkedIn posting error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Store PKCE code verifier
app.post('/oauth/store-verifier', (req, res) => {
  const { state, codeVerifier } = req.body;
  console.log(`📥 Received store-verifier request:`, {
    hasState: !!state,
    hasCodeVerifier: !!codeVerifier,
    state: state,
    codeVerifierLength: codeVerifier ? codeVerifier.length : 0
  });
  
  codeVerifiers.set(state, codeVerifier);
  console.log(`💾 Stored code verifier for state: ${state}`);
  console.log(`📊 Total stored verifiers: ${codeVerifiers.size}`);
  console.log(`🗂️ All stored states:`, Array.from(codeVerifiers.keys()));
  
  res.json({ success: true });
});

// Get all campaigns
app.get('/campaigns', (req, res) => {
  db.all(`
    SELECT 
      c.*,
      COUNT(DISTINCT ms.message_id) as total_messages,
      COUNT(DISTINCT CASE WHEN ms.status = 'sent' THEN ms.message_id END) as sent_count,
      COUNT(DISTINCT CASE WHEN ms.status = 'delivered' THEN ms.message_id END) as delivered_count,
      COUNT(DISTINCT CASE WHEN ms.status = 'read' THEN ms.message_id END) as read_count,
      COUNT(DISTINCT CASE WHEN ms.status = 'failed' THEN ms.message_id END) as failed_count
    FROM campaigns c
    LEFT JOIN message_status ms ON c.id = ms.campaign_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get campaign details with full message status
app.get('/campaigns/:id', (req, res) => {
  const campaignId = req.params.id;
  
  // Get campaign info
  db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, campaign) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get all message statuses for this campaign
    db.all(`
      SELECT recipient, status, message_id, timestamp, error 
      FROM message_status 
      WHERE campaign_id = ? 
      ORDER BY message_id, timestamp ASC
    `, [campaignId], (err, statusRows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Group by message_id to create history
      const messageMap = new Map();
      statusRows.forEach(row => {
        if (!messageMap.has(row.message_id)) {
          messageMap.set(row.message_id, { 
            message_id: row.message_id, 
            recipient: row.recipient, 
            history: [] 
          });
        }
        messageMap.get(row.message_id).history.push({ 
          status: row.status, 
          timestamp: row.timestamp, 
          error: row.error 
        });
      });
      
      // Calculate statistics
      const stats = {
        total_numbers: messageMap.size,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0
      };
      
      messageMap.forEach(message => {
        const latestStatus = message.history[message.history.length - 1]?.status;
        if (latestStatus) {
          stats[latestStatus] = (stats[latestStatus] || 0) + 1;
        }
      });
      
      res.json({
        campaign,
        deliveryStatus: Array.from(messageMap.values()),
        statistics: stats
      });
    });
  });
});

// Migration endpoint to convert existing incoming_messages to chat format
app.post('/migrate-to-chat', (req, res) => {
  console.log('🔄 Starting migration of incoming messages to chat format...');
  
  // Get all incoming messages
  db.all('SELECT * FROM incoming_messages ORDER BY timestamp ASC', (err, incomingMessages) => {
    if (err) {
      console.error('Error fetching incoming messages:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log(`Found ${incomingMessages.length} incoming messages to migrate`);
    let migrated = 0;
    let skipped = 0;
    
    incomingMessages.forEach((msg, index) => {
      const businessNumber = "+20107081505";
      const customerNumber = msg.from_number.startsWith('+') ? msg.from_number : `+${msg.from_number}`;
      const conversationId = getConversationId(businessNumber, customerNumber);
      
      // Check if this message already exists in chat_messages
      db.get('SELECT id FROM chat_messages WHERE whatsapp_message_id = ? OR (from_number = ? AND text = ? AND timestamp = ?)', 
        [`incoming_${msg.id}`, customerNumber, msg.text, msg.timestamp], (err2, existing) => {
        
        if (existing) {
          skipped++;
          console.log(`⏭️  Skipped existing message from ${customerNumber}`);
        } else {
          // Insert into chat_messages
          const chatStmt = db.prepare(`INSERT INTO chat_messages 
            (conversation_id, from_number, to_number, message_type, text, media_url, media_type, direction, whatsapp_message_id, status, timestamp, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'inbound', ?, 'delivered', ?, ?)`);
          
          chatStmt.run([
            conversationId,
            customerNumber,
            businessNumber,
            msg.media_type || 'text',
            msg.text,
            msg.media_url,
            msg.media_type,
            `incoming_${msg.id}`,
            msg.timestamp,
            msg.timestamp
          ], function(insertErr) {
            if (insertErr) {
              console.error(`❌ Error migrating message ${msg.id}:`, insertErr);
            } else {
              migrated++;
              console.log(`✅ Migrated message from ${customerNumber}: "${msg.text?.substring(0, 50)}..."`);
              
              // Update or create conversation
              updateConversation(conversationId, customerNumber, msg.text || `[${msg.media_type} message]`);
            }
            
            // Check if this is the last message
            if (index === incomingMessages.length - 1) {
              setTimeout(() => {
                res.json({
                  success: true,
                  migration_completed: true,
                  total_incoming_messages: incomingMessages.length,
                  migrated: migrated,
                  skipped: skipped,
                  timestamp: new Date().toISOString()
                });
              }, 1000); // Wait a bit for all async operations to complete
            }
          });
          chatStmt.finalize();
        }
      });
    });
    
    // Handle empty case
    if (incomingMessages.length === 0) {
      res.json({
        success: true,
        migration_completed: true,
        total_incoming_messages: 0,
        migrated: 0,
        skipped: 0,
        message: 'No incoming messages to migrate'
      });
    }
  });
});

// Force create conversations (simplified approach)
app.post('/force-create-conversations', (req, res) => {
  console.log('🔄 Force creating conversations from chat messages...');
  
  // Clear existing conversations first
  db.run('DELETE FROM conversations', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to clear conversations: ' + err.message });
    }
    
    console.log('✅ Cleared existing conversations');
    
    // Get unique conversations with their latest message
    db.all(`
      SELECT DISTINCT 
        conversation_id, 
        from_number,
        (SELECT text FROM chat_messages cm2 WHERE cm2.conversation_id = cm1.conversation_id ORDER BY timestamp DESC LIMIT 1) as latest_text,
        (SELECT timestamp FROM chat_messages cm2 WHERE cm2.conversation_id = cm1.conversation_id ORDER BY timestamp DESC LIMIT 1) as latest_timestamp
      FROM chat_messages cm1 
      WHERE direction = 'inbound'
    `, (err, conversations) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`Found ${conversations.length} unique conversations`);
      
      let created = 0;
      
      conversations.forEach((conv, index) => {
        console.log(`Creating conversation ${index + 1}: ${conv.conversation_id} (${conv.from_number})`);
        
        const stmt = db.prepare(`
          INSERT INTO conversations 
          (id, contact_number, last_message_text, last_message_timestamp, unread_count, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        
        stmt.run([
          conv.conversation_id,
          conv.from_number,
          conv.latest_text || '[message]',
          conv.latest_timestamp
        ], function(insertErr) {
          if (insertErr) {
            console.log(`❌ Error creating conversation: ${insertErr.message}`);
          } else {
            created++;
            console.log(`✅ Created conversation ${created}: ${conv.from_number}`);
          }
          
          // Send response after last conversation
          if (index === conversations.length - 1) {
            setTimeout(() => {
              res.json({
                success: true,
                created: created,
                total: conversations.length,
                message: `Force created ${created}/${conversations.length} conversations`
              });
            }, 500);
          }
        });
        stmt.finalize();
      });
      
      if (conversations.length === 0) {
        res.json({
          success: true,
          created: 0,
          total: 0,
          message: 'No conversations found to create'
        });
      }
    });
  });
});

// Clean up duplicate messages endpoint
app.post('/cleanup-duplicates', (req, res) => {
  console.log('🧹 Starting cleanup of duplicate messages...');
  
  // Find and remove duplicate chat messages based on whatsapp_message_id
  db.run(`
    DELETE FROM chat_messages 
    WHERE id NOT IN (
      SELECT MIN(id) 
      FROM chat_messages 
      GROUP BY whatsapp_message_id
    )
    AND whatsapp_message_id IS NOT NULL
  `, function(err) {
    if (err) {
      console.error('❌ Error cleaning up duplicates:', err);
      return res.status(500).json({ error: err.message });
    }
    
    const deletedChatMessages = this.changes;
    console.log(`✅ Deleted ${deletedChatMessages} duplicate chat messages`);
    
    // Also clean up duplicates in incoming_messages table
    db.run(`
      DELETE FROM incoming_messages 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM incoming_messages 
        GROUP BY from_number, text, timestamp
      )
    `, function(err2) {
      if (err2) {
        console.error('❌ Error cleaning up incoming message duplicates:', err2);
        return res.status(500).json({ error: err2.message });
      }
      
      const deletedIncomingMessages = this.changes;
      console.log(`✅ Deleted ${deletedIncomingMessages} duplicate incoming messages`);
      
      // Update conversation counts after cleanup
      db.run(`
        UPDATE conversations 
        SET unread_count = (
          SELECT COUNT(*) 
          FROM chat_messages 
          WHERE conversation_id = conversations.id 
          AND direction = 'inbound' 
          AND is_read = FALSE
        )
      `, function(err3) {
        if (err3) {
          console.error('❌ Error updating conversation counts:', err3);
          return res.status(500).json({ error: err3.message });
        }
        
        console.log('✅ Updated conversation unread counts');
        
        res.json({
          success: true,
          duplicates_removed: {
            chat_messages: deletedChatMessages,
            incoming_messages: deletedIncomingMessages
          },
          message: `Cleanup completed! Removed ${deletedChatMessages} duplicate chat messages and ${deletedIncomingMessages} duplicate incoming messages.`
        });
      });
    });
  });
});

// Simple migration endpoint that works
app.post('/simple-migrate', (req, res) => {
  console.log('🔄 Simple migration started...');
  
  // Get all incoming messages
  db.all('SELECT * FROM incoming_messages ORDER BY timestamp DESC', (err, messages) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    let migrated = 0;
    let processed = 0;
    const businessNumber = '+20107081505';
    
    console.log(`Found ${messages.length} incoming messages to process`);
    
    messages.forEach((msg, index) => {
      const customerNumber = msg.from_number.startsWith('+') ? msg.from_number : `+${msg.from_number}`;
      const conversationId = getConversationId(businessNumber, customerNumber);
      
      console.log(`Processing message ${index + 1}: ${customerNumber} -> "${msg.text}"`);
      console.log(`Conversation ID: ${conversationId}`);
      
      // Insert into chat_messages using INSERT OR IGNORE to avoid duplicates
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO chat_messages 
        (conversation_id, from_number, to_number, message_type, text, direction, whatsapp_message_id, status, timestamp) 
        VALUES (?, ?, ?, ?, ?, 'inbound', ?, 'delivered', ?)
      `);
      
      stmt.run([
        conversationId,
        customerNumber,
        businessNumber,
        msg.media_type || 'text',
        msg.text,
        `incoming_${msg.id}`,
        msg.timestamp
      ], function(insertErr) {
        processed++;
        if (insertErr) {
          console.log(`❌ Error inserting message ${msg.id}: ${insertErr.message}`);
        } else if (this.changes > 0) {
          migrated++;
          console.log(`✅ Inserted message ${msg.id} into chat_messages`);
        } else {
          console.log(`⏭️ Message ${msg.id} already exists, skipping`);
        }
        
        // Send response after all messages processed
        if (processed === messages.length) {
          console.log(`✅ Migration completed: ${migrated}/${messages.length} messages processed`);
          res.json({ 
            success: true, 
            migrated: migrated,
            total: messages.length,
            message: `Migration completed: ${migrated}/${messages.length} messages processed`
          });
        }
      });
      stmt.finalize();
    });
    
    // Handle empty case
    if (messages.length === 0) {
      res.json({ 
        success: true, 
        migrated: 0,
        total: 0,
        message: 'No messages to migrate'
      });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Clear database endpoint
app.post('/clear-data', (req, res) => {
  db.run('DELETE FROM message_status');
  db.run('DELETE FROM incoming_messages');
  res.json({ message: 'Database cleared successfully' });
});

// Add real delivery status for your actual phone numbers
app.post('/add-real-status', (req, res) => {
  const { campaignId } = req.body;
  const realNumbers = ['+201555012061', '+201022627976', '+201000400112', '+201100044025'];
  
  // If no campaign provided, create a test campaign
  let useCampaignId = campaignId;
  if (!useCampaignId) {
    const campaignStmt = db.prepare(`INSERT INTO campaigns (name, description, template_name, total_numbers) VALUES (?, ?, ?, ?)`);
    campaignStmt.run(['Test Campaign', 'Auto-generated test campaign', 'test_template', realNumbers.length], function(err) {
      if (!err) {
        useCampaignId = this.lastID;
        console.log(`Created test campaign with ID: ${useCampaignId}`);
      }
    });
    campaignStmt.finalize();
  }
  
  const stmt = db.prepare(`INSERT INTO message_status (recipient, status, message_id, campaign_id) VALUES (?, ?, ?, ?)`);
  
  realNumbers.forEach((number, index) => {
    const messageId = `msg_real_${Date.now()}_${index}`;
    stmt.run([number, 'sent', messageId, useCampaignId]);
    
    // Also add a delivered status for some numbers to show progression
    if (index < 2) {
      setTimeout(() => {
        const deliveredStmt = db.prepare(`INSERT INTO message_status (recipient, status, message_id, campaign_id) VALUES (?, ?, ?, ?)`);
        deliveredStmt.run([number, 'delivered', messageId, useCampaignId]);
        deliveredStmt.finalize();
      }, 1000 * (index + 1));
    }
    
    // Add read status for first number
    if (index === 0) {
      setTimeout(() => {
        const readStmt = db.prepare(`INSERT INTO message_status (recipient, status, message_id, campaign_id) VALUES (?, ?, ?, ?)`);
        readStmt.run([number, 'read', messageId, useCampaignId]);
        readStmt.finalize();
      }, 3000);
    }
  });
  
  stmt.finalize();
  res.json({ 
    message: 'Real delivery status added successfully',
    campaignId: useCampaignId,
    numbersAdded: realNumbers.length
  });
});

// Add test data endpoint (for testing purposes)
app.post('/test-data', (req, res) => {
  const { campaignId } = req.body;
  
  // Create a test campaign if none provided
  if (!campaignId) {
    const campaignStmt = db.prepare(`INSERT INTO campaigns (name, description, template_name, total_numbers) VALUES (?, ?, ?, ?)`);
    campaignStmt.run(['Demo Campaign', 'Sample campaign for testing', 'hello_world', 2], function(err) {
      if (err) {
        console.error('Error creating demo campaign:', err);
        return res.status(500).json({ error: 'Failed to create demo campaign' });
      }
      
      const newCampaignId = this.lastID;
      
      // Add test delivery status
      const stmt1 = db.prepare(`INSERT INTO message_status (recipient, status, message_id, campaign_id) VALUES (?, ?, ?, ?)`);
      stmt1.run(['+1234567890', 'delivered', 'msg_test_123', newCampaignId]);
      stmt1.run(['+9876543210', 'sent', 'msg_test_456', newCampaignId]);
      stmt1.finalize();
      
      // Add test incoming message
      const stmt2 = db.prepare(`INSERT INTO incoming_messages (from_number, text) VALUES (?, ?)`);
      stmt2.run(['+1234567890', 'Hello, this is a test message']);
      stmt2.finalize();
      
      res.json({ 
        message: 'Test data added successfully',
        campaignId: newCampaignId
      });
    });
    campaignStmt.finalize();
  } else {
    // Add test delivery status to existing campaign
    const stmt1 = db.prepare(`INSERT INTO message_status (recipient, status, message_id, campaign_id) VALUES (?, ?, ?, ?)`);
    stmt1.run(['+1234567890', 'delivered', `msg_test_${Date.now()}_1`, campaignId]);
    stmt1.run(['+9876543210', 'sent', `msg_test_${Date.now()}_2`, campaignId]);
    stmt1.finalize();
    
    // Add test incoming message
    const stmt2 = db.prepare(`INSERT INTO incoming_messages (from_number, text) VALUES (?, ?)`);
    stmt2.run(['+1234567890', 'Hello, this is a test message']);
    stmt2.finalize();
    
    res.json({ 
      message: 'Test data added successfully',
      campaignId: campaignId
    });
  }
});

// Real-time status endpoint for specific message
app.get('/status/:messageId', (req, res) => {
  const messageId = req.params.messageId;
  
  db.all('SELECT * FROM message_status WHERE message_id = ? ORDER BY timestamp DESC', [messageId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    if (rows.length === 0) {
      res.json({ message: 'Message not found', status: 'unknown' });
      return;
    }
    
    // Get the latest status
    const latestStatus = rows[0];
    const statusHistory = rows;
    
    res.json({
      messageId: messageId,
      currentStatus: latestStatus.status,
      recipient: latestStatus.recipient,
      lastUpdated: latestStatus.timestamp,
      statusHistory: statusHistory
    });
  });
});

// Get all statuses for a specific recipient
app.get('/recipient/:phoneNumber', (req, res) => {
  const phoneNumber = req.params.phoneNumber;
  
  db.all(`
    SELECT 
      message_id,
      status,
      timestamp,
      CASE 
        WHEN status = 'sent' THEN 1
        WHEN status = 'delivered' THEN 2
        WHEN status = 'read' THEN 3
        WHEN status = 'failed' THEN 0
        ELSE 0
      END as status_order
    FROM message_status 
    WHERE recipient = ?
    ORDER BY message_id, status_order DESC, timestamp DESC
  `, [phoneNumber], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    // Group by message_id to get the latest status for each message
    const messageMap = new Map();
    rows.forEach(row => {
      if (!messageMap.has(row.message_id) || row.status_order > messageMap.get(row.message_id).status_order) {
        messageMap.set(row.message_id, row);
      }
    });
    
    res.json({
      recipient: phoneNumber,
      messages: Array.from(messageMap.values())
    });
  });
});

// Helper to get SQLite-compatible timestamp (UTC, YYYY-MM-DD HH:MM:SS)
function getSqliteTimestamp(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

// Helper to get corrected timestamp (system clock is 1 year ahead)
function getCorrectedTimestamp(date = new Date()) {
  const corrected = new Date(date);
  corrected.setFullYear(corrected.getFullYear() - 1); // Subtract 1 year
  return corrected.toISOString().replace('T', ' ').substring(0, 19);
}

// Helper function to update or create conversation
function updateConversation(conversationId, contactNumber, lastMessageText) {
  const timestamp = getCorrectedTimestamp();
  
  // First, try to update existing conversation
  const updateStmt = db.prepare(`
    UPDATE conversations 
    SET last_message_text = ?, last_message_timestamp = ?, updated_at = ?, unread_count = unread_count + 1
    WHERE id = ?
  `);
  
  const result = updateStmt.run([lastMessageText, timestamp, timestamp, conversationId]);
  updateStmt.finalize();
  
  // If no rows were updated, create new conversation
  if (result.changes === 0) {
    console.log(`🆕 Creating new conversation: ${conversationId} for ${contactNumber}`);
    try {
      const insertStmt = db.prepare(`
        INSERT INTO conversations (id, contact_number, last_message_text, last_message_timestamp, unread_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `);
      insertStmt.run([conversationId, contactNumber, lastMessageText, timestamp, timestamp, timestamp]);
      insertStmt.finalize();
      console.log(`✅ Created conversation: ${conversationId}`);
    } catch (err) {
      console.error(`❌ Error creating conversation: ${err.message}`);
    }
  } else {
    console.log(`✅ Updated conversation: ${conversationId}`);
  }
}

// Helper function to create conversation ID
function getConversationId(number1, number2) {
  const businessNumber = "+20107081505";
  // Always put business number first for consistency
  return number1 === businessNumber ? `${businessNumber}_${number2}` : `${businessNumber}_${number1}`;
}

// Chat API Endpoints

// Get all conversations for chat interface
app.get('/chat/conversations', (req, res) => {
  console.log('🔍 Fetching conversations...');
  
  db.all(`
    SELECT c.*, 
           COUNT(cm.id) as total_messages,
           MAX(cm.timestamp) as last_activity
    FROM conversations c
    LEFT JOIN chat_messages cm ON c.id = cm.conversation_id
    GROUP BY c.id
    ORDER BY c.last_message_timestamp DESC
  `, (err, rows) => {
    if (err) {
      console.error('❌ Database error in conversations:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log(`✅ Found ${rows.length} conversations`);
    console.log('Conversations:', rows.map(r => ({ id: r.id, contact: r.contact_number, last_msg: r.last_message_text })));
    
    res.json(rows);
  });
});

// Get messages for a specific conversation
app.get('/chat/conversations/:conversationId/messages', (req, res) => {
  const { conversationId } = req.params;
  const { limit = 50, before } = req.query;
  
  let query = `
    SELECT * FROM chat_messages 
    WHERE conversation_id = ?
  `;
  
  let params = [conversationId];
  
  if (before) {
    query += ` AND timestamp < ?`;
    params.push(before);
  }
  
  query += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Reverse to show chronological order (oldest first)
    res.json(rows.reverse());
  });
});

// Send a message through chat interface
app.post('/chat/send-message', async (req, res) => {
  const { to_number, text, access_token, phone_number_id } = req.body;
  
  if (!to_number || !text || !access_token || !phone_number_id) {
    return res.status(400).json({ 
      error: 'Missing required fields: to_number, text, access_token, phone_number_id' 
    });
  }
  
  try {
    // Send message via WhatsApp API
    const payload = {
      messaging_product: "whatsapp",
      to: to_number,
      type: "text",
      text: {
        body: text
      }
    };
    
    console.log('Sending chat message:', payload);
    
    const response = await fetch(`https://graph.facebook.com/v22.0/${phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to send message');
    }
    
    const result = await response.json();
    const messageId = result.messages?.[0]?.id;
    
    // Store the outgoing message in our database
    const businessNumber = "+20107081505";
    const conversationId = getConversationId(businessNumber, to_number);
    
    const chatStmt = db.prepare(`INSERT INTO chat_messages 
      (conversation_id, from_number, to_number, message_type, text, direction, whatsapp_message_id, status, timestamp) 
      VALUES (?, ?, ?, 'text', ?, 'outbound', ?, 'sent', ?)`);
    
    const timestamp = getCorrectedTimestamp();
    chatStmt.run([
      conversationId,
      businessNumber,
      to_number,
      text,
      messageId,
      timestamp
    ]);
    chatStmt.finalize();
    
    // Update conversation (but don't increment unread count for outbound messages)
    const updateStmt = db.prepare(`
      UPDATE conversations 
      SET last_message_text = ?, last_message_timestamp = ?, updated_at = ?
      WHERE id = ?
    `);
    
    const updateResult = updateStmt.run([text, timestamp, timestamp, conversationId]);
    updateStmt.finalize();
    
    // If no conversation exists, create one
    if (updateResult.changes === 0) {
      const insertStmt = db.prepare(`
        INSERT INTO conversations (id, contact_number, last_message_text, last_message_timestamp, unread_count)
        VALUES (?, ?, ?, ?, 0)
      `);
      insertStmt.run([conversationId, to_number, text, timestamp]);
      insertStmt.finalize();
    }
    
    console.log(`✅ Chat message sent to ${to_number}: ${text}`);
    
    res.json({
      success: true,
      message_id: messageId,
      conversation_id: conversationId,
      timestamp: timestamp
    });
    
  } catch (error) {
    console.error('❌ Error sending chat message:', error);
    res.status(500).json({
      error: 'Failed to send message',
      details: error.message
    });
  }
});

// Mark conversation as read
app.post('/chat/conversations/:conversationId/mark-read', (req, res) => {
  const { conversationId } = req.params;
  
  // Mark all messages in conversation as read
  const updateMessagesStmt = db.prepare(`
    UPDATE chat_messages SET is_read = TRUE 
    WHERE conversation_id = ? AND direction = 'inbound' AND is_read = FALSE
  `);
  updateMessagesStmt.run([conversationId]);
  updateMessagesStmt.finalize();
  
  // Reset unread count for conversation
  const updateConversationStmt = db.prepare(`
    UPDATE conversations SET unread_count = 0 WHERE id = ?
  `);
  updateConversationStmt.run([conversationId]);
  updateConversationStmt.finalize();
  
  res.json({ success: true });
});

// Debug endpoint to check database tables
app.get('/debug/tables', (req, res) => {
  const results = {};
  let completed = 0;
  const tables = ['chat_messages', 'conversations', 'incoming_messages'];
  
  tables.forEach(tableName => {
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, result) => {
      if (err) {
        results[tableName] = { error: err.message, exists: false };
      } else {
        results[tableName] = { count: result.count, exists: true };
      }
      
      // Get sample data
      if (!err && result.count > 0) {
        db.all(`SELECT * FROM ${tableName} LIMIT 2`, (err2, samples) => {
          if (!err2) {
            results[tableName].samples = samples;
          }
          completed++;
          if (completed === tables.length) {
            res.json(results);
          }
        });
      } else {
        completed++;
        if (completed === tables.length) {
          res.json(results);
        }
      }
    });
  });
});

// Get chat statistics
app.get('/chat/stats', (req, res) => {
  db.all(`
    SELECT 
      COUNT(DISTINCT c.id) as total_conversations,
      SUM(c.unread_count) as total_unread,
      COUNT(DISTINCT CASE WHEN cm.direction = 'inbound' THEN cm.conversation_id END) as conversations_with_replies,
      COUNT(cm.id) as total_messages,
      COUNT(CASE WHEN cm.direction = 'inbound' THEN cm.id END) as inbound_messages,
      COUNT(CASE WHEN cm.direction = 'outbound' THEN cm.id END) as outbound_messages
    FROM conversations c
    LEFT JOIN chat_messages cm ON c.id = cm.conversation_id
  `, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows[0] || {});
  });
});

// Debug endpoint to check database state
app.get('/debug/database-state', (req, res) => {
  // Get table info for all relevant tables
  const tables = ['incoming_messages', 'chat_messages', 'conversations', 'message_status'];
  const results = {};
  let completed = 0;
  
  tables.forEach(tableName => {
    // Check if table exists and get row count
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, result) => {
      if (err) {
        results[tableName] = { error: err.message };
      } else {
        results[tableName] = { count: result.count };
        
        // Get sample data for debugging
        db.all(`SELECT * FROM ${tableName} LIMIT 3`, (err2, samples) => {
          if (!err2) {
            results[tableName].samples = samples;
          }
          completed++;
          
          if (completed === tables.length) {
            res.json({
              database_file: './whatsapp_reports.db',
              timestamp: new Date().toISOString(),
              tables: results
            });
          }
        });
      }
    });
  });
});

// Debug endpoint to manually create test data
app.post('/debug/create-test-chat', (req, res) => {
  const testNumber = '+1234567890';
  const businessNumber = '+20107081505';
  const conversationId = getConversationId(businessNumber, testNumber);
  
  console.log('Creating test chat data...');
  console.log('Conversation ID:', conversationId);
  
  // Insert test chat message
  const chatStmt = db.prepare(`INSERT INTO chat_messages 
    (conversation_id, from_number, to_number, message_type, text, direction, whatsapp_message_id, status, timestamp) 
    VALUES (?, ?, ?, 'text', ?, 'inbound', ?, 'delivered', ?)`);
  
  const timestamp = getCorrectedTimestamp();
  const testMessageId = `test_msg_${Date.now()}`;
  
  chatStmt.run([
    conversationId,
    testNumber,
    businessNumber,
    'Hello, this is a test message for debugging!',
    testMessageId,
    timestamp
  ], function(err) {
    if (err) {
      console.error('Error inserting test chat message:', err);
      return res.status(500).json({ error: err.message });
    }
    
    console.log('Test chat message inserted with ID:', this.lastID);
    
    // Create/update conversation
    updateConversation(conversationId, testNumber, 'Hello, this is a test message for debugging!');
    
    res.json({
      success: true,
      conversation_id: conversationId,
      message_id: this.lastID,
      test_data: {
        from_number: testNumber,
        to_number: businessNumber,
        text: 'Hello, this is a test message for debugging!',
        timestamp: timestamp
      }
    });
  });
  
  chatStmt.finalize();
});

// Sync messages endpoint - to get recent messages when ngrok comes back online
app.get('/chat/sync-recent-messages', (req, res) => {
  const { hours = 24 } = req.query; // Default: get last 24 hours of messages
  const hoursAgo = new Date(Date.now() - (hours * 60 * 60 * 1000));
  
  db.all(`
    SELECT 
      c.*,
      COUNT(cm.id) as new_messages
    FROM conversations c
    LEFT JOIN chat_messages cm ON c.id = cm.conversation_id
    WHERE c.last_message_timestamp > ?
    GROUP BY c.id
    ORDER BY c.last_message_timestamp DESC
  `, [getSqliteTimestamp(hoursAgo)], (err, conversations) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Also get unread message count
    db.get(`
      SELECT 
        COUNT(*) as total_unread_messages,
        COUNT(DISTINCT conversation_id) as conversations_with_unread
      FROM chat_messages 
      WHERE direction = 'inbound' 
      AND is_read = FALSE 
      AND timestamp > ?
    `, [getSqliteTimestamp(hoursAgo)], (err2, stats) => {
      if (err2) {
        console.error('Database error:', err2);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        recent_conversations: conversations,
        sync_stats: {
          hours_synced: hours,
          ...stats
        },
        sync_timestamp: new Date().toISOString()
      });
    });
  });
});

// Get all messages for the business number (useful for debugging/monitoring)
app.get('/chat/all-messages/:phoneNumber', (req, res) => {
  const { phoneNumber } = req.params;
  const { limit = 100 } = req.query;
  
  // Get all conversations for this phone number
  db.all(`
    SELECT cm.*, c.contact_name
    FROM chat_messages cm
    LEFT JOIN conversations c ON cm.conversation_id = c.id
    WHERE cm.to_number = ? OR cm.from_number = ?
    ORDER BY cm.timestamp DESC
    LIMIT ?
  `, [phoneNumber, phoneNumber, parseInt(limit)], (err, messages) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      phone_number: phoneNumber,
      total_messages: messages.length,
      messages: messages
    });
  });
});

// Bulk mark conversations as read (useful when checking messages outside the app)
app.post('/chat/mark-all-read', (req, res) => {
  const { conversation_ids } = req.body;
  
  if (!conversation_ids || !Array.isArray(conversation_ids)) {
    return res.status(400).json({ error: 'conversation_ids array is required' });
  }
  
  const placeholders = conversation_ids.map(() => '?').join(',');
  
  // Mark messages as read
  db.run(`
    UPDATE chat_messages 
    SET is_read = TRUE 
    WHERE conversation_id IN (${placeholders}) 
    AND direction = 'inbound' 
    AND is_read = FALSE
  `, conversation_ids, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Reset unread counts
    db.run(`
      UPDATE conversations 
      SET unread_count = 0 
      WHERE id IN (${placeholders})
    `, conversation_ids, function(err2) {
      if (err2) {
        console.error('Database error:', err2);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ 
        success: true, 
        marked_read_messages: this.changes,
        conversations_updated: conversation_ids.length
      });
    });
  });
});

// Auto-fail job disabled to reduce console spam
// If you need to re-enable this, uncomment the code below:
/*
setInterval(() => {
  const tenMinutesAgo = getSqliteTimestamp(new Date(Date.now() - 10 * 60 * 1000));
  db.all(
    `SELECT * FROM message_status WHERE status = 'sent' AND timestamp < ?`,
    [tenMinutesAgo],
    (err, rows) => {
      if (err) return;
      rows.forEach(row => {
        const insertStmt = db.prepare(`INSERT INTO message_status (recipient, status, message_id, timestamp, error) VALUES (?, 'failed', ?, CURRENT_TIMESTAMP, ?)`);
        insertStmt.run([row.recipient, row.message_id, 'Auto-failed after timeout']);
        insertStmt.finalize();
        console.log(`Auto-inserted failed status: ${row.recipient} (message_id: ${row.message_id})`);
      });
    }
  );
}, 60 * 1000);
*/

// OAuth callback routes for social media platforms
// Store PKCE code verifier endpoint
app.post('/auth/:platform/store-verifier', (req, res) => {
  const { platform } = req.params;
  const { state, codeVerifier } = req.body;
  
  if (!state || !codeVerifier) {
    return res.status(400).json({ error: 'Missing state or codeVerifier' });
  }
  
  console.log(`💾 Storing PKCE code verifier for ${platform} state: ${state}`);
  codeVerifiers.set(state, codeVerifier);
  
  res.json({ success: true });
});

app.get('/auth/:platform/callback', (req, res) => {
  const { platform } = req.params;
  const { code, state, error } = req.query;
  
  console.log(`✅ OAuth callback received for ${platform}:`, { 
    code: code ? 'received' : 'missing', 
    state, 
    error,
    timestamp: new Date().toISOString()
  });
  
  if (error) {
    console.error(`❌ OAuth error for ${platform}:`, error);
    return res.send(createErrorPage(platform, error));
  }
  
  if (!code) {
    console.error(`❌ No authorization code for ${platform}`);
    return res.send(createErrorPage(platform, 'No authorization code received'));
  }

  // Serve the static callback HTML file that handles token exchange
  console.log(`🎉 OAuth successful for ${platform}, sending callback page`);
  res.sendFile(path.join(__dirname, 'public', 'auth-callback.html'));
});

// Note: codeVerifiers Map already declared at the top of the file

// Create simple success page
function createSuccessPage(platform, code, state) {
  return `
    <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Success</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
          }
          .container {
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            backdrop-filter: blur(10px);
            max-width: 400px;
          }
          .success-icon { font-size: 64px; margin-bottom: 20px; }
          .countdown { font-size: 18px; margin-top: 20px; color: #ffd700; }
        </style>
      </head>
        <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Authorization Successful!</h1>
          <p>Successfully authorized ${platform}</p>
          <div class="countdown">Connecting and closing window...</div>
        </div>
          <script>
          console.log('🎉 OAuth success page loaded for ${platform}');
          
          // Immediately try to communicate with parent
          const oauthData = {
            type: 'oauth_success',
            platform: '${platform}',
            code: '${code}',
            state: '${state}',
            timestamp: Date.now()
          };
          
          // Send message to parent window and close
          try {
            if (window.opener) {
              console.log('📤 Sending OAuth data to parent window');
              window.opener.postMessage(oauthData, 'http://localhost:3001');
              
              // Close this popup immediately
            setTimeout(() => {
                console.log('🔚 Closing OAuth popup');
              window.close();
              }, 500);
            } else {
              // Fallback: redirect to main app
              console.log('🔄 No opener found, redirecting to main app');
              window.location.href = 'http://localhost:3001?oauth_success=${platform}&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}';
            }
          } catch (e) {
            console.log('⚠️ Error in OAuth callback:', e);
            // Final fallback
            window.location.href = 'http://localhost:3001?oauth_success=${platform}&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}';
          }
          </script>
        </body>
      </html>
  `;
}

// Create simple error page
function createErrorPage(platform, error) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>OAuth Error</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            text-align: center;
          }
          .container {
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            backdrop-filter: blur(10px);
            max-width: 400px;
          }
          .error-icon { font-size: 64px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Authorization Failed</h1>
          <p>Failed to authorize ${platform}</p>
          <p>Error: ${error}</p>
          <p>This window will close automatically.</p>
        </div>
        <script>
          console.log('❌ OAuth error page loaded for ${platform}:', '${error}');
          
          // Try to redirect parent to main app with error
          try {
          if (window.opener) {
              const redirectUrl = 'http://localhost:3001?oauth_error=${platform}&error=${encodeURIComponent(error)}';
              window.opener.location.href = redirectUrl;
              console.log('🔄 Redirected parent with error');
            }
          } catch (e) {
            console.log('⚠️ Could not redirect parent:', e);
          }
          
          // Close window
          setTimeout(() => {
            try {
            window.close();
            } catch (e) {
              window.location.href = 'http://localhost:3001?oauth_error=${platform}&error=${encodeURIComponent(error)}';
            }
            }, 3000);
        </script>
      </body>
    </html>
  `;
}

// Note: OAuth callback handler is already defined above (serves auth-callback.html)

// OAuth token exchange endpoint for LinkedIn and other platforms
app.post('/oauth/token-exchange', async (req, res) => {
  const { platform, code, state } = req.body;
  
  console.log(`🔄 Token exchange request for ${platform}:`, { 
    hasCode: !!code, 
    hasState: !!state 
  });
  
  console.log(`🔍 Debug platform detection:`, {
    receivedPlatform: platform,
    platformType: typeof platform,
    hasLinkedInClientId: !!process.env.LINKEDIN_CLIENT_ID,
    hasLinkedInSecret: !!process.env.LINKEDIN_CLIENT_SECRET
  });

  try {
    // OAuth configurations for all platforms
    const configs = {
      twitter: {
        clientId: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET,
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        userInfoUrl: 'https://api.twitter.com/2/users/me'
      },
      linkedin: {
        clientId: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        userInfoUrl: 'https://api.linkedin.com/v2/userinfo'
      },
      youtube: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true'
      }
    };

    const config = configs[platform];
    if (!config) {
      return res.status(400).json({ 
        success: false, 
        error: `Unsupported platform: ${platform}` 
      });
    }

    // Exchange code for token
    let tokenRequestBody;
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    };

    if (platform === 'twitter') {
      // Twitter uses PKCE - need to get the stored code verifier
      const storedCodeVerifier = codeVerifiers.get(state);
      if (!storedCodeVerifier) {
        console.error(`❌ No PKCE code verifier found for Twitter state: ${state}`);
        return res.status(400).json({ 
          success: false,
          error: 'PKCE code verifier not found',
          details: `No code verifier stored for state: ${state}`
        });
      }

      tokenRequestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `http://localhost:${PORT}/auth/${platform}/callback`,
        client_id: config.clientId,
        code_verifier: storedCodeVerifier
      });

      // Twitter requires Basic Authentication
      const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
      console.log(`🔐 Using PKCE + Basic Auth for Twitter token exchange`);
    } else {
      // LinkedIn and YouTube use client_secret
      tokenRequestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `http://localhost:${PORT}/auth/${platform}/callback`,
        client_id: config.clientId,
        client_secret: config.clientSecret
      });
      console.log(`🔐 Using client_secret for ${platform} token exchange`);
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: tokenRequestBody
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(`❌ Token exchange failed for ${platform}:`, tokenData);
      return res.status(tokenResponse.status).json({
        success: false,
        error: 'Token exchange failed',
        details: tokenData
      });
    }

    // Get user info
    const userInfoResponse = await fetch(config.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      console.error(`❌ User info failed for ${platform}:`, userInfo);
      return res.status(userInfoResponse.status).json({
        success: false,
        error: 'User info failed',
        details: userInfo
      });
    }

    // Create credentials object with platform-specific user data extraction
    let userId, userName;
    if (platform === 'twitter') {
      userId = userInfo.data?.id;
      userName = userInfo.data?.name;
    } else if (platform === 'linkedin') {
      userId = userInfo.sub;
      userName = userInfo.name;
    } else if (platform === 'youtube') {
      userId = userInfo.sub || userInfo.id;
      userName = userInfo.name || userInfo.given_name;
    }

    const credentials = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      userId: userId,
      userName: userName,
      userInfo: userInfo,
      platform: platform,
      connectedAt: new Date().toISOString()
    };

    console.log(`✅ Successfully completed OAuth for ${platform}:`, {
      hasAccessToken: !!credentials.accessToken,
      userId: credentials.userId,
      userName: credentials.userName
    });

    // Clean up PKCE code verifier for Twitter
    if (platform === 'twitter' && state) {
      codeVerifiers.delete(state);
      console.log(`🗑️ Cleaned up PKCE code verifier for Twitter state: ${state}`);
    }

    res.json({
      success: true,
      credentials: credentials
    });

  } catch (error) {
    console.error(`💥 OAuth token exchange error for ${platform}:`, error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT 
  });
});

// Scheduled posts job - check every 30 seconds for posts to publish
setInterval(async () => {
  const now = new Date().toISOString();
  
  console.log(`🕐 Checking for scheduled posts at ${now}`);
  
  db.all(`
    SELECT * FROM scheduled_posts 
    WHERE status = 'scheduled' AND scheduled_time <= ?
    ORDER BY scheduled_time ASC
  `, [now], async (err, rows) => {
    if (err) {
      console.error('❌ Error checking scheduled posts:', err);
      return;
    }

    if (rows.length === 0) {
      return; // No posts to publish
    }

    console.log(`📅 Found ${rows.length} scheduled posts to publish`);

    for (const post of rows) {
      try {
        console.log(`🚀 Publishing scheduled post ID: ${post.id} - "${post.content.substring(0, 50)}..."`);
        
        // Update status to publishing
        db.run(`
          UPDATE scheduled_posts 
          SET status = 'publishing' 
          WHERE id = ?
        `, [post.id]);

        // Parse the post data
        const platforms = JSON.parse(post.platforms);
        const mediaUrls = JSON.parse(post.media_urls);
        const storedCredentials = JSON.parse(post.credentials || '{}');

        // For now, just mark as published (simplified approach)
        // In a real implementation, you would call the actual platform APIs here
        console.log(`📤 Would publish to platforms: ${platforms.join(', ')}`);
        console.log(`📝 Content: ${post.content}`);
        console.log(`🖼️ Media URLs: ${mediaUrls.length} files`);

        // Mark as published
        db.run(`
          UPDATE scheduled_posts 
          SET status = 'published', published_at = ?
          WHERE id = ?
        `, [new Date().toISOString(), post.id]);

        console.log(`✅ Scheduled post ${post.id} marked as published`);

      } catch (error) {
        console.error(`💥 Error publishing scheduled post ${post.id}:`, error);
        
        // Mark as failed
        db.run(`
          UPDATE scheduled_posts 
          SET status = 'failed', error_message = ?
          WHERE id = ?
        `, [error.message, post.id]);
      }
    }
  });
}, 30000); // Check every 30 seconds

// WebSocket connection handling
const connectedClients = new Set();

wss.on('connection', (ws, req) => {
  console.log('🔗 New WebSocket client connected');
  connectedClients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    data: { status: 'connected', message: 'Welcome to real-time dashboard' },
    timestamp: new Date().toISOString()
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 WebSocket message received:', message.type);
      
      switch (message.type) {
        case 'content_update':
          if (message.data.action === 'subscribe') {
            console.log('📡 Client subscribed to content updates for platforms:', message.data.platforms);
            // Send initial dashboard stats
            sendDashboardUpdate(ws);
          }
          break;
        case 'analytics_update':
          if (message.data.action === 'ping') {
            // Respond to heartbeat
            ws.send(JSON.stringify({
              type: 'analytics_update',
              data: { action: 'pong' },
              timestamp: new Date().toISOString()
            }));
          }
          break;
        case 'platform_status':
          if (message.data.action === 'request') {
            sendPlatformStatus(ws);
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    connectedClients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    connectedClients.delete(ws);
  });

  // Send initial data
  setTimeout(() => {
    sendDashboardUpdate(ws);
    sendPlatformStatus(ws);
  }, 1000);
});

// Function to send dashboard statistics to clients
function sendDashboardUpdate(ws = null) {
  const stats = {
    totalContent: Math.floor(Math.random() * 50) + 20, // Simulated data
    flaggedContent: Math.floor(Math.random() * 5),
    aiAccuracy: 92.0 + Math.random() * 8, // 92-100%
    brandSafety: 70.0 + Math.random() * 25, // 70-95%
    platformActivity: {
      facebook: Math.random() > 0.5,
      instagram: Math.random() > 0.5,
      twitter: Math.random() > 0.5,
      linkedin: Math.random() > 0.5,
      youtube: Math.random() > 0.5,
      tiktok: Math.random() > 0.5
    },
    recentActions: [
      { action: 'Content flagged', platform: 'Facebook', time: new Date().toISOString() },
      { action: 'Rule updated', platform: 'Instagram', time: new Date().toISOString() },
      { action: 'Content approved', platform: 'Twitter', time: new Date().toISOString() }
    ]
  };

  const message = {
    type: 'analytics_update',
    data: stats,
    timestamp: new Date().toISOString()
  };

  if (ws) {
    // Send to specific client
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  } else {
    // Broadcast to all connected clients
    connectedClients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

// Function to send platform status
function sendPlatformStatus(ws = null) {
  const platformStatus = {
    facebook: { status: 'connected', lastSync: new Date().toISOString() },
    instagram: { status: 'connected', lastSync: new Date().toISOString() },
    twitter: { status: 'connected', lastSync: new Date().toISOString() },
    linkedin: { status: 'connected', lastSync: new Date().toISOString() },
    youtube: { status: 'connected', lastSync: new Date().toISOString() },
    tiktok: { status: 'disconnected', lastSync: new Date(Date.now() - 3600000).toISOString() }
  };

  const message = {
    type: 'platform_status',
    data: platformStatus,
    timestamp: new Date().toISOString()
  };

  if (ws) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  } else {
    connectedClients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

// Send periodic updates every 60 seconds (reduced frequency to prevent loops)
setInterval(() => {
  if (connectedClients.size > 0) {
    sendDashboardUpdate();
  }
}, 60000);

// Send platform status updates every 60 seconds
setInterval(() => {
  if (connectedClients.size > 0) {
    sendPlatformStatus();
  }
}, 60000);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 WhatsApp Backend Server running on port ${PORT}`);
  console.log(`🔗 WebSocket server running on ws://localhost:${PORT}/ws`);
  console.log(`📊 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`📊 Reports endpoint: http://localhost:${PORT}/reports`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 OAuth callbacks: http://localhost:${PORT}/auth/{platform}/callback`);
  console.log(`📅 Scheduled posts job started - checking every minute`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
}); 
