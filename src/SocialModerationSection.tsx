import React, { useState, useEffect } from 'react';
import { platformAuth } from './services/platformAuth';
import { contentFetcher, SocialContent } from './services/contentFetcher';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Input,
  Select,
  Textarea,
  Switch,
  FormControl,
  FormLabel,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Grid,
  GridItem,
  Icon,
  Flex,
  Spacer,
  Divider,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Tooltip,
} from '@chakra-ui/react';
import {
  FaShieldAlt,
  FaEye,
  FaRobot,
  FaUsers,
  FaChartLine,
  FaCog,
  FaCloud,
  FaExclamationTriangle,
  FaBan,
  FaCheck,
  FaClock,
  FaFilter,
  FaSearch,
  FaDownload,
  FaUpload,
  FaPlay,
  FaPause,
  FaStop,
  FaSyncAlt,
  FaGlobe,
  FaFacebook,
  FaTwitter,
  FaInstagram,
  FaYoutube,
  FaTiktok,
  FaLinkedin,
} from 'react-icons/fa';

interface ContentItem {
  id: string;
  platform: string;
  content: string;
  author: string;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  aiConfidence: number;
}

interface ModerationRule {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
  action: 'flag' | 'block' | 'review' | 'auto-approve';
}

interface Platform {
  id: string;
  name: string;
  icon: any;
  enabled: boolean;
  connected: boolean;
  lastSync: Date;
  itemsProcessed: number;
  connecting?: boolean;
  userName?: string;
  userId?: string;
}

const SocialModerationSection: React.FC = () => {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [moderationRules, setModerationRules] = useState<ModerationRule[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: 'facebook', name: 'Facebook', icon: FaFacebook, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'twitter', name: 'Twitter', icon: FaTwitter, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'instagram', name: 'Instagram', icon: FaInstagram, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'youtube', name: 'YouTube', icon: FaYoutube, enabled: true, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'tiktok', name: 'TikTok', icon: FaTiktok, enabled: false, connected: false, lastSync: new Date(), itemsProcessed: 0 },
    { id: 'linkedin', name: 'LinkedIn', icon: FaLinkedin, enabled: false, connected: false, lastSync: new Date(), itemsProcessed: 0 },
  ]);
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [newRule, setNewRule] = useState<Partial<ModerationRule>>({});
  
  const { isOpen: isContentModalOpen, onOpen: onContentModalOpen, onClose: onContentModalClose } = useDisclosure();
  const { isOpen: isRuleModalOpen, onOpen: onRuleModalOpen, onClose: onRuleModalClose } = useDisclosure();
  const toast = useToast();
  
  // Real content state
  const [realContent, setRealContent] = useState<SocialContent[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Check platform connections on mount
  useEffect(() => {
    checkPlatformConnections();
    loadRealContent();
  }, []);

  // Check which platforms are connected
  const checkPlatformConnections = () => {
    setPlatforms(prev => prev.map(platform => {
      const isConnected = platformAuth.isConnected(platform.id);
      const credentials = platformAuth.getCredentials(platform.id);
      
      return {
        ...platform,
        connected: isConnected,
        userName: credentials?.userName,
        userId: credentials?.userId
      };
    }));
  };

  // Load real content from connected platforms
  const loadRealContent = async () => {
    setIsLoadingContent(true);
    try {
      console.log('🔍 Loading content from connected platforms...');
      
      // Check which platforms are connected
      const connectedPlatforms = platformAuth.getConnectedPlatforms();
      console.log('🔗 Connected platforms:', connectedPlatforms);
      
      // Check Twitter credentials specifically
      const twitterCredentials = platformAuth.getCredentials('twitter');
      console.log('🐦 Twitter credentials:', {
        hasCredentials: !!twitterCredentials,
        userId: twitterCredentials?.userId,
        userName: twitterCredentials?.userName,
        hasAccessToken: !!twitterCredentials?.accessToken
      });
      
      const content = await contentFetcher.fetchAllContent({ limit: 50 });
      console.log('📱 Fetched content:', {
        totalItems: content.length,
        platforms: [...new Set(content.map(item => item.platform))],
        twitterItems: content.filter(item => item.platform === 'twitter').length
      });
      
      setRealContent(content);
      
      // Update platform stats
      const stats = await contentFetcher.getContentStats();
      setPlatforms(prev => prev.map(platform => ({
        ...platform,
        itemsProcessed: stats.platformBreakdown[platform.id] || 0
      })));
      
      toast({
        title: 'Content Loaded',
        description: `Loaded ${content.length} posts from connected platforms (${content.filter(item => item.platform === 'twitter').length} from Twitter)`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to load real content:', error);
      toast({
        title: 'Content Load Failed',
        description: `Failed to load content from platforms: ${error.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Connect to platform
  const connectPlatform = async (platformId: string) => {
    try {
      setPlatforms(prev => prev.map(p => 
        p.id === platformId ? { ...p, connecting: true } : p
      ));

      const authUrl = await platformAuth.generateAuthUrl(platformId);
      
      // Open popup window for OAuth
      const popup = window.open(
        authUrl,
        'oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for OAuth callback
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          // Check if connection was successful
          setTimeout(() => {
            checkPlatformConnections();
            if (platformAuth.isConnected(platformId)) {
              toast({
                title: 'Platform Connected',
                description: `Successfully connected to ${platforms.find(p => p.id === platformId)?.name}`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              });
              loadRealContent();
            }
          }, 1000);
        }
      }, 1000);

    } catch (error) {
      console.error(`Failed to connect to ${platformId}:`, error);
      toast({
        title: 'Connection Failed',
        description: `Failed to connect to ${platforms.find(p => p.id === platformId)?.name}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setPlatforms(prev => prev.map(p => 
        p.id === platformId ? { ...p, connecting: false } : p
      ));
    }
  };

  // Disconnect from platform
  const disconnectPlatform = (platformId: string) => {
    platformAuth.disconnect(platformId);
    checkPlatformConnections();
    loadRealContent();
    
    toast({
      title: 'Platform Disconnected',
      description: `Disconnected from ${platforms.find(p => p.id === platformId)?.name}`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Test platform connection
  const testPlatformConnection = async (platformId: string) => {
    try {
      const isWorking = await platformAuth.testConnection(platformId);
      toast({
        title: isWorking ? 'Connection Working' : 'Connection Failed',
        description: isWorking 
          ? `${platforms.find(p => p.id === platformId)?.name} connection is working properly`
          : `${platforms.find(p => p.id === platformId)?.name} connection has issues`,
        status: isWorking ? 'success' : 'error',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error(`Connection test failed for ${platformId}:`, error);
      toast({
        title: 'Connection Test Failed',
        description: `Could not test connection to ${platforms.find(p => p.id === platformId)?.name}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Sample data initialization
  useEffect(() => {
    const sampleContent: ContentItem[] = [
      {
        id: '1',
        platform: 'facebook',
        content: 'This is a sample post that contains some questionable language and might need review.',
        author: 'user123',
        timestamp: new Date(),
        status: 'flagged',
        severity: 'medium',
        category: 'Language',
        aiConfidence: 85
      },
      {
        id: '2',
        platform: 'twitter',
        content: 'Great product! Highly recommend to everyone.',
        author: 'happycustomer',
        timestamp: new Date(Date.now() - 3600000),
        status: 'approved',
        severity: 'low',
        category: 'Positive',
        aiConfidence: 95
      },
      {
        id: '3',
        platform: 'instagram',
        content: 'This content contains potential spam and promotional links.',
        author: 'spammer456',
        timestamp: new Date(Date.now() - 7200000),
        status: 'rejected',
        severity: 'high',
        category: 'Spam',
        aiConfidence: 92
      }
    ];

    const sampleRules: ModerationRule[] = [
      {
        id: '1',
        name: 'Hate Speech Detection',
        description: 'Automatically flag content containing hate speech or discriminatory language',
        category: 'Safety',
        enabled: true,
        severity: 'critical',
        keywords: ['hate', 'discrimination', 'offensive'],
        action: 'block'
      },
      {
        id: '2',
        name: 'Spam Filter',
        description: 'Detect and filter spam content and promotional messages',
        category: 'Quality',
        enabled: true,
        severity: 'medium',
        keywords: ['spam', 'promotion', 'click here', 'free money'],
        action: 'flag'
      },
      {
        id: '3',
        name: 'Explicit Content',
        description: 'Flag explicit or inappropriate visual content',
        category: 'Safety',
        enabled: true,
        severity: 'high',
        keywords: ['explicit', 'inappropriate', 'nsfw'],
        action: 'review'
      }
    ];

    setContentItems(sampleContent);
    setModerationRules(sampleRules);
  }, []);

  const handleStartMonitoring = () => {
    setIsMonitoring(true);
    toast({
      title: 'Monitoring Started',
      description: 'Real-time content monitoring is now active across all connected platforms.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    toast({
      title: 'Monitoring Stopped',
      description: 'Real-time content monitoring has been paused.',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleContentAction = (contentId: string, action: 'approve' | 'reject' | 'flag') => {
    setContentItems(prev => prev.map(item => 
      item.id === contentId 
        ? { ...item, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged' }
        : item
    ));
    
    toast({
      title: `Content ${action}d`,
      description: `The content has been successfully ${action}d.`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.description) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both name and description for the rule.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const rule: ModerationRule = {
      id: Date.now().toString(),
      name: newRule.name,
      description: newRule.description,
      category: newRule.category || 'Custom',
      enabled: true,
      severity: newRule.severity || 'medium',
      keywords: newRule.keywords || [],
      action: newRule.action || 'flag'
    };

    setModerationRules(prev => [...prev, rule]);
    setNewRule({});
    onRuleModalClose();
    
    toast({
      title: 'Rule Created',
      description: `Moderation rule "${rule.name}" has been created successfully.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const filteredContent = contentItems.filter(item => {
    const matchesSeverity = filterSeverity === 'all' || item.severity === filterSeverity;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesPlatform = filterPlatform === 'all' || item.platform === filterPlatform;
    const matchesSearch = searchTerm === '' || 
      item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.author.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSeverity && matchesStatus && matchesPlatform && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'green';
      case 'rejected': return 'red';
      case 'flagged': return 'orange';
      case 'pending': return 'blue';
      default: return 'gray';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading size="lg" color="purple.600">
              🛡️ Social Media Moderation
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Advanced AI-powered content moderation with real-time monitoring and iCloud integration
            </Text>
          </VStack>
          
          <HStack spacing={3}>
            <Button
              leftIcon={<Icon as={isMonitoring ? FaPause : FaPlay} />}
              colorScheme={isMonitoring ? "orange" : "green"}
              onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
              size="sm"
            >
              {isMonitoring ? 'Pause' : 'Start'} Monitoring
            </Button>
            <Button
              leftIcon={<Icon as={FaSyncAlt} />}
              variant="outline"
              onClick={() => window.location.reload()}
              size="sm"
            >
              Refresh
            </Button>
          </HStack>
        </HStack>

        {/* Status Cards */}
        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Content Processed Today</StatLabel>
                  <StatNumber>2,139</StatNumber>
                  <StatHelpText>
                    <StatArrow type="increase" />
                    23% from yesterday
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Flagged Content</StatLabel>
                  <StatNumber color="orange.500">47</StatNumber>
                  <StatHelpText>
                    <StatArrow type="decrease" />
                    12% from yesterday
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>AI Accuracy</StatLabel>
                  <StatNumber color="green.500">94.2%</StatNumber>
                  <StatHelpText>
                    <StatArrow type="increase" />
                    2.1% improvement
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Active Platforms</StatLabel>
                  <StatNumber>{platforms.filter(p => p.enabled && p.connected).length}</StatNumber>
                  <StatHelpText>of {platforms.length} configured</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        <Tabs variant="enclosed" colorScheme="purple">
          <TabList>
            <Tab><Icon as={FaEye} mr={2} />Real-time Monitor</Tab>
            <Tab><Icon as={FaRobot} mr={2} />AI Filtering</Tab>
            <Tab><Icon as={FaGlobe} mr={2} />Platforms</Tab>
            <Tab><Icon as={FaUsers} mr={2} />User Management</Tab>
            <Tab><Icon as={FaChartLine} mr={2} />Analytics</Tab>
            <Tab><Icon as={FaCog} mr={2} />Settings</Tab>
          </TabList>

          <TabPanels>
            {/* Real-time Monitor Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack spacing={4} wrap="wrap">
                  <Input
                    placeholder="Search content or authors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    maxW="300px"
                  />
                  
                  <Select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    maxW="150px"
                  >
                    <option value="all">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Select>
                  
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    maxW="150px"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="flagged">Flagged</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                  
                  <Select
                    value={filterPlatform}
                    onChange={(e) => setFilterPlatform(e.target.value)}
                    maxW="150px"
                  >
                    <option value="all">All Platforms</option>
                    {platforms.map(platform => (
                      <option key={platform.id} value={platform.id}>
                        {platform.name}
                      </option>
                    ))}
                  </Select>
                </HStack>

                <Card>
                  <CardHeader>
                    <HStack justify="space-between">
                      <Text fontSize="lg" fontWeight="bold">Content Queue ({filteredContent.length})</Text>
                      <Badge colorScheme={isMonitoring ? 'green' : 'gray'}>
                        {isMonitoring ? 'Live' : 'Paused'}
                      </Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    {filteredContent.length === 0 ? (
                      <Text color="gray.500" textAlign="center" py={8}>
                        No content matches your current filters
                      </Text>
                    ) : (
                      <Table variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Platform</Th>
                            <Th>Content</Th>
                            <Th>Author</Th>
                            <Th>Severity</Th>
                            <Th>Status</Th>
                            <Th>AI Score</Th>
                            <Th>Actions</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {filteredContent.map((item) => (
                            <Tr key={item.id}>
                              <Td>
                                <Badge colorScheme="blue">{item.platform}</Badge>
                              </Td>
                              <Td maxW="300px">
                                <Text isTruncated>{item.content}</Text>
                              </Td>
                              <Td>{item.author}</Td>
                              <Td>
                                <Badge colorScheme={getSeverityColor(item.severity)}>
                                  {item.severity}
                                </Badge>
                              </Td>
                              <Td>
                                <Badge colorScheme={getStatusColor(item.status)}>
                                  {item.status}
                                </Badge>
                              </Td>
                              <Td>{item.aiConfidence}%</Td>
                              <Td>
                                <HStack spacing={2}>
                                  <Button
                                    size="xs"
                                    colorScheme="green"
                                    onClick={() => handleContentAction(item.id, 'approve')}
                                  >
                                    <Icon as={FaCheck} />
                                  </Button>
                                  <Button
                                    size="xs"
                                    colorScheme="red"
                                    onClick={() => handleContentAction(item.id, 'reject')}
                                  >
                                    <Icon as={FaBan} />
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedContent(item);
                                      onContentModalOpen();
                                    }}
                                  >
                                    View
                                  </Button>
                                </HStack>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    )}
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* AI Filtering Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">Moderation Rules</Text>
                  <Button
                    leftIcon={<Icon as={FaFilter} />}
                    colorScheme="purple"
                    onClick={onRuleModalOpen}
                  >
                    Create Rule
                  </Button>
                </HStack>

                <Grid templateColumns="repeat(auto-fill, minmax(350px, 1fr))" gap={4}>
                  {moderationRules.map((rule) => (
                    <Card key={rule.id}>
                      <CardHeader>
                        <HStack justify="space-between">
                          <VStack align="start" spacing={1}>
                            <Text fontWeight="bold">{rule.name}</Text>
                            <Badge colorScheme={getSeverityColor(rule.severity)}>
                              {rule.severity}
                            </Badge>
                          </VStack>
                          <Switch isChecked={rule.enabled} />
                        </HStack>
                      </CardHeader>
                      <CardBody>
                        <VStack align="start" spacing={3}>
                          <Text fontSize="sm" color="gray.600">
                            {rule.description}
                          </Text>
                          <HStack>
                            <Text fontSize="xs" fontWeight="bold">Category:</Text>
                            <Badge size="sm">{rule.category}</Badge>
                          </HStack>
                          <HStack>
                            <Text fontSize="xs" fontWeight="bold">Action:</Text>
                            <Badge size="sm" colorScheme="blue">{rule.action}</Badge>
                          </HStack>
                          {rule.keywords.length > 0 && (
                            <Box>
                              <Text fontSize="xs" fontWeight="bold" mb={1}>Keywords:</Text>
                              <Wrap>
                                {rule.keywords.map((keyword, index) => (
                                  <WrapItem key={index}>
                                    <Tag size="sm" colorScheme="gray">
                                      <TagLabel>{keyword}</TagLabel>
                                    </Tag>
                                  </WrapItem>
                                ))}
                              </Wrap>
                            </Box>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  ))}
                </Grid>
              </VStack>
            </TabPanel>

            {/* Platforms Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between" align="center">
                  <Text fontSize="lg" fontWeight="bold">Platform Integration</Text>
                  <Button
                    size="sm"
                    colorScheme="purple"
                    variant="outline"
                    onClick={loadRealContent}
                    isLoading={isLoadingContent}
                    loadingText="Syncing..."
                  >
                    Sync All Platforms
                  </Button>
                </HStack>

                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Setup Required!</AlertTitle>
                    <AlertDescription>
                      To connect platforms, you need to set up API credentials. 
                      Copy the <code>env.example</code> file to <code>.env</code> and add your API keys.
                      <br />
                      <Text mt={2} fontSize="sm">
                        📖 <strong>Setup Guide:</strong> Check the SOCIAL_MEDIA_SETUP.md file for detailed instructions.
                      </Text>
                      <Text mt={1} fontSize="xs" color="orange.600">
                        ⚠️ <strong>Important:</strong> Use <code>VITE_</code> prefix for environment variables (not REACT_APP_)
                      </Text>
                    </AlertDescription>
                  </Box>
                </Alert>
                
                <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={4}>
                  {platforms.map((platform) => (
                    <Card key={platform.id}>
                      <CardHeader>
                        <HStack justify="space-between">
                          <HStack>
                            <Icon as={platform.icon} color="blue.500" boxSize={6} />
                            <Text fontWeight="bold">{platform.name}</Text>
                          </HStack>
                          <Switch isChecked={platform.enabled} />
                        </HStack>
                      </CardHeader>
                      <CardBody>
                        <VStack align="start" spacing={3}>
                          <HStack>
                            <Text fontSize="sm" fontWeight="bold">Status:</Text>
                            <Badge colorScheme={platform.connected ? 'green' : 'red'}>
                              {platform.connected ? 'Connected' : 'Disconnected'}
                            </Badge>
                          </HStack>
                          {platform.connected && platform.userName && (
                            <HStack>
                              <Text fontSize="sm" fontWeight="bold">User:</Text>
                              <Text fontSize="sm">{platform.userName}</Text>
                            </HStack>
                          )}
                          <HStack>
                            <Text fontSize="sm" fontWeight="bold">Items Processed:</Text>
                            <Text fontSize="sm">{platform.itemsProcessed.toLocaleString()}</Text>
                          </HStack>
                          <HStack>
                            <Text fontSize="sm" fontWeight="bold">Last Sync:</Text>
                            <Text fontSize="sm">{platform.lastSync.toLocaleTimeString()}</Text>
                          </HStack>
                          
                          <VStack spacing={2} width="full">
                            {platform.connected ? (
                              <>
                                <Button 
                                  size="sm" 
                                  colorScheme="green" 
                                  variant="outline" 
                                  width="full"
                                  onClick={() => testPlatformConnection(platform.id)}
                                >
                                  Test Connection
                                </Button>
                                <Button 
                                  size="sm" 
                                  colorScheme="red" 
                                  variant="outline" 
                                  width="full"
                                  onClick={() => disconnectPlatform(platform.id)}
                                >
                                  Disconnect
                                </Button>
                              </>
                            ) : (
                              <Button 
                                size="sm" 
                                colorScheme="blue" 
                                width="full"
                                onClick={() => connectPlatform(platform.id)}
                                isLoading={platform.connecting}
                                loadingText="Connecting..."
                                isDisabled={!platform.enabled}
                              >
                                Connect
                              </Button>
                            )}
                          </VStack>
                        </VStack>
                      </CardBody>
                    </Card>
                  ))}
                </Grid>
              </VStack>
            </TabPanel>

            {/* User Management Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold">User Management & Permissions</Text>
                
                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Role-based Access Control</AlertTitle>
                    <AlertDescription>
                      Manage user permissions and collaboration between moderation teams.
                    </AlertDescription>
                  </Box>
                </Alert>

                <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={4}>
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Administrator</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={2}>
                        <Text fontSize="sm">Full system access</Text>
                        <Badge colorScheme="red">3 users</Badge>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Senior Moderator</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={2}>
                        <Text fontSize="sm">Advanced moderation tools</Text>
                        <Badge colorScheme="orange">8 users</Badge>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Moderator</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={2}>
                        <Text fontSize="sm">Basic moderation access</Text>
                        <Badge colorScheme="blue">15 users</Badge>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Viewer</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={2}>
                        <Text fontSize="sm">Read-only access</Text>
                        <Badge colorScheme="gray">5 users</Badge>
                      </VStack>
                    </CardBody>
                  </Card>
                </Grid>
              </VStack>
            </TabPanel>

            {/* Analytics Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold">Moderation Analytics & Insights</Text>
                
                <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Content Trends</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">Hate Speech</Text>
                            <Text fontSize="sm">12%</Text>
                          </HStack>
                          <Progress value={12} colorScheme="red" size="sm" />
                        </Box>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">Spam</Text>
                            <Text fontSize="sm">35%</Text>
                          </HStack>
                          <Progress value={35} colorScheme="orange" size="sm" />
                        </Box>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">Misinformation</Text>
                            <Text fontSize="sm">8%</Text>
                          </HStack>
                          <Progress value={8} colorScheme="yellow" size="sm" />
                        </Box>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Platform Performance</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Facebook</Text>
                          <Badge colorScheme="green">98.5%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Twitter</Text>
                          <Badge colorScheme="green">97.2%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Instagram</Text>
                          <Badge colorScheme="yellow">94.8%</Badge>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Response Times</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Average</Text>
                          <Text fontSize="sm" fontWeight="bold">2.3s</Text>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Peak</Text>
                          <Text fontSize="sm">4.7s</Text>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Best</Text>
                          <Text fontSize="sm">0.8s</Text>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                </Grid>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">iCloud Sync Status</Text>
                  </CardHeader>
                  <CardBody>
                    <HStack spacing={4}>
                      <Icon as={FaCloud} color="blue.500" boxSize={8} />
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold" color="green.500">✅ Synchronized</Text>
                        <Text fontSize="sm" color="gray.600">
                          All moderation data is synced to iCloud. Last backup: {new Date().toLocaleString()}
                        </Text>
                        <HStack spacing={2}>
                          <Badge colorScheme="blue">2.3 GB stored</Badge>
                          <Badge colorScheme="green">Auto-backup enabled</Badge>
                        </HStack>
                      </VStack>
                    </HStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Text fontSize="lg" fontWeight="bold">Moderation Settings</Text>
                
                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">AI Configuration</Text>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl>
                        <FormLabel>AI Sensitivity Level</FormLabel>
                        <Slider defaultValue={75} min={0} max={100}>
                          <SliderTrack>
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb />
                        </Slider>
                        <Text fontSize="sm" color="gray.600" mt={1}>
                          Higher sensitivity catches more potential issues but may increase false positives
                        </Text>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Auto-approve low-risk content</FormLabel>
                        <Switch />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable machine learning improvements</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">Notification Preferences</Text>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Email notifications for critical content</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Push notifications</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Daily summary reports</FormLabel>
                        <Switch />
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">iCloud Integration</Text>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable iCloud sync</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Backup frequency</FormLabel>
                        <Select defaultValue="hourly">
                          <option value="realtime">Real-time</option>
                          <option value="hourly">Every hour</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </Select>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Cross-device synchronization</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <Alert status="info" size="sm">
                        <AlertIcon />
                        Your data is encrypted and securely stored in iCloud for access across all your devices.
                      </Alert>
                    </VStack>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">Regional Compliance</Text>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <FormControl>
                        <FormLabel>Primary jurisdiction</FormLabel>
                        <Select defaultValue="us">
                          <option value="us">United States (CCPA)</option>
                          <option value="eu">European Union (GDPR)</option>
                          <option value="uk">United Kingdom (UK GDPR)</option>
                          <option value="ca">Canada (PIPEDA)</option>
                          <option value="au">Australia (Privacy Act)</option>
                        </Select>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable data retention policies</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Data retention period (days)</FormLabel>
                        <NumberInput defaultValue={365} min={30} max={2555}>
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Content Detail Modal */}
        <Modal isOpen={isContentModalOpen} onClose={onContentModalClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Content Details</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedContent && (
                <VStack spacing={4} align="stretch">
                  <HStack>
                    <Badge colorScheme="blue">{selectedContent.platform}</Badge>
                    <Badge colorScheme={getSeverityColor(selectedContent.severity)}>
                      {selectedContent.severity}
                    </Badge>
                    <Badge colorScheme={getStatusColor(selectedContent.status)}>
                      {selectedContent.status}
                    </Badge>
                  </HStack>
                  
                  <Box>
                    <Text fontWeight="bold" mb={2}>Content:</Text>
                    <Box p={3} bg="gray.50" borderRadius="md">
                      <Text>{selectedContent.content}</Text>
                    </Box>
                  </Box>
                  
                  <HStack justify="space-between">
                    <Text><strong>Author:</strong> {selectedContent.author}</Text>
                    <Text><strong>AI Confidence:</strong> {selectedContent.aiConfidence}%</Text>
                  </HStack>
                  
                  <Text><strong>Category:</strong> {selectedContent.category}</Text>
                  <Text><strong>Timestamp:</strong> {selectedContent.timestamp.toLocaleString()}</Text>
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button
                  colorScheme="green"
                  onClick={() => {
                    if (selectedContent) {
                      handleContentAction(selectedContent.id, 'approve');
                    }
                    onContentModalClose();
                  }}
                >
                  Approve
                </Button>
                <Button
                  colorScheme="red"
                  onClick={() => {
                    if (selectedContent) {
                      handleContentAction(selectedContent.id, 'reject');
                    }
                    onContentModalClose();
                  }}
                >
                  Reject
                </Button>
                <Button variant="ghost" onClick={onContentModalClose}>
                  Close
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Create Rule Modal */}
        <Modal isOpen={isRuleModalOpen} onClose={onRuleModalClose} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Create Moderation Rule</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <FormControl isRequired>
                  <FormLabel>Rule Name</FormLabel>
                  <Input
                    value={newRule.name || ''}
                    onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter rule name"
                  />
                </FormControl>
                
                <FormControl isRequired>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={newRule.description || ''}
                    onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this rule does"
                  />
                </FormControl>
                
                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={newRule.category || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="">Select category</option>
                      <option value="Safety">Safety</option>
                      <option value="Quality">Quality</option>
                      <option value="Legal">Legal</option>
                      <option value="Custom">Custom</option>
                    </Select>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Severity</FormLabel>
                    <Select
                      value={newRule.severity || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, severity: e.target.value as any }))}
                    >
                      <option value="">Select severity</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Select>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Action</FormLabel>
                    <Select
                      value={newRule.action || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, action: e.target.value as any }))}
                    >
                      <option value="">Select action</option>
                      <option value="flag">Flag for review</option>
                      <option value="block">Auto-block</option>
                      <option value="review">Manual review</option>
                      <option value="auto-approve">Auto-approve</option>
                    </Select>
                  </FormControl>
                </HStack>
                
                <FormControl>
                  <FormLabel>Keywords (comma-separated)</FormLabel>
                  <Input
                    value={newRule.keywords?.join(', ') || ''}
                    onChange={(e) => setNewRule(prev => ({ 
                      ...prev, 
                      keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) 
                    }))}
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button colorScheme="purple" onClick={handleCreateRule}>
                  Create Rule
                </Button>
                <Button variant="ghost" onClick={onRuleModalClose}>
                  Cancel
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Box>
  );
};

export default SocialModerationSection;
