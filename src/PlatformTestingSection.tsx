import React, { useState, useEffect } from 'react';
import { platformAuth } from './services/platformAuth';
import axios from 'axios';
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
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  Grid,
  GridItem,
  Icon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Code,
  Divider,
  List,
  ListItem,
  ListIcon,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Textarea,
  FormControl,
  FormLabel,
  Input,
  Switch,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import {
  FaFacebook,
  FaTwitter,
  FaInstagram,
  FaYoutube,
  FaLinkedin,
  FaWhatsapp,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaExclamationTriangle,
  FaPlay,
  FaStop,
  FaSync,
  FaCog,
  FaEye,
  FaCode,
  FaClipboard,
} from 'react-icons/fa';

interface TestResult {
  platform: string;
  status: 'success' | 'error' | 'warning' | 'pending' | 'testing';
  message: string;
  details?: any;
  timestamp: Date;
}

interface PlatformConfig {
  id: string;
  name: string;
  icon: any;
  color: string;
  status: 'connected' | 'disconnected' | 'pending' | 'testing';
  hasCredentials: boolean;
  testResults: TestResult[];
  lastTested?: Date;
}

const PlatformTestingSection: React.FC = () => {
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformConfig | null>(null);
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  
  const { isOpen: isLogModalOpen, onOpen: onLogModalOpen, onClose: onLogModalClose } = useDisclosure();
  const { isOpen: isWhatsappModalOpen, onOpen: onWhatsappModalOpen, onClose: onWhatsappModalClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    initializePlatforms();
    loadWhatsAppCredentials();
  }, []);

  const initializePlatforms = () => {
    const platformConfigs: PlatformConfig[] = [
      {
        id: 'whatsapp',
        name: 'WhatsApp Business',
        icon: FaWhatsapp,
        color: 'green',
        status: 'disconnected',
        hasCredentials: false,
        testResults: [],
      },
      {
        id: 'facebook',
        name: 'Facebook/Meta',
        icon: FaFacebook,
        color: 'blue',
        status: 'pending',
        hasCredentials: !!import.meta.env.VITE_FACEBOOK_CLIENT_ID,
        testResults: [],
      },
      {
        id: 'instagram',
        name: 'Instagram',
        icon: FaInstagram,
        color: 'pink',
        status: 'disconnected',
        hasCredentials: !!import.meta.env.VITE_INSTAGRAM_CLIENT_ID,
        testResults: [],
      },
      {
        id: 'twitter',
        name: 'Twitter/X',
        icon: FaTwitter,
        color: 'blue',
        status: 'disconnected',
        hasCredentials: !!import.meta.env.VITE_TWITTER_CLIENT_ID,
        testResults: [],
      },
      {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: FaLinkedin,
        color: 'blue',
        status: 'disconnected',
        hasCredentials: !!import.meta.env.VITE_LINKEDIN_CLIENT_ID,
        testResults: [],
      },
      {
        id: 'youtube',
        name: 'YouTube',
        icon: FaYoutube,
        color: 'red',
        status: 'disconnected',
        hasCredentials: !!import.meta.env.VITE_YOUTUBE_CLIENT_ID,
        testResults: [],
      },
    ];

    // Check which platforms are already connected
    platformConfigs.forEach(platform => {
      if (platform.id !== 'whatsapp') {
        const isConnected = platformAuth.isConnected(platform.id);
        platform.status = isConnected ? 'connected' : 'disconnected';
      }
    });

    setPlatforms(platformConfigs);
  };

  const loadWhatsAppCredentials = () => {
    const savedToken = localStorage.getItem('whatsapp_access_token');
    const savedPhoneId = localStorage.getItem('whatsapp_phone_number_id');
    
    if (savedToken) setWhatsappToken(savedToken);
    if (savedPhoneId) setWhatsappPhoneId(savedPhoneId);

    // Update WhatsApp platform status
    setPlatforms(prev => prev.map(p => 
      p.id === 'whatsapp' 
        ? { ...p, hasCredentials: !!(savedToken && savedPhoneId), status: !!(savedToken && savedPhoneId) ? 'connected' : 'disconnected' }
        : p
    ));
  };

  const addTestLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const updatePlatformStatus = (platformId: string, status: PlatformConfig['status'], result?: TestResult) => {
    setPlatforms(prev => prev.map(p => {
      if (p.id === platformId) {
        const updated = { ...p, status, lastTested: new Date() };
        if (result) {
          updated.testResults = [result, ...p.testResults.slice(0, 4)]; // Keep last 5 results
        }
        return updated;
      }
      return p;
    }));
  };

  const testWhatsAppConnection = async () => {
    if (!whatsappToken || !whatsappPhoneId) {
      const result: TestResult = {
        platform: 'whatsapp',
        status: 'error',
        message: 'Missing WhatsApp credentials. Please configure access token and phone number ID.',
        timestamp: new Date(),
      };
      updatePlatformStatus('whatsapp', 'disconnected', result);
      addTestLog('WhatsApp test failed: Missing credentials');
      return;
    }

    updatePlatformStatus('whatsapp', 'testing');
    addTestLog('Testing WhatsApp Business API connection...');

    try {
      // Test 1: Basic token validation
      addTestLog('Step 1: Validating access token...');
      const meResponse = await axios.get('https://graph.facebook.com/v22.0/me', {
        params: { access_token: whatsappToken }
      });

      // Test 2: Phone number validation
      addTestLog('Step 2: Validating phone number ID...');
      const phoneResponse = await axios.get(`https://graph.facebook.com/v22.0/${whatsappPhoneId}`, {
        params: { access_token: whatsappToken }
      });

      // Test 3: Check permissions
      addTestLog('Step 3: Checking WhatsApp Business permissions...');
      const permissionsResponse = await axios.get('https://graph.facebook.com/v22.0/me/permissions', {
        params: { access_token: whatsappToken }
      });

      const hasWhatsAppPermission = permissionsResponse.data.data.some((perm: any) => 
        perm.permission === 'whatsapp_business_messaging' && perm.status === 'granted'
      );

      // Test 4: Try to get business profile
      addTestLog('Step 4: Fetching business profile...');
      const profileResponse = await axios.get(`https://graph.facebook.com/v22.0/${whatsappPhoneId}`, {
        params: { 
          access_token: whatsappToken,
          fields: 'verified_name,display_phone_number,quality_rating'
        }
      });

      const result: TestResult = {
        platform: 'whatsapp',
        status: 'success',
        message: `WhatsApp Business API connection successful. Phone: ${profileResponse.data.display_phone_number}`,
        details: {
          verified_name: profileResponse.data.verified_name,
          display_phone_number: profileResponse.data.display_phone_number,
          quality_rating: profileResponse.data.quality_rating,
          hasWhatsAppPermission,
          permissions: permissionsResponse.data.data
        },
        timestamp: new Date(),
      };

      updatePlatformStatus('whatsapp', 'connected', result);
      addTestLog('✅ WhatsApp Business API test completed successfully');

      toast({
        title: 'WhatsApp Test Successful',
        description: `Connected to ${profileResponse.data.verified_name || 'WhatsApp Business'}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

    } catch (error: any) {
      const result: TestResult = {
        platform: 'whatsapp',
        status: 'error',
        message: `WhatsApp test failed: ${error.response?.data?.error?.message || error.message}`,
        details: error.response?.data,
        timestamp: new Date(),
      };

      updatePlatformStatus('whatsapp', 'disconnected', result);
      addTestLog(`❌ WhatsApp test failed: ${error.response?.data?.error?.message || error.message}`);

      toast({
        title: 'WhatsApp Test Failed',
        description: error.response?.data?.error?.message || error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const testSocialPlatformConnection = async (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;

    updatePlatformStatus(platformId, 'testing');
    addTestLog(`Testing ${platform.name} connection...`);

    try {
      // Check if credentials exist
      if (!platform.hasCredentials) {
        const result: TestResult = {
          platform: platformId,
          status: 'warning',
          message: `${platform.name} credentials not configured. Please add API keys to .env file.`,
          timestamp: new Date(),
        };
        updatePlatformStatus(platformId, 'disconnected', result);
        addTestLog(`⚠️ ${platform.name}: Missing credentials`);
        return;
      }

      // Check if already connected via OAuth
      const isConnected = platformAuth.isConnected(platformId);
      if (isConnected) {
        addTestLog(`${platform.name}: Found existing connection, testing API...`);
        const isWorking = await platformAuth.testConnection(platformId);
        
        const result: TestResult = {
          platform: platformId,
          status: isWorking ? 'success' : 'error',
          message: isWorking 
            ? `${platform.name} connection is working properly`
            : `${platform.name} connection has issues - may need re-authentication`,
          timestamp: new Date(),
        };

        updatePlatformStatus(platformId, isWorking ? 'connected' : 'disconnected', result);
        addTestLog(isWorking ? `✅ ${platform.name}: Connection verified` : `❌ ${platform.name}: Connection failed`);
      } else {
        // Special handling for Meta/Facebook pending permissions
        if (platformId === 'facebook') {
          const result: TestResult = {
            platform: platformId,
            status: 'pending',
            message: 'Facebook/Meta: Waiting for platform permissions approval. OAuth flow ready when approved.',
            details: {
              hasClientId: !!import.meta.env.VITE_FACEBOOK_CLIENT_ID,
              hasClientSecret: !!import.meta.env.VITE_FACEBOOK_CLIENT_SECRET,
              redirectUri: `${window.location.origin}/auth/facebook/callback`
            },
            timestamp: new Date(),
          };
          updatePlatformStatus(platformId, 'pending', result);
          addTestLog(`⏳ Facebook/Meta: Credentials configured, waiting for permissions approval`);
        } else {
          const result: TestResult = {
            platform: platformId,
            status: 'warning',
            message: `${platform.name} credentials configured but not connected. Click "Connect" to authenticate.`,
            timestamp: new Date(),
          };
          updatePlatformStatus(platformId, 'disconnected', result);
          addTestLog(`⚠️ ${platform.name}: Ready for OAuth connection`);
        }
      }

    } catch (error: any) {
      const result: TestResult = {
        platform: platformId,
        status: 'error',
        message: `${platform.name} test failed: ${error.message}`,
        details: error,
        timestamp: new Date(),
      };

      updatePlatformStatus(platformId, 'disconnected', result);
      addTestLog(`❌ ${platform.name} test failed: ${error.message}`);
    }
  };

  const testAllPlatforms = async () => {
    setIsTestingAll(true);
    setTestLogs([]);
    addTestLog('🚀 Starting comprehensive platform testing...');

    // Test WhatsApp first
    await testWhatsAppConnection();
    
    // Test social platforms
    const socialPlatforms = platforms.filter(p => p.id !== 'whatsapp');
    for (const platform of socialPlatforms) {
      await testSocialPlatformConnection(platform.id);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    addTestLog('✅ Platform testing completed');
    setIsTestingAll(false);

    toast({
      title: 'Platform Testing Complete',
      description: 'All platforms have been tested. Check results below.',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  const connectPlatform = async (platformId: string) => {
    if (platformId === 'whatsapp') {
      onWhatsappModalOpen();
      return;
    }

    const platform = platforms.find(p => p.id === platformId);
    if (!platform?.hasCredentials) {
      toast({
        title: 'Missing Credentials',
        description: `Please configure ${platform?.name} API credentials in your .env file first.`,
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    if (platformId === 'facebook') {
      toast({
        title: 'Facebook/Meta Permissions Pending',
        description: 'Waiting for Meta to approve your platform permissions. You\'ll be able to connect once approved.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      updatePlatformStatus(platformId, 'testing');
      
      const authUrl = await platformAuth.generateAuthUrl(platformId);
      const popup = window.open(authUrl, 'oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for OAuth callback messages
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'oauth_callback' && event.data.platform === platformId) {
          console.log('Platform Testing - OAuth callback received:', event.data);
          window.removeEventListener('message', handleMessage);
          
          try {
            const credentials = await platformAuth.handleCallback(
              platformId, 
              event.data.code, 
              event.data.state
            );
            
            console.log('Platform Testing - OAuth credentials received:', credentials);
            updatePlatformStatus(platformId, 'connected');
            
            toast({
              title: 'Platform Connected',
              description: `Successfully connected to ${platform?.name}`,
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
            
          } catch (error: any) {
            console.error('Platform Testing - OAuth callback error:', error);
            updatePlatformStatus(platformId, 'disconnected');
            toast({
              title: 'OAuth Error',
              description: `Failed to complete OAuth flow: ${error.message}`,
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
          }
        }
      };

      window.addEventListener('message', handleMessage);

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          
          setTimeout(() => {
            if (platformAuth.isConnected(platformId)) {
              updatePlatformStatus(platformId, 'connected');
              toast({
                title: 'Platform Connected',
                description: `Successfully connected to ${platform?.name}`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              });
            } else {
              updatePlatformStatus(platformId, 'disconnected');
              console.log('Platform Testing - OAuth popup closed without successful connection');
            }
          }, 1000);
        }
      }, 1000);

    } catch (error: any) {
      updatePlatformStatus(platformId, 'disconnected');
      toast({
        title: 'Connection Failed',
        description: `Failed to connect to ${platform?.name}: ${error.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const saveWhatsAppCredentials = () => {
    localStorage.setItem('whatsapp_access_token', whatsappToken);
    localStorage.setItem('whatsapp_phone_number_id', whatsappPhoneId);
    loadWhatsAppCredentials();
    onWhatsappModalClose();
    
    toast({
      title: 'Credentials Saved',
      description: 'WhatsApp credentials have been saved. You can now test the connection.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const getStatusIcon = (status: PlatformConfig['status']) => {
    switch (status) {
      case 'connected': return <Icon as={FaCheckCircle} color="green.500" />;
      case 'disconnected': return <Icon as={FaTimesCircle} color="red.500" />;
      case 'pending': return <Icon as={FaClock} color="yellow.500" />;
      case 'testing': return <Icon as={FaSync} color="blue.500" className="spin" />;
      default: return <Icon as={FaExclamationTriangle} color="gray.500" />;
    }
  };

  const getStatusColor = (status: PlatformConfig['status']) => {
    switch (status) {
      case 'connected': return 'green';
      case 'disconnected': return 'red';
      case 'pending': return 'yellow';
      case 'testing': return 'blue';
      default: return 'gray';
    }
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(testLogs.join('\n'));
    toast({
      title: 'Logs Copied',
      description: 'Test logs have been copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading size="lg" color="blue.600">
              🔧 Platform Connection Testing
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Test and validate connections to all integrated platforms
            </Text>
          </VStack>
          
          <HStack spacing={3}>
            <Button
              leftIcon={<Icon as={FaPlay} />}
              colorScheme="blue"
              onClick={testAllPlatforms}
              isLoading={isTestingAll}
              loadingText="Testing..."
            >
              Test All Platforms
            </Button>
            <Button
              leftIcon={<Icon as={FaEye} />}
              variant="outline"
              onClick={onLogModalOpen}
            >
              View Logs
            </Button>
          </HStack>
        </HStack>

        {/* Environment Check */}
        <Alert status="info">
          <AlertIcon />
          <Box>
            <AlertTitle>Environment Status</AlertTitle>
            <AlertDescription>
              <HStack spacing={4} mt={2}>
                <Badge colorScheme={import.meta.env.VITE_FACEBOOK_CLIENT_ID ? 'green' : 'red'}>
                  Facebook: {import.meta.env.VITE_FACEBOOK_CLIENT_ID ? 'Configured' : 'Missing'}
                </Badge>
                <Badge colorScheme={import.meta.env.VITE_TWITTER_CLIENT_ID ? 'green' : 'red'}>
                  Twitter: {import.meta.env.VITE_TWITTER_CLIENT_ID ? 'Configured' : 'Missing'}
                </Badge>
                <Badge colorScheme={import.meta.env.VITE_INSTAGRAM_CLIENT_ID ? 'green' : 'red'}>
                  Instagram: {import.meta.env.VITE_INSTAGRAM_CLIENT_ID ? 'Configured' : 'Missing'}
                </Badge>
                <Badge colorScheme={import.meta.env.VITE_LINKEDIN_CLIENT_ID ? 'green' : 'red'}>
                  LinkedIn: {import.meta.env.VITE_LINKEDIN_CLIENT_ID ? 'Configured' : 'Missing'}
                </Badge>
              </HStack>
            </AlertDescription>
          </Box>
        </Alert>

        {/* Platform Status Overview */}
        <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
          {platforms.map((platform) => (
            <Card key={platform.id}>
              <CardHeader>
                <HStack justify="space-between">
                  <HStack>
                    <Icon as={platform.icon} color={`${platform.color}.500`} boxSize={6} />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="bold">{platform.name}</Text>
                      <HStack>
                        {getStatusIcon(platform.status)}
                        <Badge colorScheme={getStatusColor(platform.status)}>
                          {platform.status.charAt(0).toUpperCase() + platform.status.slice(1)}
                        </Badge>
                      </HStack>
                    </VStack>
                  </HStack>
                  <VStack spacing={1}>
                    <Badge size="sm" colorScheme={platform.hasCredentials ? 'green' : 'red'}>
                      {platform.hasCredentials ? 'Configured' : 'No Credentials'}
                    </Badge>
                    {platform.lastTested && (
                      <Text fontSize="xs" color="gray.500">
                        Tested: {platform.lastTested.toLocaleTimeString()}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  {/* Latest test result */}
                  {platform.testResults[0] && (
                    <Box p={3} bg="gray.50" borderRadius="md">
                      <HStack>
                        <Icon 
                          as={platform.testResults[0].status === 'success' ? FaCheckCircle : 
                              platform.testResults[0].status === 'error' ? FaTimesCircle :
                              platform.testResults[0].status === 'warning' ? FaExclamationTriangle : FaClock}
                          color={platform.testResults[0].status === 'success' ? 'green.500' :
                                 platform.testResults[0].status === 'error' ? 'red.500' :
                                 platform.testResults[0].status === 'warning' ? 'yellow.500' : 'blue.500'}
                        />
                        <Text fontSize="sm">{platform.testResults[0].message}</Text>
                      </HStack>
                    </Box>
                  )}

                  {/* Action buttons */}
                  <HStack spacing={2}>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="outline"
                      onClick={() => platform.id === 'whatsapp' ? testWhatsAppConnection() : testSocialPlatformConnection(platform.id)}
                      isLoading={platform.status === 'testing'}
                      loadingText="Testing..."
                      flex={1}
                    >
                      Test Connection
                    </Button>
                    {platform.status !== 'connected' && (
                      <Button
                        size="sm"
                        colorScheme="green"
                        onClick={() => connectPlatform(platform.id)}
                        isDisabled={!platform.hasCredentials && platform.id !== 'whatsapp'}
                        flex={1}
                      >
                        {platform.id === 'whatsapp' ? 'Configure' : 
                         platform.id === 'facebook' ? 'Pending Approval' : 'Connect'}
                      </Button>
                    )}
                  </HStack>

                  {/* Test history */}
                  {platform.testResults.length > 1 && (
                    <Accordion allowToggle size="sm">
                      <AccordionItem>
                        <AccordionButton>
                          <Box flex="1" textAlign="left">
                            <Text fontSize="sm">Test History ({platform.testResults.length})</Text>
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel pb={4}>
                          <VStack spacing={2} align="stretch">
                            {platform.testResults.slice(1).map((result, index) => (
                              <Box key={index} p={2} bg="gray.50" borderRadius="sm">
                                <HStack>
                                  <Icon 
                                    as={result.status === 'success' ? FaCheckCircle : 
                                        result.status === 'error' ? FaTimesCircle :
                                        result.status === 'warning' ? FaExclamationTriangle : FaClock}
                                    color={result.status === 'success' ? 'green.500' :
                                           result.status === 'error' ? 'red.500' :
                                           result.status === 'warning' ? 'yellow.500' : 'blue.500'}
                                    boxSize={3}
                                  />
                                  <Text fontSize="xs">{result.message}</Text>
                                </HStack>
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                  {result.timestamp.toLocaleString()}
                                </Text>
                              </Box>
                            ))}
                          </VStack>
                        </AccordionPanel>
                      </AccordionItem>
                    </Accordion>
                  )}
                </VStack>
              </CardBody>
            </Card>
          ))}
        </Grid>

        {/* Special Meta/Facebook Status */}
        <Alert status="warning">
          <AlertIcon />
          <Box>
            <AlertTitle>Meta/Facebook Platform Status</AlertTitle>
            <AlertDescription>
              <VStack align="start" spacing={2} mt={2}>
                <Text>
                  ⏳ <strong>Status:</strong> Waiting for Meta to approve your platform permissions
                </Text>
                <Text fontSize="sm">
                  While you wait, you can:
                </Text>
                <List spacing={1} fontSize="sm" ml={4}>
                  <ListItem>✅ Test other platform connections</ListItem>
                  <ListItem>✅ Configure WhatsApp Business API (if you have access token)</ListItem>
                  <ListItem>✅ Set up environment variables for other platforms</ListItem>
                  <ListItem>✅ Test the overall system functionality</ListItem>
                </List>
                <Text fontSize="sm" color="blue.600" mt={2}>
                  💡 Once Meta approves your permissions, you'll be able to connect Facebook and Instagram through the OAuth flow.
                </Text>
              </VStack>
            </AlertDescription>
          </Box>
        </Alert>
      </VStack>

      {/* Test Logs Modal */}
      <Modal isOpen={isLogModalOpen} onClose={onLogModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Text>Test Logs</Text>
              <Button size="sm" leftIcon={<Icon as={FaClipboard} />} onClick={copyLogs}>
                Copy
              </Button>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Textarea
              value={testLogs.join('\n')}
              readOnly
              h="400px"
              fontFamily="monospace"
              fontSize="sm"
              placeholder="No test logs yet. Run some tests to see logs here."
            />
          </ModalBody>
          <ModalFooter>
            <Button onClick={onLogModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* WhatsApp Configuration Modal */}
      <Modal isOpen={isWhatsappModalOpen} onClose={onWhatsappModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Configure WhatsApp Business API</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Alert status="info" size="sm">
                <AlertIcon />
                <Text fontSize="sm">
                  Enter your WhatsApp Business API credentials. These will be saved locally.
                </Text>
              </Alert>
              
              <FormControl>
                <FormLabel>Access Token</FormLabel>
                <Input
                  type="password"
                  value={whatsappToken}
                  onChange={(e) => setWhatsappToken(e.target.value)}
                  placeholder="Enter your WhatsApp Business access token"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Phone Number ID</FormLabel>
                <Input
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                  placeholder="Enter your WhatsApp Business phone number ID"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button colorScheme="blue" onClick={saveWhatsAppCredentials}>
                Save & Test
              </Button>
              <Button variant="ghost" onClick={onWhatsappModalClose}>
                Cancel
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default PlatformTestingSection;
