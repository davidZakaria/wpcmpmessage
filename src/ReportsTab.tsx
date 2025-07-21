import { useEffect, useState } from 'react';
import {
  Box, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, Table, Thead, Tbody, Tr, Th, Td, Text, Button, HStack, Alert, AlertIcon, Spinner, Badge, VStack, Stat, StatLabel, StatNumber, StatGroup, useInterval, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon, Icon, useColorMode, useColorModeValue, Input, InputGroup, InputLeftElement, Flex, Select, Divider, SimpleGrid
} from '@chakra-ui/react';
import React from 'react';
import { FaExclamationCircle, FaBullhorn, FaDownload, FaEye } from 'react-icons/fa';
import { MoonIcon, SunIcon, SearchIcon } from '@chakra-ui/icons';

type StatusHistory = {
  status: string;
  timestamp: string;
  error?: string | null;
};

type DeliveryStatus = {
  message_id: string;
  recipient: string;
  campaign_id?: number;
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

type Campaign = {
  id: number;
  name: string;
  description?: string;
  template_name?: string;
  created_at: string;
  total_numbers: number;
  status: string;
  total_messages?: number;
  sent_count?: number;
  delivered_count?: number;
  read_count?: number;
  failed_count?: number;
};

type ReportData = {
  deliveryStatus: DeliveryStatus[];
  incomingMessages: Message[];
  summary: Summary[];
  totalMessages: number;
  totalIncoming: number;
  campaign?: Campaign;
  filtered: boolean;
};

export default function ReportsTab() {
  const [reportData, setReportData] = useState<ReportData>({
    deliveryStatus: [],
    incomingMessages: [],
    summary: [],
    totalMessages: 0,
    totalIncoming: 0,
    filtered: false
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [search, setSearch] = useState('');
  const { colorMode, toggleColorMode } = useColorMode();
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const summaryBg = useColorModeValue('gray.50', 'gray.900');

  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    console.log('🔄 Fetching campaigns from: http://localhost:3001/campaigns');
    try {
      const response = await fetch('http://localhost:3001/campaigns', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add cache busting
        cache: 'no-cache'
      });
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log('📊 Campaigns data received:', data);
      console.log('📊 Number of campaigns:', data.length);
      console.log('📊 Campaign names:', data.map(c => c.name));
      setCampaigns(data);
      console.log('✅ Campaigns state updated');
    } catch (error) {
      console.error('❌ Error fetching campaigns:', error);
      setError('Failed to load campaigns: ' + error.message);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = 'http://localhost:3001/reports';
      if (selectedCampaign !== 'all') {
        url += `?campaign_id=${selectedCampaign}`;
      }
      
      console.log('Fetching reports from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Reports data received:', data);
      
      setReportData(data);
      
      console.log('Statuses set:', data.deliveryStatus?.length || 0);
      console.log('Messages set:', data.incomingMessages?.length || 0);
      console.log('Campaign filtered:', data.filtered);
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
    fetchCampaigns();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedCampaign]);

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

  // Filter: Only show the latest status per message_id
  const latestStatuses = React.useMemo(() => {
    return reportData.deliveryStatus.map(ds => {
      const history = Array.isArray(ds.history) ? ds.history : [];
      const last = history[history.length - 1];
      return {
        ...ds,
        latestStatus: last?.status || '',
        latestTimestamp: last?.timestamp || '',
        latestError: last?.error || null,
        history,
      };
    });
  }, [reportData.deliveryStatus]);

  // Compute summary from latest status
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

  // Helper to parse timestamps
  function parseTimestamp(ts: string | number): string {
    if (typeof ts === 'number') return new Date(ts * 1000).toLocaleString();
    if (!isNaN(Number(ts)) && ts.length <= 12) return new Date(Number(ts) * 1000).toLocaleString();
    return new Date(ts).toLocaleString();
  }

  // Calculate success rate
  const successRate = React.useMemo(() => {
    const total = latestStatuses.length;
    if (total === 0) return 0;
    const delivered = summaryFromLatest['delivered'] || 0;
    const read = summaryFromLatest['read'] || 0;
    return Math.round(((delivered + read) / total) * 100);
  }, [summaryFromLatest, latestStatuses.length]);

  const exportToCsv = () => {
    const csvData = filteredStatuses.map(s => ({
      recipient: s.recipient,
      status: s.latestStatus,
      timestamp: parseTimestamp(s.latestTimestamp),
      message_id: s.message_id,
      campaign: reportData.campaign?.name || 'All Campaigns'
    }));
    
    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-report-${reportData.campaign?.name || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box mt={8}>
      {/* Campaign Selection & Controls */}
      <Box mb={6} bg={summaryBg} p={6} borderRadius="md" boxShadow="md">
        <Heading size="md" color="blue.600" mb={4}>
          <Icon as={FaBullhorn} mr={2} />
          📊 WhatsApp Campaign Reports
        </Heading>
        
        <Flex direction={{ base: 'column', md: 'row' }} gap={4} align={{ md: 'center' }} justify="space-between">
          <HStack spacing={4} flex="1">
            <Box>
              <Text fontSize="sm" fontWeight="bold" mb={1}>Select Campaign:</Text>
              <Select 
                value={selectedCampaign} 
                onChange={(e) => setSelectedCampaign(e.target.value)}
                w="250px"
                size="sm"
                isDisabled={campaignsLoading}
              >
                <option value="all">📊 All Campaigns</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>
                    🎯 {campaign.name} ({campaign.total_messages || 0} msgs)
                  </option>
                ))}
              </Select>
              {/* Debug info */}
              <Text fontSize="xs" color="gray.500" mt={1}>
                Debug: {campaigns.length} campaigns loaded
              </Text>
            </Box>
            
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
          </HStack>
          
          <HStack spacing={2}>
            <Button 
              onClick={fetchReports} 
              size="sm" 
              colorScheme="blue" 
              isLoading={loading}
              leftIcon={<Icon as={() => <span>🔄</span>} />}
            >
              Refresh Reports
            </Button>
            
            <Button 
              onClick={fetchCampaigns} 
              size="sm" 
              colorScheme="purple" 
              isLoading={campaignsLoading}
              leftIcon={<Icon as={() => <span>🎯</span>} />}
            >
              Refresh Campaigns
            </Button>
            
            <Button
              onClick={exportToCsv}
              size="sm"
              colorScheme="green"
              leftIcon={<Icon as={FaDownload} />}
              isDisabled={filteredStatuses.length === 0}
            >
              Export CSV
            </Button>
            
            <Button 
              onClick={toggleColorMode} 
              size="sm" 
              leftIcon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            >
              {colorMode === 'light' ? 'Dark' : 'Light'}
            </Button>
          </HStack>
        </Flex>
        
        {reportData.campaign && (
          <Box mt={4} p={3} bg={useColorModeValue('blue.50', 'blue.900')} borderRadius="md">
            <HStack justify="space-between">
              <VStack align="start" spacing={0}>
                <Text fontWeight="bold" color="blue.700">
                  🎯 {reportData.campaign.name}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  {reportData.campaign.description || 'No description'}
                </Text>
                {reportData.campaign.template_name && (
                  <Badge colorScheme="purple" size="sm">
                    Template: {reportData.campaign.template_name}
                  </Badge>
                )}
              </VStack>
              <VStack align="end" spacing={0}>
                <Text fontSize="sm" color="gray.500">
                  Created: {parseTimestamp(reportData.campaign.created_at)}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  Total Numbers: {reportData.campaign.total_numbers}
                </Text>
              </VStack>
            </HStack>
          </Box>
        )}
      </Box>

      {/* Summary Statistics */}
      <Box mb={6} bg={cardBg} p={6} borderRadius="md" boxShadow="md">
        <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={4}>
          {Object.entries(summaryFromLatest).map(([status, count]) => (
            <Stat key={status} textAlign="center">
              <StatLabel fontSize="sm">{getStatusText(status)}</StatLabel>
              <StatNumber>
                <Badge colorScheme={getStatusColor(status)} fontSize="lg" px={3} py={1}>
                  {count}
                </Badge>
              </StatNumber>
            </Stat>
          ))}
          <Stat textAlign="center">
            <StatLabel fontSize="sm">📨 Total Messages</StatLabel>
            <StatNumber>
              <Badge colorScheme="blue" fontSize="lg" px={3} py={1}>
                {latestStatuses.length}
              </Badge>
            </StatNumber>
          </Stat>
          <Stat textAlign="center">
            <StatLabel fontSize="sm">📈 Success Rate</StatLabel>
            <StatNumber>
              <Badge 
                colorScheme={successRate >= 80 ? "green" : successRate >= 60 ? "orange" : "red"} 
                fontSize="lg" 
                px={3} 
                py={1}
              >
                {successRate}%
              </Badge>
            </StatNumber>
          </Stat>
        </SimpleGrid>
      </Box>
      
      {/* Error alert */}
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs variant="enclosed">
        <TabList>
          <Tab>📤 Delivery Status ({filteredStatuses.length})</Tab>
          <Tab>📥 Incoming Messages ({reportData.incomingMessages.length})</Tab>
          <Tab>📈 Campaign Overview</Tab>
        </TabList>
        <TabPanels>
          {/* Delivery Status Tab */}
          <TabPanel>
            <VStack align="stretch" spacing={4}>
              {filteredStatuses.length === 0 ? (
                <Box textAlign="center" py={8} color="gray.500">
                  <Text>No delivery status data available</Text>
                  <Text fontSize="sm" color="gray.400">
                    {selectedCampaign === 'all' 
                      ? 'Send some messages to see delivery status updates here'
                      : 'No messages found for the selected campaign'
                    }
                  </Text>
                </Box>
              ) : (
                filteredStatuses.map(s => (
                  <Box key={s.message_id} bg={cardBg} borderWidth="1px" borderColor={cardBorder} borderRadius="md" p={4} boxShadow="sm">
                    <HStack justify="space-between" align="flex-start">
                      <VStack align="flex-start" spacing={1}>
                        <Text fontWeight="bold" fontSize="lg">{s.recipient}</Text>
                        <HStack>
                          <Badge colorScheme={getStatusColor(s.latestStatus)}>
                            {getStatusText(s.latestStatus)}
                          </Badge>
                          <Text fontSize="sm" color="gray.500">
                            {parseTimestamp(s.latestTimestamp)}
                          </Text>
                          {s.campaign_id && (
                            <Badge variant="outline" colorScheme="blue" fontSize="xs">
                              Campaign #{s.campaign_id}
                            </Badge>
                          )}
                        </HStack>
                        <Text fontSize="xs" fontFamily="mono" color="gray.400">
                          {s.message_id}
                        </Text>
                      </VStack>
                      <Box>
                        {s.latestError && (
                          <HStack color="red.500" spacing={1}>
                            <Icon as={FaExclamationCircle} />
                            <Text fontSize="xs">Error</Text>
                          </HStack>
                        )}
                      </Box>
                    </HStack>
                    
                    {/* Timeline */}
                    <Accordion allowToggle mt={3}>
                      <AccordionItem border="none">
                        <AccordionButton px={0} _expanded={{ bg: useColorModeValue('gray.100', 'gray.700') }}>
                          <Box flex="1" textAlign="left" fontWeight="semibold">
                            <Icon as={FaEye} mr={2} />
                            Show Status Timeline ({s.history.length} events)
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel px={0} pb={2}>
                          <VStack align="stretch" spacing={2}>
                            {s.history.map((h, idx) => (
                              <HStack key={idx} align="flex-start" spacing={3}>
                                <Badge colorScheme={getStatusColor(h.status)}>
                                  {getStatusText(h.status)}
                                </Badge>
                                <Text fontSize="sm" color="gray.500">
                                  {parseTimestamp(h.timestamp)}
                                </Text>
                                {h.error && (
                                  <HStack color="red.500" spacing={1}>
                                    <Icon as={FaExclamationCircle} />
                                    <Text fontSize="xs">{h.error}</Text>
                                  </HStack>
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

          {/* Incoming Messages Tab */}
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

          {/* Campaign Overview Tab */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              {campaigns.length === 0 ? (
                <Box textAlign="center" py={8} color="gray.500">
                  <Text>No campaigns found</Text>
                  <Text fontSize="sm" color="gray.400">
                    Start sending messages to create campaigns
                  </Text>
                </Box>
              ) : (
                <>
                  <Heading size="md" color="blue.600">📈 All Campaign Statistics</Heading>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                    {campaigns.map(campaign => (
                      <Box key={campaign.id} borderWidth="1px" bg={cardBg} borderRadius="md" p={4}>
                        <VStack align="start" spacing={2}>
                          <HStack justify="space-between" w="full">
                            <Text fontWeight="bold" color="blue.600">
                              🎯 {campaign.name}
                            </Text>
                            <Badge colorScheme="blue" size="sm">
                              #{campaign.id}
                            </Badge>
                          </HStack>
                          
                          {campaign.description && (
                            <Text fontSize="sm" color="gray.600" noOfLines={2}>
                              {campaign.description}
                            </Text>
                          )}
                          
                          <Divider />
                          
                          <SimpleGrid columns={2} spacing={2} w="full">
                            <Stat size="sm">
                              <StatLabel fontSize="xs">📤 Sent</StatLabel>
                              <StatNumber fontSize="md">
                                <Badge colorScheme="blue">{campaign.sent_count || 0}</Badge>
                              </StatNumber>
                            </Stat>
                            <Stat size="sm">
                              <StatLabel fontSize="xs">✅ Delivered</StatLabel>
                              <StatNumber fontSize="md">
                                <Badge colorScheme="green">{campaign.delivered_count || 0}</Badge>
                              </StatNumber>
                            </Stat>
                            <Stat size="sm">
                              <StatLabel fontSize="xs">👁️ Read</StatLabel>
                              <StatNumber fontSize="md">
                                <Badge colorScheme="purple">{campaign.read_count || 0}</Badge>
                              </StatNumber>
                            </Stat>
                            <Stat size="sm">
                              <StatLabel fontSize="xs">❌ Failed</StatLabel>
                              <StatNumber fontSize="md">
                                <Badge colorScheme="red">{campaign.failed_count || 0}</Badge>
                              </StatNumber>
                            </Stat>
                          </SimpleGrid>
                          
                          <Divider />
                          
                          <HStack justify="space-between" w="full" fontSize="sm">
                            <Text color="gray.500">
                              Total: {campaign.total_messages || 0}
                            </Text>
                            <Text color="gray.500">
                              {parseTimestamp(campaign.created_at)}
                            </Text>
                          </HStack>
                          
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => setSelectedCampaign(campaign.id.toString())}
                            leftIcon={<Icon as={FaEye} />}
                            w="full"
                          >
                            View Details
                          </Button>
                        </VStack>
                      </Box>
                    ))}
                  </SimpleGrid>
                </>
              )}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
} 