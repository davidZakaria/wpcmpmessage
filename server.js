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
                const stmt = db.prepare(`INSERT INTO incoming_messages (from_number, text, media_url, media_type, timestamp) VALUES (?, ?, ?, ?, ?)`);
                stmt.run([
                  message.from,
                  message.text ? message.text.body : null,
                  message.image ? message.image.id : (message.document ? message.document.id : null),
                  message.type,
                  getCorrectedTimestamp()
                ]);
                stmt.finalize();
                
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