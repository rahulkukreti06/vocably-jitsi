import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function JitsiRoom({ roomName, subject, roomId }: { roomName: string, subject: string, roomId?: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const hasJoinedRef = useRef(false);
  const hasLeftRef = useRef(false);

  useEffect(() => {
    // Add class to html/body to disable scroll in meeting view
    document.documentElement.classList.add('jitsi-meeting-active');
    document.body.classList.add('jitsi-meeting-active');

    // Get saved audio/video preferences from localStorage
    const savedAudioMuted = localStorage.getItem('vocably-audio-muted') === 'true';
    const savedVideoMuted = localStorage.getItem('vocably-video-muted') === 'true';
    
    // If no preference saved yet, default to muted (privacy-first approach)
    const audioMuted = localStorage.getItem('vocably-audio-muted') === null ? true : savedAudioMuted;
    const videoMuted = localStorage.getItem('vocably-video-muted') === null ? true : savedVideoMuted;

    const domain = 'api.vocably.chat'; // Use domain without port (nginx will proxy)
    const options = {
      roomName: roomName, // Clean room name without URL parameters
      parentNode: jitsiContainerRef.current,
      width: '100%',
      height: '100vh',
      userInfo: {
        displayName: session?.user?.name || 'Guest'
      },
      configOverwrite: {
        subject, // Set the meeting subject/title
        startWithAudioMuted: audioMuted, // Use saved preference
        startWithVideoMuted: videoMuted, // Use saved preference
        prejoinPageEnabled: false, // Skip the pre-join page
        requireDisplayName: false
      },
      interfaceConfigOverwrite: {
        APP_NAME: 'Vocably',
        SHOW_JITSI_WATERMARK: false,
        // Mobile toolbar settings - ensure it's always accessible
        MOBILE_APP_PROMO: false,
        TOOLBAR_ALWAYS_VISIBLE: false,
        INITIAL_TOOLBAR_TIMEOUT: 20000, // Show for 20 seconds initially
        TOOLBAR_TIMEOUT: 10000, // Show for 10 seconds when tapped
        // Ensure toolbar buttons are visible
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'hangup', 'chat', 'desktop', 
          'fullscreen', 'fodeviceselection', 'settings'
        ]
      }
    };

    // Load the Jitsi Meet API script if not already loaded
    const createJitsi = () => {
      const api = new window.JitsiMeetExternalAPI(domain, options);
      apiRef.current = api;
      
      api.executeCommand('subject', subject); // Set the meeting subject/title (redundant, but ensures update)
      
      // Track actual Jitsi meeting participants (not just page visits)
      if (roomId) {
        // Track actual meeting join/leave events
        api.addEventListener('videoConferenceJoined', () => {
          if (!hasJoinedRef.current) {
            hasJoinedRef.current = true;
            console.log('User actually joined Jitsi meeting');
            fetch('/api/room-participants', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId, action: 'join' }),
            }).catch(err => console.error('Failed to update participant count on join:', err));
          }
        });

        // Save audio/video mute preferences to localStorage
        api.addEventListener('audioMuteStatusChanged', (event: any) => {
          localStorage.setItem('vocably-audio-muted', event.muted.toString());
          console.log('Audio mute status saved:', event.muted);
        });

        api.addEventListener('videoMuteStatusChanged', (event: any) => {
          localStorage.setItem('vocably-video-muted', event.muted.toString());
          console.log('Video mute status saved:', event.muted);
        });

        api.addEventListener('videoConferenceLeft', () => {
          if (!hasLeftRef.current) {
            hasLeftRef.current = true;
            console.log('User actually left Jitsi meeting');
            fetch('/api/room-participants', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId, action: 'leave' }),
            }).catch(err => console.error('Failed to update participant count on leave:', err));
          }
        });
        
        // Also handle window/tab close events (only if not already left)
        const handleBeforeUnload = () => {
          if (!hasLeftRef.current) {
            hasLeftRef.current = true;
            // Use sendBeacon for more reliable delivery on page unload
            const data = JSON.stringify({ roomId, action: 'leave' });
            navigator.sendBeacon('/api/room-participants', data);
          }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup function to remove the event listener
        const cleanupBeforeUnload = () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };
        
        // Store cleanup function for later use
        (api as any)._cleanupBeforeUnload = cleanupBeforeUnload;
      }
      
      // Inject CSS to customize the close page with Vocably branding
      const style = document.createElement('style');
      style.innerHTML = `
        .closePage, .close-page, .thankyou-container { 
          background: linear-gradient(135deg, #1a1c23 0%, #2a2d35 100%) !important;
          color: #fff !important;
        }
        .closePage h1, .close-page h1, .thankyou-container h1 {
          background: linear-gradient(90deg, #ffe066 0%, #10b981 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          font-weight: 900 !important;
          font-size: 2.5rem !important;
        }
        .closePage::before, .close-page::before, .thankyou-container::before {
          content: "Thank you for using Vocably! 🎉" !important;
          display: block !important;
          font-size: 2rem !important;
          font-weight: bold !important;
          margin-bottom: 1rem !important;
          background: linear-gradient(90deg, #ffe066 0%, #10b981 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
        }
      `;
      document.head.appendChild(style);
      
      // Remove the MutationObserver that was hiding the close page
      // Now we want to show our custom Vocably thank you message
      
      // Single readyToClose listener that handles both participant tracking and navigation
      api.addListener('readyToClose', () => {
        // Handle participant leave first
        if (roomId && (api as any)._handleLeave) {
          (api as any)._handleLeave();
        }
        
        // Clean up participant tracking
        if (roomId && apiRef.current?._cleanupBeforeUnload) {
          apiRef.current._cleanupBeforeUnload();
        }
        
        // Allow Jitsi's thank you page to show for 2 seconds before redirecting
        setTimeout(() => {
          if (jitsiContainerRef.current) {
            jitsiContainerRef.current.style.display = 'none';
            jitsiContainerRef.current.innerHTML = '';
          }
          router.push('/');
        }, 2000); // Show thank you message for 2 seconds
      });
    };

    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = `https://${domain}/external_api.js`; // Back to HTTPS
      script.async = true;
      script.onload = createJitsi;
      document.body.appendChild(script);
    } else {
      createJitsi();
    }

    return () => {
      // Reset flags for potential re-renders
      hasJoinedRef.current = false;
      hasLeftRef.current = false;
      
      // Remove class on unmount
      document.documentElement.classList.remove('jitsi-meeting-active');
      document.body.classList.remove('jitsi-meeting-active');
      
      // Clean up participant tracking when component unmounts
      if (roomId && apiRef.current?._cleanupBeforeUnload) {
        apiRef.current._cleanupBeforeUnload();
      }
      
      if (jitsiContainerRef.current) {
        jitsiContainerRef.current.innerHTML = '';
      }
    };
  }, [roomName, subject, roomId, session?.user?.name, router]);

  return <div
    ref={jitsiContainerRef}
    data-jitsi-meeting
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      zIndex: 9999,
      background: '#000'
    }}
  />;
}
