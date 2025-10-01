// Real-time Analytics Dashboard Component
// Shows live statistics and updates

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../services/websocketService';
import {
  Box,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  Badge,
  Progress,
  VStack,
  HStack,
  Icon,
  Flex,
  Spacer,
  useColorModeValue
} from '@chakra-ui/react';
import {
  FaEye,
  FaShieldAlt,
  FaExclamationTriangle,
  FaCheck,
  FaClock,
  FaChartLine,
  FaUsers,
  FaGlobe,
  FaRobot,
  FaWifi,
  FaExclamationCircle
} from 'react-icons/fa';

interface DashboardStats {
  totalContent: number;
  flaggedContent: number;
  approvedContent: number;
  pendingContent: number;
  avgToxicity: number;
  avgBrandSafety: number;
  platformActivity: Record<string, number>;
  recentActivity: Array<{
    id: string;
    action: string;
    platform: string;
    timestamp: Date;
    severity: string;
  }>;
  aiPerformance: {
    accuracy: number;
    processingSpeed: number;
    confidence: number;
  };
}

interface RealTimeDashboardProps {
  stats: DashboardStats;
  onRefresh?: () => void;
}

const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({ 
  stats: initialStats, 
  onRefresh 
}) => {
  const { connectionStatus, lastMessage, subscribe } = useWebSocket();
  const [stats, setStats] = useState(initialStats);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const isConnected = connectionStatus === 'connected';

  // Subscribe to real-time updates when component mounts
  useEffect(() => {
    if (isConnected) {
      subscribe(['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']);
    }
  }, [isConnected, subscribe]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'analytics_update') {
      const data = lastMessage.data;
      
      // Update stats with real-time data
      if (data.totalContent !== undefined) {
        setStats(prevStats => ({
          ...prevStats,
          totalContent: data.totalContent || prevStats.totalContent,
          flaggedContent: data.flaggedContent || prevStats.flaggedContent,
          avgBrandSafety: (data.brandSafety || prevStats.avgBrandSafety * 100) / 100,
          aiPerformance: {
            ...prevStats.aiPerformance,
            accuracy: (data.aiAccuracy || prevStats.aiPerformance.accuracy * 100) / 100
          },
          platformActivity: data.platformActivity || prevStats.platformActivity,
          recentActivity: data.recentActions ? data.recentActions.map((action: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            action: action.action,
            platform: action.platform,
            timestamp: new Date(action.time),
            severity: 'medium'
          })) : prevStats.recentActivity
        }));
        setLastUpdate(new Date());
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    setLastUpdate(new Date());
  }, [stats]);

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'green';
    if (value >= thresholds.warning) return 'yellow';
    return 'red';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <Box w="full" p={6}>
      {/* Header */}
      <Flex mb={6} align="center">
        <VStack align="start" spacing={1}>
          <Heading size="lg" color="blue.600">
            Real-time Dashboard
          </Heading>
          <HStack spacing={2}>
            <Icon 
              as={isConnected ? FaWifi : FaExclamationCircle} 
              color={isConnected ? 'green.500' : 'red.500'} 
            />
            <Text fontSize="sm" color="gray.500">
              {isConnected ? 'Connected' : 'Disconnected'} • Last update: {lastUpdate.toLocaleTimeString()}
            </Text>
          </HStack>
        </VStack>
        <Spacer />
        {onRefresh && (
          <Badge 
            colorScheme={isConnected ? 'green' : 'red'} 
            variant="subtle"
            px={3}
            py={1}
          >
            {isConnected ? 'Live' : 'Offline'}
          </Badge>
        )}
      </Flex>

      {/* Main Stats Grid */}
      <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={6} mb={6}>
        {/* Total Content */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>
                <HStack>
                  <Icon as={FaEye} color="blue.500" />
                  <Text>Total Content</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl">{formatNumber(stats.totalContent)}</StatNumber>
              <StatHelpText>
                <StatArrow type="increase" />
                Live monitoring
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        {/* Flagged Content */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>
                <HStack>
                  <Icon as={FaExclamationTriangle} color="orange.500" />
                  <Text>Flagged Content</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl" color="orange.500">
                {formatNumber(stats.flaggedContent)}
              </StatNumber>
              <StatHelpText>
                {stats.totalContent > 0 && (
                  <Text>
                    {((stats.flaggedContent / stats.totalContent) * 100).toFixed(1)}% of total
                  </Text>
                )}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        {/* AI Performance */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>
                <HStack>
                  <Icon as={FaRobot} color="purple.500" />
                  <Text>AI Accuracy</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl" color="purple.500">
                {(stats.aiPerformance.accuracy * 100).toFixed(1)}%
              </StatNumber>
              <StatHelpText>
                <Badge colorScheme={getStatusColor(stats.aiPerformance.accuracy, { good: 0.9, warning: 0.8 })}>
                  {stats.aiPerformance.accuracy >= 0.9 ? 'Excellent' : 
                   stats.aiPerformance.accuracy >= 0.8 ? 'Good' : 'Needs Attention'}
                </Badge>
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        {/* Brand Safety */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>
                <HStack>
                  <Icon as={FaShieldAlt} color="green.500" />
                  <Text>Brand Safety</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl" color="green.500">
                {(stats.avgBrandSafety * 100).toFixed(1)}%
              </StatNumber>
              <StatHelpText>
                <Progress 
                  value={stats.avgBrandSafety * 100} 
                  colorScheme={getStatusColor(stats.avgBrandSafety, { good: 0.8, warning: 0.6 })}
                  size="sm"
                  mt={2}
                />
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </Grid>

      {/* Detailed Analytics */}
      <Grid templateColumns="repeat(auto-fit, minmax(400px, 1fr))" gap={6}>
        {/* Platform Activity */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardHeader>
            <Heading size="md">
              <HStack>
                <Icon as={FaGlobe} color="blue.500" />
                <Text>Platform Activity</Text>
              </HStack>
            </Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              {Object.entries(stats.platformActivity).map(([platform, count]) => (
                <Box key={platform}>
                  <Flex justify="space-between" mb={2}>
                    <Text fontWeight="medium" textTransform="capitalize">
                      {platform}
                    </Text>
                    <Text color="gray.500">{formatNumber(count)}</Text>
                  </Flex>
                  <Progress 
                    value={stats.totalContent > 0 ? (count / stats.totalContent) * 100 : 0}
                    colorScheme="blue"
                    size="sm"
                  />
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Recent Activity */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardHeader>
            <Heading size="md">
              <HStack>
                <Icon as={FaClock} color="orange.500" />
                <Text>Recent Activity</Text>
              </HStack>
            </Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={3} align="stretch" maxH="300px" overflowY="auto">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity) => (
                  <Box key={activity.id} p={3} borderRadius="md" bg="gray.50" _dark={{ bg: 'gray.700' }}>
                    <Flex justify="space-between" align="center">
                      <VStack align="start" spacing={1}>
                        <HStack>
                          <Badge 
                            colorScheme={
                              activity.action === 'flagged' ? 'red' :
                              activity.action === 'approved' ? 'green' : 'blue'
                            }
                            size="sm"
                          >
                            {activity.action}
                          </Badge>
                          <Text fontSize="sm" fontWeight="medium">
                            {activity.platform}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          {activity.timestamp.toLocaleTimeString()}
                        </Text>
                      </VStack>
                      <Badge 
                        colorScheme={
                          activity.severity === 'critical' ? 'red' :
                          activity.severity === 'high' ? 'orange' :
                          activity.severity === 'medium' ? 'yellow' : 'green'
                        }
                        variant="outline"
                      >
                        {activity.severity}
                      </Badge>
                    </Flex>
                  </Box>
                ))
              ) : (
                <Text color="gray.500" textAlign="center" py={4}>
                  No recent activity
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* AI Performance Metrics */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardHeader>
            <Heading size="md">
              <HStack>
                <Icon as={FaChartLine} color="purple.500" />
                <Text>AI Performance</Text>
              </HStack>
            </Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <Flex justify="space-between" mb={2}>
                  <Text>Processing Speed</Text>
                  <Text color="gray.500">{stats.aiPerformance.processingSpeed}ms avg</Text>
                </Flex>
                <Progress 
                  value={Math.min((1000 - stats.aiPerformance.processingSpeed) / 10, 100)}
                  colorScheme="green"
                  size="sm"
                />
              </Box>
              
              <Box>
                <Flex justify="space-between" mb={2}>
                  <Text>Confidence Score</Text>
                  <Text color="gray.500">{(stats.aiPerformance.confidence * 100).toFixed(1)}%</Text>
                </Flex>
                <Progress 
                  value={stats.aiPerformance.confidence * 100}
                  colorScheme="blue"
                  size="sm"
                />
              </Box>

              <Box>
                <Flex justify="space-between" mb={2}>
                  <Text>Toxicity Detection</Text>
                  <Text color="gray.500">{(stats.avgToxicity * 100).toFixed(1)}% avg</Text>
                </Flex>
                <Progress 
                  value={stats.avgToxicity * 100}
                  colorScheme="red"
                  size="sm"
                />
              </Box>
            </VStack>
          </CardBody>
        </Card>

        {/* Status Overview */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardHeader>
            <Heading size="md">
              <HStack>
                <Icon as={FaUsers} color="teal.500" />
                <Text>Content Status</Text>
              </HStack>
            </Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <Stat>
                <StatLabel>Approved</StatLabel>
                <StatNumber color="green.500" fontSize="lg">
                  {formatNumber(stats.approvedContent)}
                </StatNumber>
                <StatHelpText>
                  {stats.totalContent > 0 && (
                    <Text fontSize="xs">
                      {((stats.approvedContent / stats.totalContent) * 100).toFixed(1)}%
                    </Text>
                  )}
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Pending</StatLabel>
                <StatNumber color="blue.500" fontSize="lg">
                  {formatNumber(stats.pendingContent)}
                </StatNumber>
                <StatHelpText>
                  {stats.totalContent > 0 && (
                    <Text fontSize="xs">
                      {((stats.pendingContent / stats.totalContent) * 100).toFixed(1)}%
                    </Text>
                  )}
                </StatHelpText>
              </Stat>
            </Grid>
          </CardBody>
        </Card>
      </Grid>
    </Box>
  );
};

export default RealTimeDashboard;
