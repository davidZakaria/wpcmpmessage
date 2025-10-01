import React from 'react';
import {
  Box,
  HStack,
  Text,
  Icon,
  Badge,
  Tooltip,
  Button,
  useColorModeValue
} from '@chakra-ui/react';
import { FaCircle, FaPlay, FaPause, FaSync } from 'react-icons/fa';

interface LiveIndicatorProps {
  isLive: boolean;
  lastUpdated: Date | null;
  isLoading?: boolean;
  onToggleLive?: () => void;
  onRefresh?: () => void;
  updateInterval?: number;
  onIntervalChange?: (interval: number) => void;
}

export const LiveIndicator: React.FC<LiveIndicatorProps> = ({
  isLive,
  lastUpdated,
  isLoading = false,
  onToggleLive,
  onRefresh,
  updateInterval = 30000,
  onIntervalChange
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getIntervalText = (interval: number) => {
    if (interval < 60000) return `${interval / 1000}s`;
    return `${interval / 60000}m`;
  };

  return (
    <Box
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="md"
      p={3}
      mb={4}
    >
      <HStack justify="space-between" align="center">
        <HStack spacing={3}>
          {/* Live Status Indicator */}
          <HStack spacing={2}>
            <Icon
              as={FaCircle}
              color={isLive ? 'green.500' : 'gray.400'}
              boxSize={3}
              className={isLive ? 'pulse' : ''}
            />
            <Text fontSize="sm" fontWeight="medium">
              {isLive ? 'Live' : 'Paused'}
            </Text>
            {isLoading && (
              <Icon
                as={FaSync}
                color="blue.500"
                boxSize={3}
                className="spin"
              />
            )}
          </HStack>

          {/* Last Updated */}
          <Text fontSize="sm" color="gray.600">
            Updated: {formatLastUpdated(lastUpdated)}
          </Text>

          {/* Update Interval */}
          {isLive && (
            <Badge colorScheme="blue" variant="subtle">
              Every {getIntervalText(updateInterval)}
            </Badge>
          )}
        </HStack>

        {/* Controls */}
        <HStack spacing={2}>
          {/* Interval Selector */}
          {onIntervalChange && (
            <Tooltip label="Update frequency">
              <select
                value={updateInterval}
                onChange={(e) => onIntervalChange(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px'
                }}
              >
                <option value={15000}>15s</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
                <option value={120000}>2m</option>
                <option value={300000}>5m</option>
              </select>
            </Tooltip>
          )}

          {/* Manual Refresh */}
          {onRefresh && (
            <Tooltip label="Refresh now">
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                isLoading={isLoading}
                leftIcon={<FaSync />}
              >
                Refresh
              </Button>
            </Tooltip>
          )}

          {/* Live Toggle */}
          {onToggleLive && (
            <Tooltip label={isLive ? 'Pause live updates' : 'Resume live updates'}>
              <Button
                size="sm"
                colorScheme={isLive ? 'red' : 'green'}
                variant="outline"
                onClick={onToggleLive}
                leftIcon={isLive ? <FaPause /> : <FaPlay />}
              >
                {isLive ? 'Pause' : 'Resume'}
              </Button>
            </Tooltip>
          )}
        </HStack>
      </HStack>

      {/* CSS for animations - moved to global styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .pulse {
            animation: pulse 2s infinite;
          }
          
          .spin {
            animation: spin 1s linear infinite;
          }
          
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `
      }} />
    </Box>
  );
};
