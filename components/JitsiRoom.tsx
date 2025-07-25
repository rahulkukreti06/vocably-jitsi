import React, { useEffect, useRef } from 'react';
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

    const domain = 'api.vocably.chat:8000'; // Use your VPS IP with port 8443
    const options = {
      roomName: `${roomName}?config.disableDeepLinking=true&config.enableWelcomePage=false&interfaceConfig.MOBILE_APP_PROMO=false`,
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: session?.user?.name || 'Guest'
      },
      configOverwrite: {
        subject, // Set the subject immediately
        SHOW_PROMOTIONAL_CLOSE_PAGE: true, // Allow close page to show
        closePage: { 
          enabled: true,
          customMessage: "Thank you for using Vocably! 🎉"
        },
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false, // Skip the pre-join page
        disableDeepLinking: true, // Disable deep linking to app
        disableThirdPartyRequests: true,
        enableWelcomePage: false,
        // Force web interface - disable mobile app detection
        enableMobileSimulcast: false,
        disableMobileApp: true,
        requireDisplayName: false,
        // Disable app promotion
        MOBILE_DETECTION_ENABLED: false,
        ENFORCE_NOTIFICATION_AUTO_DISMISS_TIMEOUT: 5000
      },
      interfaceConfigOverwrite: {
        SHOW_PROMOTIONAL_CLOSE_PAGE: true,
        MOBILE_APP_PROMO: false, // Disable mobile app promotion
        NATIVE_APP_NAME: undefined,
        APP_NAME: 'Vocably',
        SHOW_JITSI_WATERMARK: false,
        // Force desktop interface
        MOBILE_DETECTION_ENABLED: false,
        
        // Disable deep linking UI elements
        SHOW_DEEP_LINKING_IMAGE: false,
        // Hide mobile-specific elements
        HIDE_DEEP_LINKING_LOGO: true,
        SHOW_MOBILE_APP_PROMO: false
      }
    };

    // Load the Jitsi Meet API script if not already loaded
    const createJitsi = () => {
      const api = new window.JitsiMeetExternalAPI(domain, options);
      apiRef.current = api;
      
      api.executeCommand('subject', subject); // Set the meeting subject/title (redundant, but ensures update)
      
      // Track participant join/leave for room count
      if (roomId) {
        // Note: Join API call is handled in the main page before navigation
        // We only need to handle the leave tracking here
        
        // Function to handle leaving (call only once)
        const handleLeave = () => {
          if (!hasLeftRef.current) {
            hasLeftRef.current = true;
            fetch('/api/room-participants', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId, action: 'leave' }),
            }).catch(err => console.error('Failed to update participant count on leave:', err));
          }
        };

        // Also handle window/tab close events
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
        
        // Store the leave handler for the main readyToClose listener
        (api as any)._handleLeave = handleLeave;
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
      script.src = `https://${domain}/external_api.js`;
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
        // Also send leave event when component unmounts unexpectedly
        if (!hasLeftRef.current) {
          hasLeftRef.current = true;
          fetch('/api/room-participants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, action: 'leave' }),
          }).catch(err => console.error('Failed to update participant count on unmount:', err));
        }
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
