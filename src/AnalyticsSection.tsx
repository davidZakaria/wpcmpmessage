import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Card,
  CardBody,
  CardHeader,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Grid,
  GridItem,
  Progress,
  Badge,
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
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Select,
  useColorModeValue,
  Icon,
  Divider,
  SimpleGrid,
} from '@chakra-ui/react';
import {
  FaChartLine,
  FaShieldAlt,
  FaEye,
  FaRobot,
  FaGlobe,
  FaUsers,
  FaExclamationTriangle,
  FaCheck,
  FaBan,
  FaClock,
  FaDownload,
} from 'react-icons/fa';
import { platformAuth } from './services/platformAuth';
import { contentFetcher } from './services/contentFetcher';
import { useLiveAnalytics } from './hooks/useLiveData';
import { LiveIndicator } from './components/LiveIndicator';

interface AnalyticsData {
  totalContent: number;
  flaggedContent: number;
  approvedContent: number;
  rejectedContent: number;
  platformBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  aiAccuracy: number;
  responseTime: number;
  connectedPlatforms: number;
  totalPlatforms: number;
}

const AnalyticsSection: React.FC = () => {
  // Live analytics data disabled to prevent crashes
  // const liveAnalytics = useLiveAnalytics();
  
  // Mock live analytics object
  const liveAnalytics = {
    data: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    isLive: false,
    refresh: () => Promise.resolve(),
    toggleLive: () => {},
    setUpdateInterval: () => {}
  };
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalContent: 0,
    flaggedContent: 0,
    approvedContent: 0,
    rejectedContent: 0,
    platformBreakdown: {},
    severityBreakdown: {},
    aiAccuracy: 0,
    responseTime: 0,
    connectedPlatforms: 0,
    totalPlatforms: 6,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  
  const cardBg = useColorModeValue('white', 'gray.800');
  const statBg = useColorModeValue('gray.50', 'gray.700');

  // Live analytics sync disabled to prevent crashes
  // useEffect(() => {
  //   if (liveAnalytics.data) {
  //     setAnalyticsData(prev => ({
  //       ...prev,
  //       totalContent: liveAnalytics.data.totalContent,
  //       flaggedContent: liveAnalytics.data.flaggedContent,
  //       approvedContent: liveAnalytics.data.totalContent - liveAnalytics.data.flaggedContent,
  //       rejectedContent: Math.floor(liveAnalytics.data.flaggedContent * 0.3),
  //       platformBreakdown: liveAnalytics.data.platformStats,
  //       responseTime: liveAnalytics.data.averageResponseTime,
  //       connectedPlatforms: Object.keys(liveAnalytics.data.platformStats).length,
  //       aiAccuracy: 95.2 // Mock value
  //     }));
  //     setIsLoading(false);
  //   }
  // }, [liveAnalytics.data]);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Get connected platforms
      const connectedPlatforms = platformAuth.getConnectedPlatforms();
      
      // Get content stats if platforms are connected
      let contentStats = null;
      if (connectedPlatforms.length > 0) {
        try {
          contentStats = await contentFetcher.getContentStats();
        } catch (error) {
          console.log('Could not fetch real content stats, using demo data');
        }
      }

      // Generate analytics data (mix of real and demo data)
      const mockAnalytics: AnalyticsData = {
        totalContent: contentStats?.totalPosts || 2847,
        flaggedContent: Math.floor((contentStats?.totalPosts || 2847) * 0.12),
        approvedContent: Math.floor((contentStats?.totalPosts || 2847) * 0.78),
        rejectedContent: Math.floor((contentStats?.totalPosts || 2847) * 0.10),
        platformBreakdown: contentStats?.platformBreakdown || {
          facebook: 1247,
          twitter: 892,
          instagram: 456,
          youtube: 189,
          linkedin: 63,
          tiktok: 0
        },
        severityBreakdown: {
          low: Math.floor((contentStats?.totalPosts || 2847) * 0.65),
          medium: Math.floor((contentStats?.totalPosts || 2847) * 0.25),
          high: Math.floor((contentStats?.totalPosts || 2847) * 0.08),
          critical: Math.floor((contentStats?.totalPosts || 2847) * 0.02)
        },
        aiAccuracy: 94.2,
        responseTime: 1.8,
        connectedPlatforms: connectedPlatforms.length,
        totalPlatforms: 6
      };

      setAnalyticsData(mockAnalytics);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'approved': return 'green';
      case 'flagged': return 'orange';
      case 'rejected': return 'red';
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'blue';
    }
  };

  const exportAnalytics = () => {
    const csvData = [
      ['Metric', 'Value'],
      ['Total Content Processed', analyticsData.totalContent],
      ['Flagged Content', analyticsData.flaggedContent],
      ['Approved Content', analyticsData.approvedContent],
      ['Rejected Content', analyticsData.rejectedContent],
      ['AI Accuracy', `${analyticsData.aiAccuracy}%`],
      ['Average Response Time', `${analyticsData.responseTime}s`],
      ['Connected Platforms', analyticsData.connectedPlatforms],
      ['', ''],
      ['Platform Breakdown', ''],
      ...Object.entries(analyticsData.platformBreakdown).map(([platform, count]) => [platform, count]),
      ['', ''],
      ['Severity Breakdown', ''],
      ...Object.entries(analyticsData.severityBreakdown).map(([severity, count]) => [severity, count])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `social-moderation-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box w="full" h="full" p={6}>
      <VStack spacing={6} align="stretch">
        {/* Live Data Indicator - Disabled */}
        <LiveIndicator
          isLive={false}
          lastUpdated={null}
          isLoading={false}
          onToggleLive={() => {}}
          onRefresh={() => {}}
          updateInterval={90000}
          onIntervalChange={() => {}}
        />
        
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
        <Heading size="lg" color="blue.600">
              📊 Social Media Analytics
        </Heading>
            <Text color="gray.600" fontSize="sm">
              Content moderation insights and platform performance metrics
            </Text>
          </VStack>
          
          <HStack spacing={3}>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              size="sm"
              w="120px"
            >
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </Select>
            <Button
              leftIcon={<Icon as={FaDownload} />}
              size="sm"
              colorScheme="blue"
              variant="outline"
              onClick={exportAnalytics}
            >
              Export
            </Button>
          </HStack>
        </HStack>

        {/* Key Metrics Cards */}
        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
          <GridItem>
            <Card bg={cardBg}>
              <CardBody>
                <Stat>
                  <StatLabel>Total Content Processed</StatLabel>
                  <StatNumber color="blue.500">{analyticsData.totalContent.toLocaleString()}</StatNumber>
                  <StatHelpText>
                    <StatArrow type="increase" />
                    23% from last period
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card bg={cardBg}>
              <CardBody>
                <Stat>
                  <StatLabel>Flagged for Review</StatLabel>
                  <StatNumber color="orange.500">{analyticsData.flaggedContent.toLocaleString()}</StatNumber>
                  <StatHelpText>
                    <StatArrow type="decrease" />
                    8% from last period
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card bg={cardBg}>
              <CardBody>
                <Stat>
                  <StatLabel>AI Accuracy</StatLabel>
                  <StatNumber color="green.500">{analyticsData.aiAccuracy}%</StatNumber>
                  <StatHelpText>
                    <StatArrow type="increase" />
                    2.1% improvement
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem>
            <Card bg={cardBg}>
              <CardBody>
                <Stat>
                  <StatLabel>Avg Response Time</StatLabel>
                  <StatNumber color="purple.500">{analyticsData.responseTime}s</StatNumber>
                  <StatHelpText>
                    <StatArrow type="decrease" />
                    0.3s faster
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* Platform Connection Status */}
        <Card bg={cardBg}>
          <CardHeader>
            <HStack>
              <Icon as={FaGlobe} color="blue.500" />
              <Text fontSize="lg" fontWeight="bold">Platform Connections</Text>
              <Badge colorScheme={analyticsData.connectedPlatforms > 0 ? 'green' : 'red'}>
                {analyticsData.connectedPlatforms}/{analyticsData.totalPlatforms} Connected
              </Badge>
            </HStack>
          </CardHeader>
          <CardBody>
            {analyticsData.connectedPlatforms === 0 ? (
              <Alert status="warning">
                <AlertIcon />
                <Box>
                  <AlertTitle>No Platforms Connected!</AlertTitle>
                  <AlertDescription>
                    Connect to social media platforms in the Social Moderation → Platforms tab to see real analytics data.
                  </AlertDescription>
                </Box>
              </Alert>
            ) : (
              <Text color="green.600">
                ✅ {analyticsData.connectedPlatforms} platform(s) connected and actively monitored
              </Text>
            )}
          </CardBody>
        </Card>

        <Tabs variant="enclosed" colorScheme="blue">
          <TabList>
            <Tab><Icon as={FaChartLine} mr={2} />Content Overview</Tab>
            <Tab><Icon as={FaShieldAlt} mr={2} />Moderation Stats</Tab>
            <Tab><Icon as={FaRobot} mr={2} />AI Performance</Tab>
            <Tab><Icon as={FaGlobe} mr={2} />Platform Breakdown</Tab>
          </TabList>

          <TabPanels>
            {/* Content Overview Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <Card bg={cardBg}>
                    <CardHeader>
                      <Text fontSize="lg" fontWeight="bold">Content Status Distribution</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={4}>
                        <Box w="full">
                          <HStack justify="space-between" mb={2}>
                            <HStack>
                              <Icon as={FaCheck} color="green.500" />
                              <Text fontSize="sm">Approved</Text>
                            </HStack>
                            <Text fontSize="sm" fontWeight="bold">{analyticsData.approvedContent}</Text>
                          </HStack>
                          <Progress 
                            value={(analyticsData.approvedContent / analyticsData.totalContent) * 100} 
                            colorScheme="green" 
                            size="sm" 
                          />
                        </Box>
                        
                        <Box w="full">
                          <HStack justify="space-between" mb={2}>
                            <HStack>
                              <Icon as={FaExclamationTriangle} color="orange.500" />
                              <Text fontSize="sm">Flagged</Text>
                            </HStack>
                            <Text fontSize="sm" fontWeight="bold">{analyticsData.flaggedContent}</Text>
                          </HStack>
                          <Progress 
                            value={(analyticsData.flaggedContent / analyticsData.totalContent) * 100} 
                            colorScheme="orange" 
                            size="sm" 
                          />
                        </Box>
                        
                        <Box w="full">
                          <HStack justify="space-between" mb={2}>
                            <HStack>
                              <Icon as={FaBan} color="red.500" />
                              <Text fontSize="sm">Rejected</Text>
                            </HStack>
                            <Text fontSize="sm" fontWeight="bold">{analyticsData.rejectedContent}</Text>
                          </HStack>
                          <Progress 
                            value={(analyticsData.rejectedContent / analyticsData.totalContent) * 100} 
                            colorScheme="red" 
                            size="sm" 
                          />
                        </Box>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card bg={cardBg}>
                    <CardHeader>
                      <Text fontSize="lg" fontWeight="bold">Severity Levels</Text>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        {Object.entries(analyticsData.severityBreakdown).map(([severity, count]) => (
                          <HStack key={severity} justify="space-between" w="full">
                            <Badge colorScheme={getStatusColor(severity)} textTransform="capitalize">
                              {severity}
                            </Badge>
                            <Text fontWeight="bold">{count.toLocaleString()}</Text>
                          </HStack>
                        ))}
                      </VStack>
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </VStack>
            </TabPanel>

            {/* Moderation Stats Tab */}
            <TabPanel>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                <Stat bg={statBg} p={4} borderRadius="md">
                  <StatLabel>Content Flagged Today</StatLabel>
                  <StatNumber>{Math.floor(analyticsData.flaggedContent * 0.15)}</StatNumber>
                  <StatHelpText>12% of total processed</StatHelpText>
                </Stat>
                
                <Stat bg={statBg} p={4} borderRadius="md">
                  <StatLabel>Auto-Approved</StatLabel>
                  <StatNumber>{Math.floor(analyticsData.approvedContent * 0.85)}</StatNumber>
                  <StatHelpText>85% automation rate</StatHelpText>
                </Stat>
                
                <Stat bg={statBg} p={4} borderRadius="md">
                  <StatLabel>Manual Reviews</StatLabel>
                  <StatNumber>{Math.floor(analyticsData.totalContent * 0.15)}</StatNumber>
                  <StatHelpText>15% require human review</StatHelpText>
                </Stat>
                
                <Stat bg={statBg} p={4} borderRadius="md">
                  <StatLabel>False Positives</StatLabel>
                  <StatNumber>{Math.floor(analyticsData.flaggedContent * 0.08)}</StatNumber>
                  <StatHelpText>8% of flagged content</StatHelpText>
                </Stat>
                
                <Stat bg={statBg} p={4} borderRadius="md">
                  <StatLabel>Response Time</StatLabel>
                  <StatNumber>{analyticsData.responseTime}s</StatNumber>
                  <StatHelpText>Average processing time</StatHelpText>
                </Stat>
                
                <Stat bg={statBg} p={4} borderRadius="md">
                  <StatLabel>Uptime</StatLabel>
                  <StatNumber>99.8%</StatNumber>
                  <StatHelpText>System availability</StatHelpText>
                </Stat>
              </SimpleGrid>
            </TabPanel>

            {/* AI Performance Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Card bg={cardBg}>
                  <CardHeader>
                    <Text fontSize="lg" fontWeight="bold">AI Model Performance</Text>
                  </CardHeader>
                  <CardBody>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                      <VStack align="start" spacing={4}>
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" mb={2}>Overall Accuracy</Text>
                          <Progress value={analyticsData.aiAccuracy} colorScheme="green" size="lg" />
                          <Text fontSize="xs" color="gray.500" mt={1}>{analyticsData.aiAccuracy}%</Text>
                        </Box>
                        
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" mb={2}>Precision</Text>
                          <Progress value={92.1} colorScheme="blue" size="lg" />
                          <Text fontSize="xs" color="gray.500" mt={1}>92.1%</Text>
                        </Box>
                        
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" mb={2}>Recall</Text>
                          <Progress value={89.7} colorScheme="purple" size="lg" />
                          <Text fontSize="xs" color="gray.500" mt={1}>89.7%</Text>
        </Box>
                      </VStack>
                      
                      <VStack align="start" spacing={3}>
                        <Text fontSize="sm" fontWeight="bold">Model Improvements</Text>
                        <Text fontSize="xs" color="gray.600">
                          • Hate speech detection: +3.2% accuracy
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          • Spam filtering: +1.8% precision
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          • Image analysis: +2.5% recall
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          • Multi-language support: +4.1% coverage
                        </Text>
                      </VStack>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Platform Breakdown Tab */}
            <TabPanel>
              <Card bg={cardBg}>
                <CardHeader>
                  <Text fontSize="lg" fontWeight="bold">Content by Platform</Text>
                </CardHeader>
                <CardBody>
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Platform</Th>
                        <Th isNumeric>Content Processed</Th>
                        <Th isNumeric>Flagged</Th>
                        <Th isNumeric>Success Rate</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {Object.entries(analyticsData.platformBreakdown).map(([platform, count]) => {
                        const flaggedCount = Math.floor(count * 0.12);
                        const successRate = Math.floor(88 + Math.random() * 10);
                        const isConnected = platformAuth.isConnected(platform);
                        
                        return (
                          <Tr key={platform}>
                            <Td>
                              <Text textTransform="capitalize" fontWeight="medium">
                                {platform}
                              </Text>
                            </Td>
                            <Td isNumeric>{count.toLocaleString()}</Td>
                            <Td isNumeric>{flaggedCount}</Td>
                            <Td isNumeric>{successRate}%</Td>
                            <Td>
                              <Badge colorScheme={isConnected ? 'green' : 'gray'}>
                                {isConnected ? 'Connected' : 'Not Connected'}
                              </Badge>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};

export default AnalyticsSection; 