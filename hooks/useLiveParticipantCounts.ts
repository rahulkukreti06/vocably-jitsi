import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useLiveParticipantCounts(rooms: { id: string }[]) {
  const [counts, setCounts] = useState<{ [roomId: string]: number }>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!rooms || rooms.length === 0) return;
    let subscription: any;
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let heartbeatTimeout: NodeJS.Timeout | null = null;

    // Heartbeat/ping logic
    function startHeartbeat() {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // send ping every 30s
    }

    function stopHeartbeat() {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    }

    // WebSocket real-time updates with exponential backoff
    function setupWebSocket() {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
      ws = new window.WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        reconnectAttempts.current = 0;
        startHeartbeat();
        console.log('[useLiveParticipantCounts] WebSocket connected');
      };
      ws.onmessage = (event) => {
        // Reset heartbeat timeout on any message
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
        heartbeatTimeout = setTimeout(() => {
          console.warn('[useLiveParticipantCounts] No message received for 60s, reconnecting...');
          wsRef.current?.close();
        }, 60000); // 60s timeout
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'counts' && data.rooms) {
            setCounts((prev) => ({ ...prev, ...data.rooms }));
          }
        } catch (err) {
          // Ignore parse errors
        }
      };
      ws.onclose = () => {
        stopHeartbeat();
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
        reconnectAttempts.current += 1;
        const delay = Math.min(30000, 2000 * Math.pow(2, reconnectAttempts.current)); // exponential backoff up to 30s
        console.log(`[useLiveParticipantCounts] WebSocket disconnected, retrying in ${delay / 1000}s...`);
        setTimeout(setupWebSocket, delay);
      };
      ws.onerror = (err) => {
        console.error('[useLiveParticipantCounts] WebSocket error:', err);
      };
    }
    setupWebSocket();

    // Fallback: also subscribe to Supabase for DB sync
    async function fetchCounts() {
      const { data, error } = await supabase
        .from('rooms')
        .select('id,participants');
      if (!error && data) {
        const countsObj: { [roomId: string]: number } = {};
        data.forEach((room: any) => {
          countsObj[room.id] = room.participants;
        });
        setCounts(countsObj);
      }
    }
    fetchCounts();
    subscription = supabase
      .channel('public:rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchCounts();
      })
      .subscribe();

    // Poll every 5 seconds
    pollInterval = setInterval(fetchCounts, 5000);

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (wsRef.current) wsRef.current.close();
      if (pollInterval) clearInterval(pollInterval);
      stopHeartbeat();
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    };
  }, [rooms]);

  return counts;
}
