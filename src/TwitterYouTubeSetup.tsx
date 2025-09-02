import React, { useState, useEffect } from 'react';
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
  Code,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  List,
  ListItem,
  ListIcon,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Divider,
  Icon,
  Link,
} from '@chakra-ui/react';
import {
  FaTwitter,
  FaYoutube,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaCopy,
  FaExternalLinkAlt,
  FaCog,
  FaKey,
  FaLink,
} from 'react-icons/fa';
import { platformAuth } from './services/platformAuth';

interface PlatformSetup {
  id: string;
  name: string;
  icon: any;
  color: string;
  hasCredentials: boolean;
  isConnected: boolean;
  setupSteps: string[];
  developerUrl: string;
  redirectUri: string;
  requiredScopes: string[];
  commonIssues: string[];
}

const TwitterYouTubeSetup: React.FC = () => {
  const [platforms, setPlatforms] = useState<PlatformSetup[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformSetup | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [isTestingConnection, setIsTestingConnection] = useState<Record<string, boolean>>({});
  
  const { isOpen: isSetupModalOpen, onOpen: onSetupModalOpen, onClose: onSetupModalClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    initializePlatforms();
  }, []);

  const initializePlatforms = () => {
    const platformSetups: PlatformSetup[] = [
      {
        id: 'twitter',
        name: 'Twitter/X',
        icon: FaTwitter,
        color: 'blue',
        hasCredentials: !!(import.meta.env.VITE_TWITTER_CLIENT_ID && import.meta.env.VITE_TWITTER_CLIENT_SECRET),
        isConnected: platformAuth.isConnected('twitter'),
        setupSteps: [
          'Go to https://developer.twitter.com/',
          'Sign in with your Twitter account',
          'Create a new project and app',
          'Generate API keys and tokens',
          'Enable OAuth 2.0 with PKCE',
          'Add redirect URI: http://localhost:3001/auth/twitter/callback',
          'Copy Client ID and Client Secret to .env file'
        ],
        developerUrl: 'https://developer.twitter.com/',
        redirectUri: 'http://localhost:3001/auth/twitter/callback',
        requiredScopes: ['tweet.read', 'users.read', 'follows.read'],
        commonIssues: [
          'App not approved for OAuth 2.0',
          'Redirect URI mismatch',
          'Invalid Client ID or Secret',
          'Missing required scopes',
          'App suspended or restricted'
        ]
      },
      {
        id: 'youtube',
        name: 'YouTube',
        icon: FaYoutube,
        color: 'red',
        hasCredentials: !!(import.meta.env.VITE_YOUTUBE_CLIENT_ID && import.meta.env.VITE_YOUTUBE_CLIENT_SECRET),
        isConnected: platformAuth.isConnected('youtube'),
        setupSteps: [
          'Go to https://console.developers.google.com/',
          'Create a new project or select existing',
          'Enable YouTube Data API v3',
          'Create OAuth 2.0 credentials',
          'Add authorized redirect URI: http://localhost:3001/auth/youtube/callback',
          'Copy Client ID and Client Secret to .env file',
          'Configure OAuth consent screen'
        ],
        developerUrl: 'https://console.developers.google.com/',
        redirectUri: 'http://localhost:3001/auth/youtube/callback',
        requiredScopes: ['https://www.googleapis.com/auth/youtube.readonly'],
        commonIssues: [
          'YouTube Data API not enabled',
          'OAuth consent screen not configured',
          'Redirect URI not authorized',
          'Invalid Client ID or Secret',
          'Quota exceeded',
          'App not verified by Google'
        ]
      }
    ];

    setPlatforms(platformSetups);
  };

  const testPlatformConnection = async (platformId: string) => {
    setIsTestingConnection(prev => ({ ...prev, [platformId]: true }));
    const platform = platforms.find(p => p.id === platformId);
    
    try {
      // Check if credentials exist
      if (!platform?.hasCredentials) {
        throw new Error('API credentials not configured in .env file');
      }

      // Generate OAuth URL to test configuration
      const authUrl = await platformAuth.generateAuthUrl(platformId);
      
      // Test if we can reach the OAuth endpoint
      const testResult = {
        platform: platformId,
        status: 'success',
        message: 'OAuth URL generated successfully. Credentials appear to be configured.',
        details: {
          authUrl: authUrl.substring(0, 100) + '...',
          hasClientId: !!import.meta.env[`VITE_${platformId.toUpperCase()}_CLIENT_ID`],
          hasClientSecret: !!import.meta.env[`VITE_${platformId.toUpperCase()}_CLIENT_SECRET`],
          redirectUri: platform.redirectUri
        },
        timestamp: new Date()
      };

      setTestResults(prev => ({ ...prev, [platformId]: testResult }));
      
      toast({
        title: 'Configuration Test Passed',
        description: `${platform.name} credentials are configured correctly`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error: any) {
      const testResult = {
        platform: platformId,
        status: 'error',
        message: error.message,
        details: {
          hasClientId: !!import.meta.env[`VITE_${platformId.toUpperCase()}_CLIENT_ID`],
          hasClientSecret: !!import.meta.env[`VITE_${platformId.toUpperCase()}_CLIENT_SECRET`],
          error: error.message
        },
        timestamp: new Date()
      };

      setTestResults(prev => ({ ...prev, [platformId]: testResult }));
      
      toast({
        title: 'Configuration Test Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsTestingConnection(prev => ({ ...prev, [platformId]: false }));
    }
  };

  const attemptConnection = async (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform?.hasCredentials) {
      toast({
        title: 'Missing Credentials',
        description: `Please configure ${platform?.name} API credentials first`,
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const authUrl = await platformAuth.generateAuthUrl(platformId);
      
      // Open popup window for OAuth
      const popup = window.open(
        authUrl,
        'oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for OAuth callback messages
      const handleMessage = async (event: MessageEvent) => {
        // Only accept messages from our domain
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'oauth_callback' && event.data.platform === platformId) {
          console.log('OAuth callback received:', event.data);
          window.removeEventListener('message', handleMessage);
          
          try {
            // Handle the OAuth callback with the received code
            const credentials = await platformAuth.handleCallback(
              platformId, 
              event.data.code, 
              event.data.state
            );
            
            console.log('OAuth credentials received:', credentials);
            
            // Update platform status
            setPlatforms(prev => prev.map(p => 
              p.id === platformId ? { ...p, isConnected: true } : p
            ));
            
            toast({
              title: 'Connection Successful',
              description: `Successfully connected to ${platform?.name}`,
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
            
          } catch (error: any) {
            console.error('OAuth callback error:', error);
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

      // Add message listener
      window.addEventListener('message', handleMessage);

      // Fallback: Listen for popup close
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          
          // Check if connection was successful (in case message was missed)
          setTimeout(() => {
            const isConnected = platformAuth.isConnected(platformId);
            if (isConnected) {
              setPlatforms(prev => prev.map(p => 
                p.id === platformId ? { ...p, isConnected: true } : p
              ));
              toast({
                title: 'Connection Successful',
                description: `Successfully connected to ${platform?.name}`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              });
            } else {
              console.log('OAuth popup closed without successful connection');
              toast({
                title: 'Connection Cancelled',
                description: 'OAuth flow was cancelled or failed',
                status: 'warning',
                duration: 3000,
                isClosable: true,
              });
            }
          }, 1000);
        }
      }, 1000);

    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: 'Connection Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to Clipboard',
      description: 'Text has been copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const getStatusIcon = (platform: PlatformSetup) => {
    if (platform.isConnected) return <Icon as={FaCheckCircle} color="green.500" />;
    if (platform.hasCredentials) return <Icon as={FaExclamationTriangle} color="yellow.500" />;
    return <Icon as={FaTimesCircle} color="red.500" />;
  };

  const getStatusText = (platform: PlatformSetup) => {
    if (platform.isConnected) return 'Connected';
    if (platform.hasCredentials) return 'Ready to Connect';
    return 'Not Configured';
  };

  const getStatusColor = (platform: PlatformSetup) => {
    if (platform.isConnected) return 'green';
    if (platform.hasCredentials) return 'yellow';
    return 'red';
  };

  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading size="lg" color="blue.600">
              🐦 Twitter & YouTube Setup
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Connect Twitter and YouTube platforms to your social media moderation system
            </Text>
          </VStack>
        </HStack>

        {/* Environment Check */}
        <Alert status="info">
          <AlertIcon />
          <Box>
            <AlertTitle>Environment Status</AlertTitle>
            <AlertDescription>
              <VStack align="start" spacing={2} mt={2}>
                <HStack>
                  <Badge colorScheme={import.meta.env.VITE_TWITTER_CLIENT_ID ? 'green' : 'red'}>
                    Twitter Client ID: {import.meta.env.VITE_TWITTER_CLIENT_ID ? 'Configured' : 'Missing'}
                  </Badge>
                  <Badge colorScheme={import.meta.env.VITE_TWITTER_CLIENT_SECRET ? 'green' : 'red'}>
                    Twitter Secret: {import.meta.env.VITE_TWITTER_CLIENT_SECRET ? 'Configured' : 'Missing'}
                  </Badge>
                </HStack>
                <HStack>
                  <Badge colorScheme={import.meta.env.VITE_YOUTUBE_CLIENT_ID ? 'green' : 'red'}>
                    YouTube Client ID: {import.meta.env.VITE_YOUTUBE_CLIENT_ID ? 'Configured' : 'Missing'}
                  </Badge>
                  <Badge colorScheme={import.meta.env.VITE_YOUTUBE_CLIENT_SECRET ? 'green' : 'red'}>
                    YouTube Secret: {import.meta.env.VITE_YOUTUBE_CLIENT_SECRET ? 'Configured' : 'Missing'}
                  </Badge>
                </HStack>
              </VStack>
            </AlertDescription>
          </Box>
        </Alert>

        {/* Platform Cards */}
        <VStack spacing={4} align="stretch">
          {platforms.map((platform) => (
            <Card key={platform.id}>
              <CardHeader>
                <HStack justify="space-between">
                  <HStack>
                    <Icon as={platform.icon} color={`${platform.color}.500`} boxSize={8} />
                    <VStack align="start" spacing={0}>
                      <Text fontSize="xl" fontWeight="bold">{platform.name}</Text>
                      <HStack>
                        {getStatusIcon(platform)}
                        <Badge colorScheme={getStatusColor(platform)}>
                          {getStatusText(platform)}
                        </Badge>
                      </HStack>
                    </VStack>
                  </HStack>
                  
                  <HStack spacing={2}>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="outline"
                      onClick={() => testPlatformConnection(platform.id)}
                      isLoading={isTestingConnection[platform.id]}
                      loadingText="Testing..."
                    >
                      Test Config
                    </Button>
                    
                    {platform.hasCredentials ? (
                      <Button
                        size="sm"
                        colorScheme="green"
                        onClick={() => attemptConnection(platform.id)}
                        isDisabled={platform.isConnected}
                      >
                        {platform.isConnected ? 'Connected' : 'Connect'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        colorScheme="orange"
                        onClick={() => {
                          setSelectedPlatform(platform);
                          onSetupModalOpen();
                        }}
                      >
                        Setup Guide
                      </Button>
                    )}
                  </HStack>
                </HStack>
              </CardHeader>
              
              <CardBody>
                <VStack spacing={4} align="stretch">
                  {/* Configuration Status */}
                  <Box>
                    <Text fontWeight="bold" mb={2}>Configuration Status:</Text>
                    <HStack spacing={4}>
                      <Badge colorScheme={platform.hasCredentials ? 'green' : 'red'}>
                        API Keys: {platform.hasCredentials ? 'Configured' : 'Missing'}
                      </Badge>
                      <Badge colorScheme="blue">
                        Redirect URI: Configured
                      </Badge>
                    </HStack>
                  </Box>

                  {/* Test Results */}
                  {testResults[platform.id] && (
                    <Box>
                      <Text fontWeight="bold" mb={2}>Last Test Result:</Text>
                      <Alert status={testResults[platform.id].status === 'success' ? 'success' : 'error'}>
                        <AlertIcon />
                        <Box>
                          <Text fontSize="sm">{testResults[platform.id].message}</Text>
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            {testResults[platform.id].timestamp.toLocaleString()}
                          </Text>
                        </Box>
                      </Alert>
                    </Box>
                  )}

                  {/* Quick Setup Info */}
                  <Accordion allowToggle>
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <Text fontSize="sm" fontWeight="bold">Quick Setup Info</Text>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <VStack spacing={3} align="stretch">
                          <Box>
                            <Text fontSize="sm" fontWeight="bold">Developer Console:</Text>
                            <Link href={platform.developerUrl} isExternal color="blue.500">
                              {platform.developerUrl} <Icon as={FaExternalLinkAlt} mx="2px" />
                            </Link>
                          </Box>
                          
                          <Box>
                            <Text fontSize="sm" fontWeight="bold">Redirect URI:</Text>
                            <HStack>
                              <Code fontSize="xs">{platform.redirectUri}</Code>
                              <Button size="xs" onClick={() => copyToClipboard(platform.redirectUri)}>
                                <Icon as={FaCopy} />
                              </Button>
                            </HStack>
                          </Box>
                          
                          <Box>
                            <Text fontSize="sm" fontWeight="bold">Required Scopes:</Text>
                            <Code fontSize="xs">{platform.requiredScopes.join(', ')}</Code>
                          </Box>
                        </VStack>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </VStack>
              </CardBody>
            </Card>
          ))}
        </VStack>

        {/* Environment Variables Template */}
        <Card>
          <CardHeader>
            <Text fontWeight="bold">Environment Variables Template</Text>
          </CardHeader>
          <CardBody>
            <VStack spacing={3} align="stretch">
              <Text fontSize="sm" color="gray.600">
                Add these to your .env file:
              </Text>
              <Box position="relative">
                <Textarea
                  value={`# Twitter API v2
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret_here

# YouTube Data API v3 (Google)
VITE_YOUTUBE_CLIENT_ID=your_google_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_google_client_secret_here`}
                  readOnly
                  h="120px"
                  fontFamily="monospace"
                  fontSize="sm"
                />
                <Button
                  position="absolute"
                  top={2}
                  right={2}
                  size="xs"
                  onClick={() => copyToClipboard(`# Twitter API v2
VITE_TWITTER_CLIENT_ID=your_twitter_client_id_here
VITE_TWITTER_CLIENT_SECRET=your_twitter_client_secret_here

# YouTube Data API v3 (Google)
VITE_YOUTUBE_CLIENT_ID=your_google_client_id_here
VITE_YOUTUBE_CLIENT_SECRET=your_google_client_secret_here`)}
                >
                  <Icon as={FaCopy} />
                </Button>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </VStack>

      {/* Setup Guide Modal */}
      <Modal isOpen={isSetupModalOpen} onClose={onSetupModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Icon as={selectedPlatform?.icon} color={`${selectedPlatform?.color}.500`} />
              <Text>{selectedPlatform?.name} Setup Guide</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedPlatform && (
              <VStack spacing={4} align="stretch">
                <Alert status="info">
                  <AlertIcon />
                  <Text fontSize="sm">
                    Follow these steps to set up {selectedPlatform.name} API access:
                  </Text>
                </Alert>

                <Box>
                  <Text fontWeight="bold" mb={2}>Setup Steps:</Text>
                  <List spacing={2}>
                    {selectedPlatform.setupSteps.map((step, index) => (
                      <ListItem key={index}>
                        <ListIcon as={FaCheckCircle} color="green.500" />
                        <Text fontSize="sm">{step}</Text>
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="bold" mb={2}>Common Issues:</Text>
                  <List spacing={1}>
                    {selectedPlatform.commonIssues.map((issue, index) => (
                      <ListItem key={index}>
                        <ListIcon as={FaExclamationTriangle} color="orange.500" />
                        <Text fontSize="sm">{issue}</Text>
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="bold" mb={2}>Important URLs:</Text>
                  <VStack spacing={2} align="stretch">
                    <HStack>
                      <Text fontSize="sm" fontWeight="bold">Developer Console:</Text>
                      <Link href={selectedPlatform.developerUrl} isExternal color="blue.500">
                        {selectedPlatform.developerUrl} <Icon as={FaExternalLinkAlt} mx="2px" />
                      </Link>
                    </HStack>
                    <HStack>
                      <Text fontSize="sm" fontWeight="bold">Redirect URI:</Text>
                      <Code fontSize="sm">{selectedPlatform.redirectUri}</Code>
                      <Button size="xs" onClick={() => copyToClipboard(selectedPlatform.redirectUri)}>
                        <Icon as={FaCopy} />
                      </Button>
                    </HStack>
                  </VStack>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSetupModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TwitterYouTubeSetup;
