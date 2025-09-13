import React from 'react';
import {
  Box,
  VStack,
  Text,
  Icon,
  useColorModeValue,
  Button,
  Divider,
  Flex,
  Badge,
  HStack
} from '@chakra-ui/react';
import { FaChartBar, FaComments, FaBullhorn, FaShieldAlt, FaCog, FaPlay, FaTwitter, FaUsers, FaRocket } from 'react-icons/fa';
import { ChatIcon } from '@chakra-ui/icons';

interface SidebarProps {
  activeHub: string;
  activeSection: string;
  onHubChange: (hub: string) => void;
  onSectionChange: (section: string) => void;
  unreadCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ activeHub, activeSection, onHubChange, onSectionChange, unreadCount = 0 }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const hubs = [
    {
      id: 'whatsapp',
      label: 'WhatsApp Hub',
      icon: ChatIcon,
      description: 'Message Management',
      color: 'green'
    },
    {
      id: 'social',
      label: 'Social Media Hub',
      icon: FaUsers,
      description: 'Platform Connections',
      color: 'blue'
    }
  ];

  const whatsappSections = [
    {
      id: 'chat',
      label: 'Chat Center',
      icon: FaComments,
      description: 'WhatsApp Messages',
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: FaBullhorn,
      description: 'Message Broadcasting'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: FaChartBar,
      description: 'Reports & Statistics'
    }
  ];

  const socialSections = [
    {
      id: 'moderation',
      label: 'Social Moderation',
      icon: FaShieldAlt,
      description: 'AI Content Moderation'
    },
    {
      id: 'platform-testing',
      label: 'Platform Testing',
      icon: FaCog,
      description: 'Test Platform Connections'
    },
    {
      id: 'twitter-youtube-setup',
      label: 'Twitter & YouTube',
      icon: FaTwitter,
      description: 'Connect Twitter & YouTube'
    },
    {
      id: 'demo-mode',
      label: 'Demo Mode',
      icon: FaPlay,
      description: 'Interactive Demo & Simulation'
    }
  ];

  return (
    <Box
      w="280px"
      h="100vh"
      bg={bgColor}
      borderRight="1px"
      borderColor={borderColor}
      p={4}
      position="fixed"
      left={0}
      top={0}
      overflowY="auto"
      zIndex={1000}
    >
      <VStack spacing={6} align="stretch">
        {/* Logo/Header */}
        <Box textAlign="center" py={4}>
          <HStack justify="center" spacing={2}>
            <Icon as={FaRocket} color="purple.500" boxSize={6} />
            <Text fontSize="xl" fontWeight="bold" color="purple.500">
              Communication Hub
            </Text>
          </HStack>
          <Text fontSize="sm" color="gray.500" mt={1}>
            WhatsApp & Social Media
          </Text>
        </Box>

        <Divider />

        {/* Hub Selection */}
        <VStack spacing={2} align="stretch">
          <Text fontSize="sm" color="gray.500" fontWeight="semibold" mb={2}>
            SELECT HUB
          </Text>
          
          {hubs.map((hub) => (
            <Button
              key={hub.id}
              onClick={() => onHubChange(hub.id)}
              variant="ghost"
              justifyContent="flex-start"
              height="auto"
              py={3}
              px={3}
              bg={activeHub === hub.id ? activeBg : 'transparent'}
              _hover={{
                bg: activeHub === hub.id ? activeBg : hoverBg,
              }}
              borderRadius="md"
              border={activeHub === hub.id ? '2px solid' : '1px solid transparent'}
              borderColor={activeHub === hub.id ? `${hub.color}.300` : 'transparent'}
            >
              <HStack spacing={3}>
                <Icon as={hub.icon} boxSize={5} color={`${hub.color}.500`} />
                <Box textAlign="left">
                  <Text fontSize="sm" fontWeight="bold" color={`${hub.color}.600`}>
                    {hub.label}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {hub.description}
                  </Text>
                </Box>
              </HStack>
            </Button>
          ))}
        </VStack>

        <Divider />

        {/* Sections for Active Hub */}
        <VStack spacing={2} align="stretch">
          <Text fontSize="sm" color="gray.500" fontWeight="semibold" mb={2}>
            {activeHub === 'whatsapp' ? 'WHATSAPP FEATURES' : 'SOCIAL MEDIA FEATURES'}
          </Text>
          
          {(activeHub === 'whatsapp' ? whatsappSections : socialSections).map((item) => (
            <Button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              variant="ghost"
              justifyContent="flex-start"
              height="auto"
              py={3}
              px={3}
              bg={activeSection === item.id ? activeBg : 'transparent'}
              _hover={{
                bg: activeSection === item.id ? activeBg : hoverBg,
              }}
              borderRadius="md"
            >
              <Flex align="center" justify="space-between" w="full">
                <HStack spacing={3}>
                  <Icon as={item.icon} boxSize={4} />
                  <Box textAlign="left">
                    <Text fontSize="sm" fontWeight="medium">
                      {item.label}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {item.description}
                    </Text>
                  </Box>
                </HStack>
                
                {'badge' in item && item.badge && (
                  <Badge colorScheme="red" borderRadius="full" px={2}>
                    {item.badge}
                  </Badge>
                )}
              </Flex>
            </Button>
          ))}
        </VStack>

        <Divider />

        {/* Quick Stats */}
        <Box>
          <Text fontSize="sm" color="gray.500" fontWeight="semibold" mb={2}>
            QUICK STATS
          </Text>
          <VStack spacing={2} align="stretch">
            <Box p={3} bg={hoverBg} borderRadius="md">
              <Text fontSize="xs" color="gray.500">Today's Messages</Text>
              <Text fontSize="lg" fontWeight="bold" color="green.500">-</Text>
            </Box>
            <Box p={3} bg={hoverBg} borderRadius="md">
              <Text fontSize="xs" color="gray.500">Active Chats</Text>
              <Text fontSize="lg" fontWeight="bold" color="blue.500">-</Text>
            </Box>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default Sidebar; 