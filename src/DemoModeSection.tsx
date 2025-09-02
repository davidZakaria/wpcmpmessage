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
  StatArrow,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Code,
  List,
  ListItem,
  ListIcon,
  Divider,
  Switch,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
} from '@chakra-ui/react';
import {
  FaPlay,
  FaStop,
  FaPause,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaFacebook,
  FaTwitter,
  FaInstagram,
  FaWhatsapp,
  FaRobot,
  FaChartLine,
  FaUsers,
  FaShieldAlt,
  FaEye,
  FaBullhorn,
  FaComments,
} from 'react-icons/fa';

interface DemoContent {
  id: string;
  platform: string;
  content: string;
  author: string;
  timestamp: Date;
  status: 'pending' | 'approved' | 'flagged' | 'rejected';
  aiScore: number;
  category: string;
}

interface DemoStats {
  totalMessages: number;
  pendingReview: number;
  autoApproved: number;
  flaggedContent: number;
  platforms: number;
}

const DemoModeSection: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [demoContent, setDemoContent] = useState<DemoContent[]>([]);
  const [stats, setStats] = useState<DemoStats>({
    totalMessages: 0,
    pendingReview: 0,
    autoApproved: 0,
    flaggedContent: 0,
    platforms: 4
  });
  const [selectedContent, setSelectedContent] = useState<DemoContent | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  
  const { isOpen: isContentModalOpen, onOpen: onContentModalOpen, onClose: onContentModalClose } = useDisclosure();
  const toast = useToast();

  // Demo content samples
  const sampleContent: Omit<DemoContent, 'id' | 'timestamp'>[] = [
    {
      platform: 'facebook',
      content: 'Just tried the new restaurant downtown! Amazing food and great service. Highly recommend! 🍕✨',
      author: 'foodlover123',
      status: 'approved',
      aiScore: 95,
      category: 'Positive Review'
    },
    {
      platform: 'twitter',
      content: 'This product is absolutely terrible. Worst purchase ever made. Complete waste of money!!!',
      author: 'angrybuy3r',
      status: 'flagged',
      aiScore: 78,
      category: 'Negative Sentiment'
    },
    {
      platform: 'instagram',
      content: 'Beautiful sunset at the beach today 🌅 Nature is so peaceful and inspiring',
      author: 'naturelover',
      status: 'approved',
      aiScore: 98,
      category: 'Lifestyle'
    },
    {
      platform: 'facebook',
      content: 'URGENT!!! Click here for FREE money!!! Limited time offer!!! Act now!!!',
      author: 'spammer_account',
      status: 'rejected',
      aiScore: 12,
      category: 'Spam'
    },
    {
      platform: 'twitter',
      content: 'Working on some exciting new projects. Can\'t wait to share more details soon! 💼',
      author: 'tech_entrepreneur',
      status: 'approved',
      aiScore: 92,
      category: 'Business Update'
    },
    {
      platform: 'instagram',
      content: 'This content contains inappropriate language and should be reviewed carefully by moderators',
      author: 'problematic_user',
      status: 'pending',
      aiScore: 45,
      category: 'Needs Review'
    }
  ];

  const demoSteps = [
    'Initializing AI moderation system...',
    'Connecting to social media platforms...',
    'Fetching real-time content streams...',
    'Running AI content analysis...',
    'Applying moderation rules...',
    'Generating insights and reports...',
    'Demo system ready!'
  ];

  const startDemo = async () => {
    setIsRunning(true);
    setDemoContent([]);
    setCurrentStep(0);
    
    toast({
      title: 'Demo Started',
      description: 'Starting social media moderation demo simulation',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });

    // Simulate initialization steps
    for (let i = 0; i < demoSteps.length; i++) {
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Add content gradually
    for (let i = 0; i < sampleContent.length; i++) {
      const content: DemoContent = {
        ...sampleContent[i],
        id: `demo_${i}`,
        timestamp: new Date(Date.now() - (sampleContent.length - i) * 300000) // 5 min intervals
      };
      
      setDemoContent(prev => [...prev, content]);
      updateStats(i + 1);
      
      // Show toast for flagged content
      if (content.status === 'flagged' || content.status === 'rejected') {
        toast({
          title: 'Content Flagged',
          description: `${content.platform} post flagged for review: ${content.category}`,
          status: 'warning',
          duration: 2000,
          isClosable: true,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    toast({
      title: 'Demo Complete',
      description: 'Social media moderation demo simulation finished',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const updateStats = (totalCount: number) => {
    const currentContent = sampleContent.slice(0, totalCount);
    setStats({
      totalMessages: totalCount,
      pendingReview: currentContent.filter(c => c.status === 'pending').length,
      autoApproved: currentContent.filter(c => c.status === 'approved').length,
      flaggedContent: currentContent.filter(c => c.status === 'flagged' || c.status === 'rejected').length,
      platforms: 4
    });
  };

  const stopDemo = () => {
    setIsRunning(false);
    setCurrentStep(0);
    toast({
      title: 'Demo Stopped',
      description: 'Demo simulation has been stopped',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  const resetDemo = () => {
    setIsRunning(false);
    setDemoContent([]);
    setStats({
      totalMessages: 0,
      pendingReview: 0,
      autoApproved: 0,
      flaggedContent: 0,
      platforms: 4
    });
    setCurrentStep(0);
    
    toast({
      title: 'Demo Reset',
      description: 'Demo has been reset to initial state',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleContentAction = (contentId: string, action: 'approve' | 'reject') => {
    setDemoContent(prev => prev.map(item => 
      item.id === contentId 
        ? { ...item, status: action === 'approve' ? 'approved' : 'rejected' }
        : item
    ));
    
    toast({
      title: `Content ${action}d`,
      description: `Demo content has been ${action}d`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook': return FaFacebook;
      case 'twitter': return FaTwitter;
      case 'instagram': return FaInstagram;
      case 'whatsapp': return FaWhatsapp;
      default: return FaComments;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'green';
      case 'rejected': return 'red';
      case 'flagged': return 'orange';
      case 'pending': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading size="lg" color="purple.600">
              🎮 Demo Mode - Social Media Moderation
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Experience the full platform capabilities with simulated data while waiting for Meta approval
            </Text>
          </VStack>
          
          <HStack spacing={3}>
            <Button
              leftIcon={<Icon as={FaPlay} />}
              colorScheme="green"
              onClick={startDemo}
              isLoading={isRunning}
              loadingText="Running Demo..."
              isDisabled={isRunning}
            >
              Start Demo
            </Button>
            <Button
              leftIcon={<Icon as={FaStop} />}
              colorScheme="red"
              onClick={stopDemo}
              isDisabled={!isRunning}
            >
              Stop Demo
            </Button>
            <Button
              leftIcon={<Icon as={FaPause} />}
              variant="outline"
              onClick={resetDemo}
            >
              Reset
            </Button>
          </HStack>
        </HStack>

        {/* Demo Status */}
        <Alert status="info">
          <AlertIcon />
          <Box>
            <AlertTitle>Demo Mode Active</AlertTitle>
            <AlertDescription>
              This demo simulates real social media content moderation using AI. 
              All data is simulated and no real platforms are connected.
              <br />
              <Text mt={2} fontSize="sm" color="blue.600">
                💡 This shows exactly what your system will do once Meta approves your permissions!
              </Text>
            </AlertDescription>
          </Box>
        </Alert>

        {/* Progress Indicator */}
        {isRunning && (
          <Card>
            <CardBody>
              <VStack spacing={3}>
                <Text fontWeight="bold">Demo Progress</Text>
                <Progress 
                  value={(currentStep / (demoSteps.length - 1)) * 100} 
                  colorScheme="blue" 
                  size="lg" 
                  w="full" 
                />
                <Text fontSize="sm" color="gray.600">
                  {currentStep < demoSteps.length ? demoSteps[currentStep] : 'Demo Complete'}
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Stats Dashboard */}
        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Total Messages</StatLabel>
                  <StatNumber>{stats.totalMessages}</StatNumber>
                  <StatHelpText>
                    <StatArrow type="increase" />
                    Demo simulation
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Auto Approved</StatLabel>
                  <StatNumber color="green.500">{stats.autoApproved}</StatNumber>
                  <StatHelpText>AI confidence &gt; 90%</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Flagged Content</StatLabel>
                  <StatNumber color="orange.500">{stats.flaggedContent}</StatNumber>
                  <StatHelpText>Requires review</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Connected Platforms</StatLabel>
                  <StatNumber color="blue.500">{stats.platforms}</StatNumber>
                  <StatHelpText>Demo simulation</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        <Tabs variant="enclosed" colorScheme="purple">
          <TabList>
            <Tab><Icon as={FaEye} mr={2} />Live Monitor</Tab>
            <Tab><Icon as={FaRobot} mr={2} />AI Analysis</Tab>
            <Tab><Icon as={FaChartLine} mr={2} />Analytics</Tab>
            <Tab><Icon as={FaShieldAlt} mr={2} />Moderation Rules</Tab>
          </TabList>

          <TabPanels>
            {/* Live Monitor Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">Content Stream ({demoContent.length})</Text>
                  <Badge colorScheme={isRunning ? 'green' : 'gray'}>
                    {isRunning ? 'Live' : 'Stopped'}
                  </Badge>
                </HStack>

                <Card>
                  <CardBody>
                    {demoContent.length === 0 ? (
                      <VStack py={8}>
                        <Text color="gray.500">No demo content yet</Text>
                        <Text fontSize="sm" color="gray.400">
                          Click "Start Demo" to begin simulation
                        </Text>
                      </VStack>
                    ) : (
                      <Table variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Platform</Th>
                            <Th>Content</Th>
                            <Th>Author</Th>
                            <Th>Status</Th>
                            <Th>AI Score</Th>
                            <Th>Actions</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {demoContent.map((item) => (
                            <Tr key={item.id}>
                              <Td>
                                <HStack>
                                  <Icon as={getPlatformIcon(item.platform)} color="blue.500" />
                                  <Badge colorScheme="blue">{item.platform}</Badge>
                                </HStack>
                              </Td>
                              <Td maxW="300px">
                                <Text isTruncated>{item.content}</Text>
                              </Td>
                              <Td>{item.author}</Td>
                              <Td>
                                <Badge colorScheme={getStatusColor(item.status)}>
                                  {item.status}
                                </Badge>
                              </Td>
                              <Td>
                                <HStack>
                                  <Text>{item.aiScore}%</Text>
                                  <Icon 
                                    as={item.aiScore > 80 ? FaCheckCircle : 
                                        item.aiScore > 50 ? FaClock : FaExclamationTriangle}
                                    color={item.aiScore > 80 ? 'green.500' : 
                                           item.aiScore > 50 ? 'yellow.500' : 'red.500'}
                                  />
                                </HStack>
                              </Td>
                              <Td>
                                <HStack spacing={2}>
                                  <Button
                                    size="xs"
                                    colorScheme="green"
                                    onClick={() => handleContentAction(item.id, 'approve')}
                                    isDisabled={item.status === 'approved'}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="xs"
                                    colorScheme="red"
                                    onClick={() => handleContentAction(item.id, 'reject')}
                                    isDisabled={item.status === 'rejected'}
                                  >
                                    Reject
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

            {/* AI Analysis Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold">AI Moderation Analysis</Text>
                
                <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Content Categories</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Positive Reviews</Text>
                          <Badge colorScheme="green">33%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Spam Content</Text>
                          <Badge colorScheme="red">17%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Lifestyle Posts</Text>
                          <Badge colorScheme="blue">25%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Business Updates</Text>
                          <Badge colorScheme="purple">25%</Badge>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">AI Confidence Levels</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">High Confidence (&gt;80%)</Text>
                            <Text fontSize="sm">67%</Text>
                          </HStack>
                          <Progress value={67} colorScheme="green" size="sm" />
                        </Box>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">Medium Confidence (50-80%)</Text>
                            <Text fontSize="sm">17%</Text>
                          </HStack>
                          <Progress value={17} colorScheme="yellow" size="sm" />
                        </Box>
                        <Box w="full">
                          <HStack justify="space-between">
                            <Text fontSize="sm">Low Confidence (&lt;50%)</Text>
                            <Text fontSize="sm">16%</Text>
                          </HStack>
                          <Progress value={16} colorScheme="red" size="sm" />
                        </Box>
                      </VStack>
                    </CardBody>
                  </Card>
                </Grid>
              </VStack>
            </TabPanel>

            {/* Analytics Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold">Demo Analytics Dashboard</Text>
                
                <Alert status="info">
                  <AlertIcon />
                  <Text>
                    This demonstrates the analytics you'll have access to once your platforms are connected.
                    Real data will replace this simulation.
                  </Text>
                </Alert>

                <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={4}>
                  <Card>
                    <CardHeader>
                      <Text fontWeight="bold">Platform Performance</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <HStack justify="space-between" w="full">
                          <HStack>
                            <Icon as={FaFacebook} color="blue.500" />
                            <Text fontSize="sm">Facebook</Text>
                          </HStack>
                          <Badge colorScheme="green">98.5%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <HStack>
                            <Icon as={FaTwitter} color="blue.500" />
                            <Text fontSize="sm">Twitter</Text>
                          </HStack>
                          <Badge colorScheme="green">97.2%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <HStack>
                            <Icon as={FaInstagram} color="pink.500" />
                            <Text fontSize="sm">Instagram</Text>
                          </HStack>
                          <Badge colorScheme="yellow">94.8%</Badge>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <HStack>
                            <Icon as={FaWhatsapp} color="green.500" />
                            <Text fontSize="sm">WhatsApp</Text>
                          </HStack>
                          <Badge colorScheme="blue">Pending</Badge>
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
                          <Text fontSize="sm">Average Response</Text>
                          <Text fontSize="sm" fontWeight="bold">1.2s</Text>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Peak Response</Text>
                          <Text fontSize="sm">2.8s</Text>
                        </HStack>
                        <HStack justify="space-between" w="full">
                          <Text fontSize="sm">Best Response</Text>
                          <Text fontSize="sm">0.3s</Text>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                </Grid>
              </VStack>
            </TabPanel>

            {/* Moderation Rules Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold">Demo Moderation Rules</Text>
                
                <Alert status="success">
                  <AlertIcon />
                  <Text>
                    These are the AI moderation rules that will automatically process your social media content.
                    You can customize these rules once your platforms are connected.
                  </Text>
                </Alert>

                <Grid templateColumns="repeat(auto-fill, minmax(350px, 1fr))" gap={4}>
                  <Card>
                    <CardHeader>
                      <HStack justify="space-between">
                        <Text fontWeight="bold">Spam Detection</Text>
                        <Switch isChecked colorScheme="green" />
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={3}>
                        <Text fontSize="sm" color="gray.600">
                          Automatically detects and flags spam content, promotional messages, and suspicious links.
                        </Text>
                        <Badge colorScheme="orange">High Priority</Badge>
                        <Text fontSize="xs">Keywords: spam, free money, click here, urgent</Text>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <HStack justify="space-between">
                        <Text fontWeight="bold">Sentiment Analysis</Text>
                        <Switch isChecked colorScheme="green" />
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={3}>
                        <Text fontSize="sm" color="gray.600">
                          Analyzes emotional tone and flags extremely negative or toxic content for review.
                        </Text>
                        <Badge colorScheme="yellow">Medium Priority</Badge>
                        <Text fontSize="xs">AI confidence threshold: &gt; 75%</Text>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <HStack justify="space-between">
                        <Text fontWeight="bold">Content Quality</Text>
                        <Switch isChecked colorScheme="green" />
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <VStack align="start" spacing={3}>
                        <Text fontSize="sm" color="gray.600">
                          Evaluates content quality and relevance, auto-approving high-quality posts.
                        </Text>
                        <Badge colorScheme="green">Auto-Approve</Badge>
                        <Text fontSize="xs">AI confidence threshold: &gt; 90%</Text>
                      </VStack>
                    </CardBody>
                  </Card>
                </Grid>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>

      {/* Content Detail Modal */}
      <Modal isOpen={isContentModalOpen} onClose={onContentModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Content Analysis Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedContent && (
              <VStack spacing={4} align="stretch">
                <HStack>
                  <Icon as={getPlatformIcon(selectedContent.platform)} color="blue.500" boxSize={5} />
                  <Badge colorScheme="blue">{selectedContent.platform}</Badge>
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
                  <Text><strong>AI Score:</strong> {selectedContent.aiScore}%</Text>
                </HStack>
                
                <Text><strong>Category:</strong> {selectedContent.category}</Text>
                <Text><strong>Timestamp:</strong> {selectedContent.timestamp.toLocaleString()}</Text>
                
                <Divider />
                
                <Box>
                  <Text fontWeight="bold" mb={2}>AI Analysis:</Text>
                  <Code p={3} borderRadius="md" w="full">
                    {JSON.stringify({
                      confidence: selectedContent.aiScore,
                      category: selectedContent.category,
                      sentiment: selectedContent.aiScore > 70 ? 'positive' : 'neutral',
                      risk_level: selectedContent.aiScore < 50 ? 'high' : 'low'
                    }, null, 2)}
                  </Code>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onContentModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default DemoModeSection;
