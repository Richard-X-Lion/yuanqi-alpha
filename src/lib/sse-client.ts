/**
 * SSE Client with connection stability enhancements
 * - Timeout detection
 - Heartbeat monitoring
 - Automatic reconnection with exponential backoff
 - Connection state tracking
 */

export interface SSEClientOptions {
  url: string;
  body: unknown;
  onEvent: (event: string, data: unknown) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  timeoutMs?: number;
  heartbeatIntervalMs?: number;
  maxRetries?: number;
}

export interface SSEClient {
  abort: () => void;
  getState: () => SSEState;
}

export type SSEState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'timeout';

export function createSSEClient(options: SSEClientOptions): SSEClient {
  const {
    url,
    body,
    onEvent,
    onError,
    onConnect,
    onDisconnect,
    timeoutMs = 60000,
    heartbeatIntervalMs = 30000,
    maxRetries = 0,
  } = options;

  let abortController: AbortController | null = null;
  let state: SSEState = 'connecting';
  let retryCount = 0;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDataTime = Date.now();
  let isAborted = false;

  const clearTimers = () => {
    if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
    if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
  };

  const resetTimeout = () => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    lastDataTime = Date.now();
    timeoutTimer = setTimeout(() => {
      if (state === 'connected') {
        state = 'timeout';
        if (onError) onError(new Error('连接超时，服务器长时间未响应'));
        abortController?.abort();
      }
    }, timeoutMs);
  };

  const startHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      const elapsed = Date.now() - lastDataTime;
      if (elapsed > heartbeatIntervalMs * 2 && state === 'connected') {
        state = 'timeout';
        if (onError) onError(new Error('心跳检测失败，连接可能已断开'));
        abortController?.abort();
      } else if (state === 'connected') {
        startHeartbeat();
      }
    }, heartbeatIntervalMs);
  };

  const connect = async () => {
    if (isAborted) return;

    state = 'connecting';
    abortController = new AbortController();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json() as { error?: string; message?: string };
          message = errorBody.error || errorBody.message || message;
        } catch { /* keep HTTP fallback */ }
        const error = new Error(message) as Error & { retryable?: boolean };
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }

      state = 'connected';
      if (onConnect) onConnect();
      resetTimeout();
      startHeartbeat();

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        resetTimeout();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(currentEvent, data);
            } catch { /* skip invalid JSON */ }
            currentEvent = '';
          }
        }
      }

      // Stream ended normally
      state = 'disconnected';
      if (onDisconnect) onDisconnect();
    } catch (err) {
      if (isAborted) return;

      if (err instanceof DOMException && err.name === 'AbortError') {
        if (state === 'connected') {
          state = 'disconnected';
          if (onDisconnect) onDisconnect();
        }
        return;
      }

      state = 'error';
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));

      // Auto-retry with exponential backoff
      const retryable = !(err instanceof Error) || (err as Error & { retryable?: boolean }).retryable !== false;
      if (retryable && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
        setTimeout(() => {
          if (!isAborted) connect();
        }, delay);
      }
    } finally {
      clearTimers();
    }
  };

  // Start connection
  connect();

  return {
    abort: () => {
      isAborted = true;
      clearTimers();
      abortController?.abort();
      state = 'disconnected';
    },
    getState: () => state,
  };
}
