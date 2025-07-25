'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
// Import Jitsi Meet React App
import JitsiRoom from '@/components/JitsiRoom';

// Define a minimal LocalUserChoices type for now
// You should update this to match your actual usage
interface LocalUserChoices {
  // Add properties as needed
  [key: string]: any;
}

// This file is now the canonical join logic for rooms by id.
// Make sure all navigation and links use /rooms/[roomId] and pass the id, not the name.
// If you are using the [roomId] route, you should remove the [roomName] route to avoid confusion and routing errors.
// This will ensure only /rooms/[roomId] is used for joining rooms.

export default function PageClientImpl(props: {
  roomId: string;
  region?: string;
  hq: boolean;
  codec: 'vp8' | 'h264' | 'vp9' | 'av1';
  onJoin?: () => void;
  onPreJoin?: () => void;
}) {
  const [room, setRoom] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [connectionDetails, setConnectionDetails] = React.useState<any>(null);
  const [preJoinChoices, setPreJoinChoices] = React.useState<any>(null);
  const router = useRouter();
  const { data: session } = useSession();

  React.useEffect(() => {
    async function fetchRoom() {
      setLoading(true);
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', props.roomId)
        .single();
      if (error || !data) {
        setError('Room not found.');
        setRoom(null);
        setLoading(false);
        return;
      }
      setRoom(data);
      setError(null);
      setLoading(false);
    }
    fetchRoom();
  }, [props.roomId, props.region]);

  // Fetch connection details only after room is fetched
  React.useEffect(() => {
    if (!room) return;
    async function fetchConnectionDetails() {
      try {
        // Use session user name if available, fallback to random
        const participantName = session?.user?.name || 'user-' + Math.random().toString(36).substring(2, 8);
        const res = await fetch(`/api/connection-details?roomId=${encodeURIComponent(room.id)}&participantName=${encodeURIComponent(participantName)}${props.region ? `&region=${props.region}` : ''}`);
        if (!res.ok) throw new Error('Failed to get connection details');
        const details = await res.json();
        setConnectionDetails(details);
      } catch (e) {
        setError('Could not connect to the video service.');
      }
    }
    fetchConnectionDetails();
  }, [room, props.region, session?.user?.name]);

  // Leave handler for UI (button or navigation)
  const handleLeave = async () => {
    router.push('/');
  };

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>Loading room...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', marginTop: 40 }}>{error}</div>;
  if (!room || !connectionDetails) return <div style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>Connecting…</div>;

   // Use Jitsi Meet React App for Vocably room UI
   // Pass room name and user info as props
   const roomId = props.roomId;
   const displayName = room?.name || 'Room'; // Change 'name' to your actual field if needed
   return (
     <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
       <JitsiRoom roomName={roomId} subject={displayName} roomId={roomId} />
     </div>
   );
}