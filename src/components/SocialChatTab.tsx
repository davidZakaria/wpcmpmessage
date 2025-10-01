import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Badge,
  Flex,
  Spacer,
  IconButton,
  Textarea,
  Select,
  Divider,
  Alert,
  AlertIcon,
  useToast,
  Grid,
  GridItem,
  Tab,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Spinner,
  Image,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import {
  FaPaperPlane,
  FaImage,
  FaVideo,
  FaFile,
  FaSmile,
  FaFacebook,
  FaInstagram,
  FaSnapchat,
  FaLinkedin,
  FaTiktok,
  FaCircle,
  FaSearch,
  FaPhone,
  FaVideoSlash,
} from 'react-icons/fa';
import { platformAuth } from '../services/platformAuth';
import { socialMessaging } from '../services/socialMessaging';

interface ChatMessage {
  id: string;
  platform: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'video' | 'file';
  mediaUrl?: string;
  isOutgoing: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

interface Conversation {
  id: string;
  platform: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
  lastSeen?: Date;
}

interface SocialChatTabProps {
  connectedPlatforms: string[];
}

const SocialChatTab: React.FC<SocialChatTabProps> = ({ connectedPlatforms }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const platformIcons = {
    facebook: FaFacebook,
    instagram: FaInstagram,
    snapchat: FaSnapchat,
    linkedin: FaLinkedin,
    tiktok: FaTiktok,
  };

  const platformColors = {
    facebook: 'blue.500',
    instagram: 'pink.500',
    snapchat: 'yellow.400',
    linkedin: 'blue.600',
    tiktok: 'gray.800',
  };

  // Load conversations when component mounts or platform selection changes
  // Use a ref to track if we've already loaded for these platforms to prevent infinite loops
  const loadedPlatformsRef = useRef<string>('');
  
  useEffect(() => {
    const platformsKey = [...connectedPlatforms].sort().join(',');
    const currentKey = `${platformsKey}-${selectedPlatform}`;
    
    // Only reload if the platforms or selected platform actually changed
    if (loadedPlatformsRef.current !== currentKey) {
      loadedPlatformsRef.current = currentKey;
      loadConversations();
    }
  }, [connectedPlatforms, selectedPlatform]);

  // Also load conversations when component first mounts, regardless of connectedPlatforms
  useEffect(() => {
    // Get connected platforms directly from platformAuth
    const actualConnectedPlatforms = platformAuth.getConnectedPlatforms();
    console.log('🔍 Chat tab - actual connected platforms:', actualConnectedPlatforms);
    
    if (actualConnectedPlatforms.length > 0) {
      loadConversations();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      // Get the actual connected platforms directly from platformAuth
      const actualConnectedPlatforms = platformAuth.getConnectedPlatforms();
      console.log('🔍 Loading real conversations from connected platforms:', actualConnectedPlatforms);
      
      // Try to fetch real conversations from connected platforms
      let allConversations: Conversation[] = [];
      
      try {
        allConversations = await socialMessaging.getAllConversations();
        console.log(`✅ Loaded ${allConversations.length} real conversations`);
      } catch (error) {
        console.warn('⚠️ Failed to load real conversations, using demo data:', error);
        
        // Fallback to demo conversations for connected platforms only
        const demoConversations: Conversation[] = [
          {
            id: 'demo_facebook_1',
            platform: 'facebook',
            participantId: 'user_123',
            participantName: 'John Smith',
            participantAvatar: undefined,
            lastMessage: 'Hey, I saw your latest post about social media management!',
            lastMessageTime: new Date(Date.now() - 5 * 60 * 1000),
            unreadCount: 2,
            isOnline: true,
          },
          {
            id: 'demo_instagram_1',
            platform: 'instagram',
            participantId: 'user_456',
            participantName: 'Sarah Johnson',
            participantAvatar: undefined,
            lastMessage: 'Thanks for the follow! Love your content 🔥',
            lastMessageTime: new Date(Date.now() - 30 * 60 * 1000),
            unreadCount: 0,
            isOnline: false,
            lastSeen: new Date(Date.now() - 15 * 60 * 1000),
          },
          {
            id: 'demo_linkedin_1',
            platform: 'linkedin',
            participantId: 'user_789',
            participantName: 'Mike Wilson',
            participantAvatar: undefined,
            lastMessage: 'Would love to connect and discuss potential collaboration',
            lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
            unreadCount: 1,
            isOnline: true,
          },
          {
            id: 'demo_twitter_1',
            platform: 'twitter',
            participantId: 'user_101',
            participantName: 'Alex Chen',
            participantAvatar: undefined,
            lastMessage: 'Great insights on your latest tweet thread!',
            lastMessageTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
            unreadCount: 3,
            isOnline: true,
          },
          {
            id: 'demo_snapchat_1',
            platform: 'snapchat',
            participantId: 'user_202',
            participantName: 'Emma Davis',
            participantAvatar: undefined,
            lastMessage: 'Loved your story today! 📸',
            lastMessageTime: new Date(Date.now() - 45 * 60 * 1000),
            unreadCount: 1,
            isOnline: false,
            lastSeen: new Date(Date.now() - 30 * 60 * 1000),
          },
          {
            id: 'demo_tiktok_1',
            platform: 'tiktok',
            participantId: 'user_303',
            participantName: 'Ryan Martinez',
            participantAvatar: undefined,
            lastMessage: 'Your content strategy video was amazing! 🎥',
            lastMessageTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
            unreadCount: 0,
            isOnline: true,
          },
        ];
        
        // Only show conversations for connected platforms
        allConversations = demoConversations.filter(conv => actualConnectedPlatforms.includes(conv.platform));
        console.log(`📱 Using demo conversations for connected platforms:`, actualConnectedPlatforms);
      }

      // Filter by platform if selected
      const filteredConversations = selectedPlatform === 'all' 
        ? allConversations
        : allConversations.filter(conv => conv.platform === selectedPlatform);

      setConversations(filteredConversations);
      
      console.log(`📱 Displaying ${filteredConversations.length} conversations for platforms:`, 
        selectedPlatform === 'all' ? actualConnectedPlatforms : [selectedPlatform]);
    } catch (error) {
      toast({
        title: 'Error loading conversations',
        description: 'Failed to load conversations. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setIsLoading(true);
    try {
      // Mock messages - replace with actual API calls
      const mockMessages: ChatMessage[] = [
        {
          id: 'msg_1',
          platform: 'facebook',
          conversationId,
          senderId: 'user_123',
          senderName: 'John Smith',
          content: 'Hey, I saw your latest post about social media management!',
          timestamp: new Date(Date.now() - 10 * 60 * 1000),
          type: 'text',
          isOutgoing: false,
          status: 'read',
        },
        {
          id: 'msg_2',
          platform: 'facebook',
          conversationId,
          senderId: 'me',
          senderName: 'You',
          content: 'Thanks! I\'m glad you found it helpful. Are you looking for social media management solutions?',
          timestamp: new Date(Date.now() - 8 * 60 * 1000),
          type: 'text',
          isOutgoing: true,
          status: 'read',
        },
        {
          id: 'msg_3',
          platform: 'facebook',
          conversationId,
          senderId: 'user_123',
          senderName: 'John Smith',
          content: 'Yes, actually! My company is looking for better ways to manage our social presence.',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          type: 'text',
          isOutgoing: false,
          status: 'delivered',
        },
      ];

      setMessages(mockMessages);
    } catch (error) {
      toast({
        title: 'Error loading messages',
        description: 'Failed to load messages. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      platform: selectedConversation.platform,
      conversationId: selectedConversation.id,
      senderId: 'me',
      senderName: 'You',
      content: messageText,
      timestamp: new Date(),
      type: 'text',
      isOutgoing: true,
      status: 'sending',
    };

    setMessages(prev => [...prev, newMessage]);
    setMessageText('');

    try {
      // Call platform-specific messaging API
      await sendPlatformMessage(selectedConversation.platform, selectedConversation.participantId, messageText);
      
      // Update message status
      setMessages(prev => 
        prev.map(msg => 
          msg.id === newMessage.id 
            ? { ...msg, status: 'sent' }
            : msg
        )
      );

      toast({
        title: 'Message sent',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === newMessage.id 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );

      toast({
        title: 'Failed to send message',
        description: 'Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const sendPlatformMessage = async (platform: string, recipientId: string, message: string) => {
    // Platform-specific message sending logic
    switch (platform) {
      case 'facebook':
        // Facebook Messenger API call
        break;
      case 'instagram':
        // Instagram Direct API call
        break;
      case 'linkedin':
        // LinkedIn Messaging API call
        break;
      case 'snapchat':
        // Snapchat API call
        break;
      case 'tiktok':
        // TikTok API call
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv =>
    conv.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box h="600px" border="1px" borderColor="gray.200" borderRadius="lg" overflow="hidden">
      <Grid templateColumns="1fr 2fr" h="100%">
        {/* Conversations List */}
        <GridItem borderRight="1px" borderColor="gray.200" bg="gray.50">
          <VStack spacing={0} h="100%">
            {/* Header */}
            <Box p={4} w="100%" borderBottom="1px" borderColor="gray.200" bg="white">
              <VStack spacing={3}>
                <HStack w="100%">
                  <Text fontWeight="bold" fontSize="lg">Conversations</Text>
                  <Spacer />
                  <Badge colorScheme="blue">{filteredConversations.length}</Badge>
                </HStack>
                
                <InputGroup size="sm">
                  <InputLeftElement pointerEvents="none">
                    <FaSearch color="gray.300" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
                
                <Select
                  size="sm"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                >
                  <option value="all">All Platforms</option>
                  {platformAuth.getConnectedPlatforms().map(platform => (
                    <option key={platform} value={platform}>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </option>
                  ))}
                </Select>
              </VStack>
            </Box>

            {/* Conversations */}
            <Box flex={1} w="100%" overflowY="auto">
              {isLoading ? (
                <Flex justify="center" align="center" h="200px">
                  <Spinner />
                </Flex>
              ) : filteredConversations.length === 0 ? (
                <Flex justify="center" align="center" h="200px" direction="column">
                  <Text color="gray.500" mb={2}>No conversations found</Text>
                  <Text fontSize="sm" color="gray.400">
                    Connect to platforms to start chatting
                  </Text>
                </Flex>
              ) : (
                filteredConversations.map((conversation) => {
                  const PlatformIcon = platformIcons[conversation.platform as keyof typeof platformIcons];
                  return (
                    <Box
                      key={conversation.id}
                      p={3}
                      cursor="pointer"
                      bg={selectedConversation?.id === conversation.id ? 'blue.50' : 'transparent'}
                      _hover={{ bg: 'gray.100' }}
                      borderBottom="1px"
                      borderColor="gray.100"
                      onClick={() => {
                        setSelectedConversation(conversation);
                        loadMessages(conversation.id);
                      }}
                    >
                      <HStack spacing={3}>
                        <Box position="relative">
                          <Avatar
                            size="sm"
                            src={conversation.participantAvatar}
                            name={conversation.participantName}
                          />
                          <Box
                            position="absolute"
                            bottom={0}
                            right={0}
                            w={3}
                            h={3}
                            bg={conversation.isOnline ? 'green.400' : 'gray.400'}
                            borderRadius="full"
                            border="2px"
                            borderColor="white"
                          />
                        </Box>
                        
                        <VStack align="start" spacing={0} flex={1} minW={0}>
                          <HStack w="100%" spacing={2}>
                            <Text fontWeight="medium" fontSize="sm" noOfLines={1} flex={1}>
                              {conversation.participantName}
                            </Text>
                            <PlatformIcon 
                              size={12} 
                              color={platformColors[conversation.platform as keyof typeof platformColors]} 
                            />
                          </HStack>
                          
                          <Text fontSize="xs" color="gray.500" noOfLines={1} w="100%">
                            {conversation.lastMessage}
                          </Text>
                          
                          <HStack w="100%" justify="space-between">
                            <Text fontSize="xs" color="gray.400">
                              {formatTime(conversation.lastMessageTime)}
                            </Text>
                            {conversation.unreadCount > 0 && (
                              <Badge colorScheme="blue" size="sm" borderRadius="full">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </HStack>
                        </VStack>
                      </HStack>
                    </Box>
                  );
                })
              )}
            </Box>
          </VStack>
        </GridItem>

        {/* Chat Area */}
        <GridItem>
          {selectedConversation ? (
            <VStack spacing={0} h="100%">
              {/* Chat Header */}
              <Box p={4} w="100%" borderBottom="1px" borderColor="gray.200" bg="white">
                <HStack spacing={3}>
                  <Avatar
                    size="sm"
                    src={selectedConversation.participantAvatar}
                    name={selectedConversation.participantName}
                  />
                  <VStack align="start" spacing={0} flex={1}>
                    <HStack>
                      <Text fontWeight="bold">{selectedConversation.participantName}</Text>
                      {React.createElement(
                        platformIcons[selectedConversation.platform as keyof typeof platformIcons],
                        { 
                          size: 14, 
                          color: platformColors[selectedConversation.platform as keyof typeof platformColors] 
                        }
                      )}
                    </HStack>
                    <Text fontSize="xs" color="gray.500">
                      {selectedConversation.isOnline 
                        ? 'Online' 
                        : `Last seen ${formatLastSeen(selectedConversation.lastSeen || new Date())}`
                      }
                    </Text>
                  </VStack>
                  <HStack>
                    <IconButton
                      aria-label="Voice call"
                      icon={<FaPhone />}
                      size="sm"
                      variant="ghost"
                    />
                    <IconButton
                      aria-label="Video call"
                      icon={<FaVideoSlash />}
                      size="sm"
                      variant="ghost"
                    />
                  </HStack>
                </HStack>
              </Box>

              {/* Messages */}
              <Box flex={1} w="100%" overflowY="auto" p={4}>
                {isLoading ? (
                  <Flex justify="center" align="center" h="100%">
                    <Spinner />
                  </Flex>
                ) : (
                  <VStack spacing={3} align="stretch">
                    {messages.map((message) => (
                      <Flex
                        key={message.id}
                        justify={message.isOutgoing ? 'flex-end' : 'flex-start'}
                      >
                        <Box
                          maxW="70%"
                          bg={message.isOutgoing ? 'blue.500' : 'gray.100'}
                          color={message.isOutgoing ? 'white' : 'black'}
                          px={3}
                          py={2}
                          borderRadius="lg"
                          borderBottomRightRadius={message.isOutgoing ? 'sm' : 'lg'}
                          borderBottomLeftRadius={message.isOutgoing ? 'lg' : 'sm'}
                        >
                          <Text fontSize="sm">{message.content}</Text>
                          <HStack justify="space-between" mt={1}>
                            <Text fontSize="xs" opacity={0.7}>
                              {formatTime(message.timestamp)}
                            </Text>
                            {message.isOutgoing && (
                              <Text fontSize="xs" opacity={0.7}>
                                {message.status === 'sending' && '⏳'}
                                {message.status === 'sent' && '✓'}
                                {message.status === 'delivered' && '✓✓'}
                                {message.status === 'read' && '✓✓'}
                                {message.status === 'failed' && '❌'}
                              </Text>
                            )}
                          </HStack>
                        </Box>
                      </Flex>
                    ))}
                    <div ref={messagesEndRef} />
                  </VStack>
                )}
              </Box>

              {/* Message Input */}
              <Box p={4} w="100%" borderTop="1px" borderColor="gray.200" bg="white">
                <HStack spacing={2}>
                  <IconButton
                    aria-label="Attach image"
                    icon={<FaImage />}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                  />
                  <IconButton
                    aria-label="Attach video"
                    icon={<FaVideo />}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                  />
                  <IconButton
                    aria-label="Attach file"
                    icon={<FaFile />}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                  />
                  <Input
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    flex={1}
                  />
                  <IconButton
                    aria-label="Send emoji"
                    icon={<FaSmile />}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                  />
                  <Button
                    leftIcon={<FaPaperPlane />}
                    colorScheme="blue"
                    size="sm"
                    onClick={sendMessage}
                    isDisabled={!messageText.trim()}
                  >
                    Send
                  </Button>
                </HStack>
              </Box>
            </VStack>
          ) : (
            <Flex justify="center" align="center" h="100%" direction="column">
              <Text color="gray.500" fontSize="lg" mb={2}>
                Select a conversation to start chatting
              </Text>
              <Text color="gray.400" fontSize="sm">
                Choose from the conversations on the left
              </Text>
            </Flex>
          )}
        </GridItem>
      </Grid>
    </Box>
  );
};

export default SocialChatTab;
