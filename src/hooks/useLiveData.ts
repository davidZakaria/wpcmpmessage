import { useState, useEffect, useCallback, useRef } from 'react';

interface LiveDataOptions {
  interval?: number; // Update interval in milliseconds (default: 30 seconds)
  enabled?: boolean; // Whether live updates are enabled
  onError?: (error: Error) => void;
  onUpdate?: (data: any) => void;
}

interface LiveDataState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  isLive: boolean;
}

/**
 * Custom hook for smooth live data updates without disrupting UI
 * Updates data in background and only re-renders when data actually changes
 */
export function useLiveData<T>(
  fetchFunction: () => Promise<T>,
  options: LiveDataOptions = {}
): LiveDataState<T> & {
  refresh: () => Promise<void>;
  toggleLive: () => void;
  setUpdateInterval: (interval: number) => void;
} {
  const {
    interval = 30000, // 30 seconds default
    enabled = true,
    onError,
    onUpdate
  } = options;

  const [state, setState] = useState<LiveDataState<T>>({
    data: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    isLive: enabled
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef(interval);
  const isMountedRef = useRef(true);

  // Update data function
  const updateData = useCallback(async (showLoading = false) => {
    if (!isMountedRef.current) return;

    try {
      if (showLoading) {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
      }

      const newData = await fetchFunction();
      
      if (!isMountedRef.current) return;

      setState(prev => {
        // Only update if data actually changed (deep comparison for objects)
        const hasChanged = JSON.stringify(prev.data) !== JSON.stringify(newData);
        
        if (hasChanged) {
          onUpdate?.(newData);
          return {
            ...prev,
            data: newData,
            isLoading: false,
            error: null,
            lastUpdated: new Date()
          };
        }
        
        // Data hasn't changed, just update loading state and timestamp
        return {
          ...prev,
          isLoading: false,
          error: null,
          lastUpdated: new Date()
        };
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      
      const err = error instanceof Error ? error : new Error('Unknown error');
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err
      }));
      onError?.(err);
    }
  }, [fetchFunction, onError, onUpdate]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await updateData(true);
  }, [updateData]);

  // Toggle live updates
  const toggleLive = useCallback(() => {
    setState(prev => ({ ...prev, isLive: !prev.isLive }));
  }, []);

  // Set update interval
  const setUpdateInterval = useCallback((newInterval: number) => {
    currentIntervalRef.current = newInterval;
    
    // Restart interval with new timing
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    if (state.isLive && newInterval > 0) {
      intervalRef.current = setInterval(() => updateData(false), newInterval);
    }
  }, [state.isLive, updateData]);

  // Setup and cleanup interval
  useEffect(() => {
    if (state.isLive && currentIntervalRef.current > 0) {
      // Initial load
      updateData(true);
      
      // Setup interval for background updates
      intervalRef.current = setInterval(() => updateData(false), currentIntervalRef.current);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isLive, updateData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    refresh,
    toggleLive,
    setUpdateInterval
  };
}

// Specialized hook for social media content
export function useLiveSocialContent() {
  return useLiveData(
    async () => {
      try {
        // Import contentFetcher dynamically to avoid circular dependencies
        const { contentFetcher } = await import('../services/contentFetcher');
        return await contentFetcher.fetchAllContent();
      } catch (error) {
        // Return empty array on error to prevent crashes
        console.warn('⚠️ Social content fetch failed, returning empty array:', error);
        return [];
      }
    },
    {
      interval: 120000, // 2 minutes for social content (reduced to prevent spam)
      onUpdate: (data) => {
        console.log('📱 Social content updated:', data.length, 'items');
      },
      onError: (error) => {
        console.warn('⚠️ Failed to update social content:', error.message);
      }
    }
  );
}

// Specialized hook for analytics data
export function useLiveAnalytics() {
  return useLiveData(
    async () => {
      // Mock analytics data - replace with real API call
      return {
        totalContent: Math.floor(Math.random() * 1000) + 500,
        flaggedContent: Math.floor(Math.random() * 50) + 10,
        moderatedToday: Math.floor(Math.random() * 100) + 20,
        averageResponseTime: Math.floor(Math.random() * 300) + 100,
        platformStats: {
          facebook: Math.floor(Math.random() * 200) + 100,
          instagram: Math.floor(Math.random() * 150) + 75,
          twitter: Math.floor(Math.random() * 300) + 150,
          linkedin: Math.floor(Math.random() * 100) + 50,
          youtube: Math.floor(Math.random() * 80) + 40
        }
      };
    },
    {
      interval: 90000, // 90 seconds for analytics (reduced to prevent spam)
      onUpdate: (data) => {
        console.log('📊 Analytics updated:', data);
      }
    }
  );
}
