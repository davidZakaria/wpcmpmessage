import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Auto-fail job: mark 'sent' messages older than 10 minutes as 'failed'
setInterval(() => {
  const tenMinutesAgo = getSqliteTimestamp(new Date(Date.now() - 10 * 60 * 1000));
  db.all(
    `SELECT * FROM message_status WHERE status = 'sent' AND timestamp < ?`,
    [tenMinutesAgo],
    (err, rows) => {
      if (err) return;
      rows.forEach(row => {
        // Insert a new failed status event for the same message_id
        const insertStmt = db.prepare(`INSERT INTO message_status (recipient, status, message_id, timestamp, error) VALUES (?, 'failed', ?, CURRENT_TIMESTAMP, ?)`);
        insertStmt.run([row.recipient, row.message_id, 'Auto-failed after timeout']);
        insertStmt.finalize();
        console.log(`Auto-inserted failed status: ${row.recipient} (message_id: ${row.message_id})`);
      });
    }
  );
}, 60 * 1000); // Run every minute

// Start server
app.listen(PORT, () => {
  console.log(`WhatsApp Backend Server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`Reports endpoint: http://localhost:${PORT}/reports`);
  console.log(`Health check: http://localhost:${PORT}/health`);
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