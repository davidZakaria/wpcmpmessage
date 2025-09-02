// Simple server test
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Test endpoints
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    port: PORT 
  });
});

app.get('/chat/stats', (req, res) => {
  console.log('Chat stats requested');
  res.json({
    total_conversations: 0,
    total_unread: 0,
    conversations_with_replies: 0,
    total_messages: 0,
    inbound_messages: 0,
    outbound_messages: 0
  });
});

app.get('/chat/conversations', (req, res) => {
  console.log('Conversations requested');
  res.json([]);
});

// OAuth callback for testing - serve the static HTML file
app.get('/auth/:platform/callback', (req, res) => {
  const { platform } = req.params;
  const { code, state, error } = req.query;
  
  console.log(`✅ OAuth callback received for ${platform}:`, { 
    code: code ? 'received' : 'missing', 
    state, 
    error,
    timestamp: new Date().toISOString()
  });
  
  // Serve the static callback HTML file
  res.sendFile(path.join(__dirname, 'public', 'auth-callback.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Test Server running on port ${PORT}`);
  console.log(`✅ Health: http://localhost:${PORT}/health`);
  console.log(`✅ Chat Stats: http://localhost:${PORT}/chat/stats`);
  console.log(`✅ OAuth: http://localhost:${PORT}/auth/{platform}/callback`);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});
