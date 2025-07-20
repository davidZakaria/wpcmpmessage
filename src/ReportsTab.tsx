import { useEffect, useState } from 'react';
import {
  Box, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, Table, Thead, Tbody, Tr, Th, Td, Text, Button, HStack, Alert, AlertIcon, Spinner, Badge, VStack, Stat, StatLabel, StatNumber, StatGroup, useInterval, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon, Collapse, Icon, useColorMode, useColorModeValue, Input, InputGroup, InputLeftElement, Flex } from '@chakra-ui/react';
import React from 'react'; // Added for React.useMemo
import { FaExclamationCircle } from 'react-icons/fa';
import { MoonIcon, SunIcon, SearchIcon } from '@chakra-ui/icons';

type StatusHistory = {
  status: string;
  timestamp: string;
  error?: string | null;
};
type DeliveryStatus = {
  message_id: string;
  recipient: string;
  history: StatusHistory[];
};

type Message = { 
  id: number, 
  from_number: string, 
  text: string, 
  timestamp: string, 
  media_url?: string, 
  media_type?: string 
};

type Summary = {
  status: string;
  count: number;
};

type ReportData = {
  deliveryStatus: DeliveryStatus[];
  incomingMessages: Message[];
  summary: Summary[];
  totalMessages: number;
  totalIncoming: number;
};

export default function ReportsTab() {
  const [reportData, setReportData] = useState<ReportData>({
    deliveryStatus: [],
    incomingMessages: [],
    summary: [],
    totalMessages: 0,
    totalIncoming: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState('');
  const { colorMode, toggleColorMode } = useColorMode();
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const summaryBg = useColorModeValue('gray.50', 'gray.900');

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching reports from: http://localhost:3001/reports');
      const response = await fetch('http://localhost:3001/reports');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Reports data received:', data);
      
      setReportData(data);
      
      console.log('Statuses set:', data.deliveryStatus?.length || 0);
      console.log('Messages set:', data.incomingMessages?.length || 0);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds when enabled
  useInterval(
    () => {
      if (autoRefresh) {
        fetchReports();
      }
    },
    autoRefresh ? 10000 : null
  );

  useEffect(() => {
    fetchReports();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent': return 'blue';
      case 'delivered': return 'green';
      case 'read': return 'purple';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent': return '📤 Sent';
      case 'delivered': return '✅ Delivered';
      case 'read': return '👁️ Seen';
      case 'failed': return '❌ Failed';
      default: return status;
    }
  };

  // Filter: Only show the latest status per message_id, sorted by timestamp descending, limit to 100
  const latestStatuses = React.useMemo(() => {
    return reportData.deliveryStatus.map(ds => {
      const history = Array.isArray(ds.history) ? ds.history : [];
      const last = history[history.length - 1];
      return {
        ...ds,
        latestStatus: last?.status || '',
        latestTimestamp: last?.timestamp || '',
        latestError: last?.error || null,
        history, // always an array
      };
    });
  }, [reportData.deliveryStatus]);

  // Compute summary from latest status in each message's history
  const summaryFromLatest = React.useMemo(() => {
    const summaryMap: Record<string, number> = {};
    latestStatuses.forEach(s => {
      summaryMap[s.latestStatus] = (summaryMap[s.latestStatus] || 0) + 1;
    });
    return summaryMap;
  }, [latestStatuses]);

  // Filtered statuses by search
  const filteredStatuses = React.useMemo(() => {
    if (!search.trim()) return latestStatuses;
    const q = search.trim().toLowerCase();
    return latestStatuses.filter(s =>
      s.recipient.toLowerCase().includes(q) ||
      s.message_id.toLowerCase().includes(q) ||
      s.latestStatus.toLowerCase().includes(q)
    );
  }, [latestStatuses, search]);

  // Helper to parse timestamps (handles Unix seconds, numeric strings, or ISO strings)
  function parseTimestamp(ts: string | number): string {
    if (typeof ts === 'number') return new Date(ts * 1000).toLocaleString();
    if (!isNaN(Number(ts)) && ts.length <= 12) return new Date(Number(ts) * 1000).toLocaleString();
    return new Date(ts).toLocaleString();
  }

  return (
    <Box mt={8}>
      {/* Sticky summary and dark mode toggle */}
      <Flex position="sticky" top={0} zIndex={10} bg={summaryBg} p={4} borderRadius="md" align="center" justify="space-between" mb={6} boxShadow="md">
        <StatGroup>
          {Object.entries(summaryFromLatest).map(([status, count]) => (
            <Stat key={status} mr={4}>
              <StatLabel>{getStatusText(status)}</StatLabel>
              <StatNumber>
                <Badge colorScheme={getStatusColor(status)} fontSize="lg">
                  {count}
                </Badge>
              </StatNumber>
            </Stat>
          ))}
          <Stat mr={4}>
            <StatLabel>📨 Total Messages</StatLabel>
            <StatNumber>
              <Badge colorScheme="blue" fontSize="lg">
                {latestStatuses.length}
              </Badge>
            </StatNumber>
          </Stat>
          <Stat>
            <StatLabel>📥 Incoming Messages</StatLabel>
            <StatNumber>
              <Badge colorScheme="orange" fontSize="lg">
                {reportData.incomingMessages.length}
              </Badge>
            </StatNumber>
          </Stat>
        </StatGroup>
        <HStack>
          <InputGroup size="sm" w="250px">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search recipient, status, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              bg={useColorModeValue('white', 'gray.700')}
            />
          </InputGroup>
          <Button 
            onClick={fetchReports} 
            size="sm" 
            colorScheme="blue" 
            isLoading={loading}
            leftIcon={<Icon as={() => <span>🔄</span>} />}
          >
            Refresh
          </Button>
          <Button onClick={toggleColorMode} size="sm" leftIcon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}>{colorMode === 'light' ? 'Dark' : 'Light'} Mode</Button>
        </HStack>
      </Flex>
      {/* Error alert */}
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}
      {/* Delivery Status Cards */}
      <Tabs variant="enclosed">
        <TabList>
          <Tab>📤 Delivery Status ({filteredStatuses.length})</Tab>
          <Tab>📥 Incoming Messages ({reportData.incomingMessages.length})</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <VStack align="stretch" spacing={4}>
              {filteredStatuses.length === 0 ? (
                <Box textAlign="center" py={8} color="gray.500">
                  <Text>No delivery status data available</Text>
                  <Text fontSize="sm" color="gray.400">
                    Send some messages to see delivery status updates here
                  </Text>
                </Box>
              ) : (
                filteredStatuses.map(s => (
                  <Box key={s.message_id} bg={cardBg} borderWidth="1px" borderColor={cardBorder} borderRadius="md" p={4} boxShadow="sm">
                    <HStack justify="space-between" align="flex-start">
                      <VStack align="flex-start" spacing={1}>
                        <Text fontWeight="bold" fontSize="lg">{s.recipient}</Text>
                        <HStack>
                          <Badge colorScheme={getStatusColor(s.latestStatus)}>{getStatusText(s.latestStatus)}</Badge>
                          <Text fontSize="sm" color="gray.500">{parseTimestamp(s.latestTimestamp)}</Text>
                        </HStack>
                        <Text fontSize="xs" fontFamily="mono" color="gray.400">{s.message_id}</Text>
                      </VStack>
                      <Box>
                        {s.latestError && (
                          <HStack color="red.500" spacing={1}><Icon as={FaExclamationCircle} /><Text fontSize="xs">Error</Text></HStack>
                        )}
                      </Box>
                    </HStack>
                    {/* Timeline */}
                    <Accordion allowToggle mt={3}>
                      <AccordionItem border="none">
                        <AccordionButton px={0} _expanded={{ bg: useColorModeValue('gray.100', 'gray.700') }}>
                          <Box flex="1" textAlign="left" fontWeight="semibold">Show Status Timeline</Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel px={0} pb={2}>
                          <VStack align="stretch" spacing={2}>
                            {s.history.map((h, idx) => (
                              <HStack key={idx} align="flex-start" spacing={3}>
                                <Badge colorScheme={getStatusColor(h.status)}>{getStatusText(h.status)}</Badge>
                                <Text fontSize="sm" color="gray.500">{parseTimestamp(h.timestamp)}</Text>
                                {h.error && (
                                  <HStack color="red.500" spacing={1}><Icon as={FaExclamationCircle} /><Text fontSize="xs">{h.error}</Text></HStack>
                                )}
                              </HStack>
                            ))}
                          </VStack>
                        </AccordionPanel>
                      </AccordionItem>
                    </Accordion>
                  </Box>
                ))
              )}
            </VStack>
          </TabPanel>
          <TabPanel>
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>From</Th>
                  <Th>Message</Th>
                  <Th>Received</Th>
                  <Th>Type</Th>
                </Tr>
              </Thead>
              <Tbody>
                {reportData.incomingMessages.length === 0 ? (
                  <Tr>
                    <Td colSpan={4} textAlign="center" py={8}>
                      <VStack>
                        <Text color="gray.500">No incoming messages data available</Text>
                        <Text fontSize="sm" color="gray.400">
                          Incoming messages will appear here when received
                        </Text>
                      </VStack>
                    </Td>
                  </Tr>
                ) : (
                  reportData.incomingMessages.map(m => (
                    <Tr key={m.id}>
                      <Td>
                        <Text fontWeight="medium">{m.from_number}</Text>
                      </Td>
                      <Td>
                        <Text noOfLines={2}>
                          {m.text || `[${m.media_type || 'unknown'} message]`}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm">
                          {parseTimestamp(m.timestamp)}
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={m.media_type ? "purple" : "blue"}>
                          {m.media_type || "text"}
                        </Badge>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
} 