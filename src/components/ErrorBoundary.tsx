import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Code,
  useColorModeValue
} from '@chakra-ui/react';
import { FaSyncAlt, FaExclamationTriangle } from 'react-icons/fa';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  onReload: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, errorInfo, onReset, onReload }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('red.200', 'red.600');

  return (
    <Box
      p={8}
      bg={bgColor}
      border="2px solid"
      borderColor={borderColor}
      borderRadius="lg"
      maxW="600px"
      mx="auto"
      mt={8}
    >
      <VStack spacing={6} align="stretch">
        <Alert status="error" borderRadius="md">
          <AlertIcon as={FaExclamationTriangle} />
          <VStack align="start" spacing={2} flex={1}>
            <AlertTitle>Something went wrong!</AlertTitle>
            <AlertDescription>
              The application encountered an unexpected error. You can try to recover or reload the page.
            </AlertDescription>
          </VStack>
        </Alert>

        {error && (
          <Box>
            <Heading size="sm" mb={2} color="red.600">
              Error Details:
            </Heading>
            <Code
              p={3}
              borderRadius="md"
              display="block"
              whiteSpace="pre-wrap"
              fontSize="sm"
              bg="red.50"
              color="red.800"
              border="1px solid"
              borderColor="red.200"
            >
              {error.name}: {error.message}
            </Code>
          </Box>
        )}

        {errorInfo && process.env.NODE_ENV === 'development' && (
          <Box>
            <Heading size="sm" mb={2} color="orange.600">
              Component Stack:
            </Heading>
            <Code
              p={3}
              borderRadius="md"
              display="block"
              whiteSpace="pre-wrap"
              fontSize="xs"
              bg="orange.50"
              color="orange.800"
              border="1px solid"
              borderColor="orange.200"
              maxH="200px"
              overflowY="auto"
            >
              {errorInfo.componentStack}
            </Code>
          </Box>
        )}

        <VStack spacing={3}>
          <Button
            leftIcon={<FaSyncAlt />}
            colorScheme="blue"
            onClick={onReset}
            size="lg"
          >
            Try Again
          </Button>
          
          <Button
            leftIcon={<FaSyncAlt />}
            variant="outline"
            onClick={onReload}
            size="sm"
          >
            Reload Page
          </Button>
        </VStack>

        <Text fontSize="sm" color="gray.600" textAlign="center">
          If this problem persists, please check the browser console for more details.
        </Text>
      </VStack>
    </Box>
  );
};

export default ErrorBoundary;
