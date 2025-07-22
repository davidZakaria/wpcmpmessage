import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Input, Button, Avatar, Badge, 
  Divider, Flex, InputGroup, InputRightElement, IconButton,
  useToast, Spinner, Alert, AlertIcon, useColorModeValue,
  Textarea, Card, CardBody, Skeleton, SkeletonText, Tooltip
} from '@chakra-ui/react';
import { FaPaperPlane, FaPhone, FaCheck, FaCheckDouble, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { SearchIcon, ChatIcon } from '@chakra-ui/icons';

interface ChatMessage {
  id: number;
  conversation_id: string;
  from_number: string;
  to_number: string;
  message_type: string;
  text: string;
  media_url?: string;
  media_type?: string;
  direction: 'inbound' | 'outbound';
  whatsapp_message_id: string;
  status: string;
  timestamp: string;
  is_read: boolean;
}

interface Conversation {
  id: string;
  contact_number: string;
  contact_name?: string;
  last_message_text: string;
  last_message_timestamp: string;
  unread_count: number;
  total_messages: number;
}

interface ChatStats {
  total_conversations: number;
  total_unread: number;
  conversations_with_replies: number;
  total_messages: number;
  inbound_messages: number;
  outbound_messages: number;
}

export default function ChatTab({ accessToken, phoneNumberId }: { accessToken: string, phoneNumberId: string }) {
  // ALL STATE HOOKS FIRST - NEVER CHANGE ORDER
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<ChatStats | null>(null);
  
  // ALL REF HOOKS SECOND - NEVER CHANGE ORDER
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  
  // ALL CONTEXT HOOKS THIRD - NEVER CHANGE ORDER (INCLUDING TOAST AND THEME)
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');

    // ALL CALLBACK HOOKS FOURTH - NEVER CHANGE ORDER
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/chat/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const createMessagesFromReports = useCallback(async (conversationId: string) => {
    try {
      const reportsResponse = await fetch('http://localhost:3001/reports');
      if (!reportsResponse.ok) throw new Error('Failed to fetch reports');
      
      const reportData = await reportsResponse.json();
      const incomingMessages = reportData.incomingMessages || [];
      
      // Extract the customer number from conversation ID
      const customerNumber = conversationId.split('_')[1];
      console.log('Looking for messages from customer:', customerNumber);
      
      // Filter messages for this specific customer
      const customerMessages = incomingMessages.filter((msg: any) => {
        const msgNumber = msg.from_number.startsWith('+') ? msg.from_number : `+${msg.from_number}`;
        return msgNumber === customerNumber;
      });
      
      console.log('Found customer messages:', customerMessages);
      
      // Convert to chat message format
      const chatMessages: ChatMessage[] = customerMessages.map((msg: any, index: number) => ({
        id: index + 1,
        conversation_id: conversationId,
        from_number: customerNumber,
        to_number: '+20107081505',
        message_type: msg.media_type || 'text',
        text: msg.text,
        media_url: msg.media_url,
        media_type: msg.media_type,
        direction: 'inbound',
        whatsapp_message_id: `incoming_${msg.id}`,
        status: 'delivered',
        timestamp: msg.timestamp,
        is_read: false
      }));
      
      // Sort messages chronologically  
      chatMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      console.log('Created chat messages:', chatMessages);
      setMessages(chatMessages);
      setTimeout(scrollToBottom, 100);
      
    } catch (error) {
      console.error('Error creating messages from reports:', error);
      setMessages([]);
    }
  }, [scrollToBottom]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      console.log('Fetching messages for conversation:', conversationId);
      
      // First try to get messages from the server
      const response = await fetch(`http://localhost:3001/chat/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        console.log('Messages from server:', data);
        setMessages(data);
        scrollToBottom();
        
        // Mark conversation as read
        await fetch(`http://localhost:3001/chat/conversations/${conversationId}/mark-read`, {
          method: 'POST'
        });
        
        // Update local state to reflect read status
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
        ));
      } else {
        // If server fails, create messages from reports data
        console.log('Server failed, creating messages from reports...');
        await createMessagesFromReports(conversationId);
      }
    } catch (error) {
      console.error('Error fetching messages, trying reports fallback:', error);
      await createMessagesFromReports(conversationId);
    }
  }, [createMessagesFromReports, scrollToBottom]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/chat/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching chat stats:', error);
    }
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !accessToken || !phoneNumberId) return;

    setSending(true);
    try {
      const response = await fetch('http://localhost:3001/chat/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_number: selectedConversation.contact_number,
          text: newMessage.trim(),
          access_token: accessToken,
          phone_number_id: phoneNumberId
        })
      });

      if (response.ok) {
        const result = await response.json();
        setNewMessage('');
        
        // Refresh messages to show the new message
        await fetchMessages(selectedConversation.id);
        await fetchConversations(); // Update conversation list
        
        toast({
          title: 'Message sent!',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        const error = await response.json();
        throw new Error(error.details || 'Failed to send message');
      }
    } catch (error: any) {
      toast({
        title: 'Failed to send message',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSending(false);
      messageInputRef.current?.focus();
    }
  };

  // Handle Enter key in message input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get message status icon
  const getMessageStatusIcon = (message: ChatMessage) => {
    if (message.direction === 'inbound') return null;
    
    switch (message.status) {
      case 'sent':
        return <FaCheck color="gray" size="12px" />;
      case 'delivered':
        return <FaCheckDouble color="gray" size="12px" />;
      case 'read':
        return <FaCheckDouble color="blue" size="12px" />;
      case 'failed':
        return <FaExclamationTriangle color="red" size="12px" />;
      default:
        return <FaClock color="gray" size="12px" />;
    }
  };

  // Create conversations from existing data in reports
  const createConversationsFromMessages = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get incoming messages from the reports endpoint 
      const reportsResponse = await fetch('http://localhost:3001/reports');
      if (!reportsResponse.ok) throw new Error('Failed to fetch reports');
      
      const reportData = await reportsResponse.json();
      const incomingMessages = reportData.incomingMessages || [];
      
      if (incomingMessages.length === 0) {
        toast({
          title: 'No messages found',
          description: 'No incoming messages to create conversations from',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      // Group messages by phone number to create conversations
      const conversationMap = new Map();
      const businessNumber = '+20107081505';
      
      console.log('Processing incoming messages:', incomingMessages);
      
      incomingMessages.forEach((msg: any, index: number) => {
        console.log(`Processing message ${index + 1}:`, msg);
        const customerNumber = msg.from_number.startsWith('+') ? msg.from_number : `+${msg.from_number}`;
        const conversationId = `${businessNumber}_${customerNumber}`;
        
        console.log(`Customer: ${customerNumber}, ConversationID: ${conversationId}`);
        
        if (!conversationMap.has(conversationId)) {
          const newConversation = {
            id: conversationId,
            contact_number: customerNumber,
            contact_name: customerNumber,
            last_message_text: msg.text || '[message]',
            last_message_timestamp: msg.timestamp,
            unread_count: 1,
            total_messages: 1
          };
          conversationMap.set(conversationId, newConversation);
          console.log('Created new conversation:', newConversation);
        } else {
          // Update with latest message
          const existing = conversationMap.get(conversationId);
          console.log('Updating existing conversation:', existing);
          if (new Date(msg.timestamp) > new Date(existing.last_message_timestamp)) {
            existing.last_message_text = msg.text || '[message]';
            existing.last_message_timestamp = msg.timestamp;
            console.log('Updated with newer message');
          }
          existing.total_messages += 1;
          existing.unread_count += 1;
        }
      });
      
      // Convert map to array and set as conversations directly
      const createdConversations = Array.from(conversationMap.values());
      
      console.log('Final conversation map size:', conversationMap.size);
      console.log('Created conversations from messages:', createdConversations);
      console.log('Setting conversations in state...');
      
      // Set conversations directly in state
      setConversations(createdConversations);
      
      console.log('Conversations state updated:', createdConversations.length, 'conversations');
      
      toast({
        title: 'Conversations created!',
        description: `Successfully created ${createdConversations.length} conversations from your messages`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Also try to refresh from server
      await fetchStats();
      
    } catch (error: any) {
      console.error('Conversation creation error:', error);
      toast({
        title: 'Failed to create conversations',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast, fetchStats]);

  // ALL MEMO HOOKS FIFTH - NEVER CHANGE ORDER
  const filteredConversations = React.useMemo(() => {
    return conversations.filter(conv =>
      conv.contact_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.contact_name && conv.contact_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      conv.last_message_text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

    // Migration function to convert incoming messages to chat format
  const migrateIncomingMessages = useCallback(async () => {
    try {
      setLoading(true);
      
      // Call the simple migration endpoint
      const response = await fetch('http://localhost:3001/simple-migrate', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Migration endpoint failed');
      }
      
      const result = await response.json();
      console.log('Migration result:', result);
      
      toast({
        title: 'Migration completed!',
        description: `Successfully migrated ${result.migrated} out of ${result.total} messages to chat format`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Refresh data to show the migrated conversations
      await fetchConversations();
      await fetchStats();
      
    } catch (error: any) {
      console.error('Migration error:', error);
      toast({
        title: 'Migration failed',
        description: error.message || 'Unable to migrate messages. Please try restarting the server.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast, fetchConversations, fetchStats]);

  // ALL EFFECT HOOKS SIXTH - NEVER CHANGE ORDER (REMOVED AUTO-REFRESH FOR PERFORMANCE)
  useEffect(() => {
    // Load initial data only once
    fetchConversations();
    fetchStats();
  }, [fetchConversations, fetchStats]);

  useEffect(() => {
    // Select first conversation automatically (only when conversations change)
    if (conversations.length > 0 && !selectedConversation) {
      console.log('Auto-selecting first conversation:', conversations[0]);
      setSelectedConversation(conversations[0]);
      fetchMessages(conversations[0].id);
    }
  }, [conversations, selectedConversation, fetchMessages]);

  return (
    <Box mt={8}>
      {/* Header with Statistics */}
      <Box mb={6} bg={bgColor} p={4} borderRadius="md" boxShadow="md">
        <HStack justify="space-between" mb={4}>
          <Text fontSize="xl" fontWeight="bold" color="green.600">
            💬 WhatsApp Chat Center
          </Text>
          <HStack spacing={4}>
            {stats && (
              <HStack spacing={6} fontSize="sm">
                <VStack spacing={0}>
                  <Text fontWeight="bold">{stats.total_conversations}</Text>
                  <Text color="gray.500">Conversations</Text>
                </VStack>
                <VStack spacing={0}>
                  <Badge colorScheme="red" fontSize="sm">{stats.total_unread}</Badge>
                  <Text color="gray.500">Unread</Text>
                </VStack>
                <VStack spacing={0}>
                  <Text fontWeight="bold">{stats.total_messages}</Text>
                  <Text color="gray.500">Total Messages</Text>
                </VStack>
              </HStack>
            )}
            <Button size="sm" colorScheme="green" onClick={fetchConversations}>
              🔄 Refresh
            </Button>
            <Button 
              size="sm" 
              colorScheme="blue" 
              onClick={migrateIncomingMessages}
              isLoading={loading}
            >
              📥 Import Messages
            </Button>
            <Button 
              size="sm" 
              colorScheme="purple" 
              onClick={createConversationsFromMessages}
              isLoading={loading}
            >
              💬 Create Chats
            </Button>
            <Button 
              size="sm" 
              colorScheme="orange" 
              onClick={() => {
                fetchConversations();
                fetchStats();
              }}
              isLoading={loading}
            >
              🔄 Manual Refresh
            </Button>
          </HStack>
        </HStack>
        
        {(!accessToken || !phoneNumberId) && (
          <Alert status="warning" size="sm">
            <AlertIcon />
            Please set your Access Token and Phone Number ID in the Configuration section to send messages
          </Alert>
        )}
      </Box>

      {/* Main Chat Interface */}
      <Flex height="600px" bg={bgColor} borderRadius="md" boxShadow="md" overflow="hidden">
        
        {/* Conversations Sidebar */}
        <Box width="350px" borderRight="1px solid" borderColor={borderColor}>
          {/* Search */}
          <Box p={4} borderBottom="1px solid" borderBottomColor={borderColor}>
            <InputGroup size="sm">
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputRightElement>
                <SearchIcon color="gray.400" />
              </InputRightElement>
            </InputGroup>
          </Box>

          {/* Conversations List */}
          <Box overflowY="auto" height="calc(100% - 64px)">
            {loading ? (
              <Box p={4}>
                {[1, 2, 3].map(i => (
                  <Box key={i} p={3} borderBottom="1px solid" borderBottomColor={borderColor}>
                    <HStack>
                      <Skeleton borderRadius="50%" width="40px" height="40px" />
                      <VStack align="start" flex="1" spacing={1}>
                        <Skeleton height="14px" width="120px" />
                        <SkeletonText noOfLines={1} width="80px" />
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </Box>
            ) : filteredConversations.length === 0 ? (
              <Box p={8} textAlign="center" color="gray.500">
                <ChatIcon boxSize={8} mb={2} />
                <Text>No conversations yet</Text>
                <Text fontSize="sm">Start by sending a campaign message</Text>
              </Box>
            ) : (
              filteredConversations.map((conv) => (
                <Box
                  key={conv.id}
                  p={3}
                  cursor="pointer"
                  bg={selectedConversation?.id === conv.id ? selectedBg : 'transparent'}
                  _hover={{ bg: hoverBg }}
                  borderBottom="1px solid"
                  borderBottomColor={borderColor}
                  onClick={() => {
                    console.log('Selecting conversation:', conv);
                    setSelectedConversation(conv);
                    fetchMessages(conv.id);
                  }}
                >
                  <HStack spacing={3}>
                    <Avatar size="sm" name={conv.contact_name || conv.contact_number} />
                    <VStack align="start" spacing={0} flex="1" minWidth={0}>
                      <HStack justify="space-between" width="100%">
                        <Text fontWeight="semibold" fontSize="sm" noOfLines={1}>
                          {conv.contact_name || conv.contact_number}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {formatTime(conv.last_message_timestamp)}
                        </Text>
                      </HStack>
                      <HStack justify="space-between" width="100%">
                        <Text fontSize="sm" color="gray.600" noOfLines={1} flex="1">
                          {conv.last_message_text}
                        </Text>
                        {conv.unread_count > 0 && (
                          <Badge colorScheme="green" size="sm" borderRadius="full">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </HStack>
                    </VStack>
                  </HStack>
                </Box>
              ))
            )}
          </Box>
        </Box>

        {/* Chat Messages Area */}
        <Flex direction="column" flex="1">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <Box p={4} borderBottom="1px solid" borderBottomColor={borderColor} bg={hoverBg}>
                <HStack>
                  <Avatar size="sm" name={selectedConversation.contact_name || selectedConversation.contact_number} />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="bold">
                      {selectedConversation.contact_name || selectedConversation.contact_number}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      WhatsApp • {messages.length} messages
                    </Text>
                  </VStack>
                  <Box flex="1" />
                  <Tooltip label="View in WhatsApp Business">
                    <IconButton
                      aria-label="Phone"
                      icon={<FaPhone />}
                      size="sm"
                      variant="ghost"
                      colorScheme="green"
                    />
                  </Tooltip>
                </HStack>
              </Box>

              {/* Messages */}
              <Box flex="1" overflowY="auto" p={4} bg={hoverBg}>
                <VStack spacing={3} align="stretch">
                  {messages.map((message) => (
                    <Box
                      key={message.id}
                      alignSelf={message.direction === 'outbound' ? 'flex-end' : 'flex-start'}
                      maxWidth="70%"
                    >
                      <Card
                        bg={message.direction === 'outbound' 
                          ? 'green.500'
                          : bgColor
                        }
                        color={message.direction === 'outbound' ? 'white' : 'inherit'}
                        size="sm"
                      >
                        <CardBody p={3}>
                          <Text fontSize="sm" lineHeight="1.4">
                            {message.text}
                          </Text>
                          <HStack justify="space-between" mt={2} fontSize="xs" opacity={0.8}>
                            <Text>{formatTime(message.timestamp)}</Text>
                            {getMessageStatusIcon(message)}
                          </HStack>
                        </CardBody>
                      </Card>
                    </Box>
                  ))}
                  <div ref={messagesEndRef} />
                </VStack>
              </Box>

              {/* Message Input */}
              <Box p={4} borderTop="1px solid" borderTopColor={borderColor}>
                <HStack spacing={2}>
                  <Textarea
                    ref={messageInputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    size="sm"
                    resize="none"
                    rows={2}
                    isDisabled={!accessToken || !phoneNumberId}
                  />
                  <Button
                    colorScheme="green"
                    size="sm"
                    onClick={sendMessage}
                    isLoading={sending}
                    isDisabled={!newMessage.trim() || !accessToken || !phoneNumberId}
                    px={6}
                  >
                    <FaPaperPlane />
                  </Button>
                </HStack>
              </Box>
            </>
          ) : (
            <Flex align="center" justify="center" flex="1" direction="column" color="gray.500">
              <ChatIcon boxSize={12} mb={4} />
              <Text fontSize="lg">Select a conversation to start chatting</Text>
              <Text fontSize="sm">Choose a conversation from the sidebar</Text>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Box>
  );
} 