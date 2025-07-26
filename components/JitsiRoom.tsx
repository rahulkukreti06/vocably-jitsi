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
    // Mobile viewport optimization - ensure proper scaling
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    } else {
      const newViewport = document.createElement('meta');
      newViewport.name = 'viewport';
      newViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(newViewport);
    }

    // Force mobile CSS fixes for Jitsi interface positioning
    const mobileStyle = document.createElement('style');
    mobileStyle.id = 'vocably-mobile-fixes';
    mobileStyle.textContent = `
      /* Mobile Jitsi interface fixes */
      @media (max-width: 768px) {
        /* Fix Jitsi container positioning */
        #jitsi-container {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 9999 !important;
        }
        
        /* Fix toolbar positioning - ensure it's visible and centered */
        .toolbox {
          position: fixed !important;
          bottom: 20px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 10000 !important;
          width: auto !important;
          max-width: 90vw !important;
        }
        
        /* Fix prejoin screen positioning */
        .prejoin-screen, [data-testid="prejoin.screen"] {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 9999 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
        }
        
        /* Ensure video containers fit screen */
        .videocontainer, .large-video-container {
          width: 100vw !important;
          height: 100vh !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
        }
        
        /* Fix filmstrip positioning */
        .filmstrip {
          bottom: 80px !important; /* Above toolbar */
        }
        
        /* Ensure buttons are touchable */
        .toolbox .toolbox-button {
          min-width: 44px !important;
          min-height: 44px !important;
          margin: 0 2px !important;
        }
        
        /* Fix any overflow issues */
        body.jitsi-meeting-active {
          overflow: hidden !important;
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        /* Ensure prejoin elements are visible */
        .prejoin-preview, .prejoin-input-area {
          width: 90% !important;
          max-width: 400px !important;
          margin: 10px auto !important;
        }
      }
    `;
    
    // Remove existing mobile fixes if they exist
    const existingStyle = document.getElementById('vocably-mobile-fixes');
    if (existingStyle) {
      existingStyle.remove();
    }
    document.head.appendChild(mobileStyle);

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
        subject, // Set the subject immediately
        startWithAudioMuted: audioMuted, // Use saved preference or default to muted
        startWithVideoMuted: videoMuted, // Use saved preference or default to muted
        // Force disable prejoin on mobile - multiple approaches
        prejoinPageEnabled: false,
        PREJOIN_PAGE_ENABLED: false,
        enablePrejoin: false,
        // Skip all intro/setup pages
        disableDeepLinking: true,
        enableWelcomePage: false,
        requireDisplayName: false,
        // Aggressive mobile bypasses - force direct meeting join
        disableMobileApp: true,
        MOBILE_DETECTION_ENABLED: false,
        enableNoAudioDetection: false,
        enableNoisyMicDetection: false,
        enableClosePage: false,
        disableProfile: true,
        // Force auto-join on mobile
        autoPlayPolicy: 'always',
        startScreenSharing: false,
        // Skip all intro screens
        enableWelcomePage: false,
        enableClosePage: false,
        // Performance settings for mobile
        enableLayerSuspension: true,
        channelLastN: 15, // Reduced for better mobile performance
        resolution: 480, // Lower resolution for mobile
        constraints: {
          video: {
            height: { ideal: 480, max: 720, min: 240 },
            width: { ideal: 640, max: 1280, min: 320 }
          }
        },
        // Remember user's media state
        rememberDeviceOptions: true,
        // Toolbar auto-hide settings - longer timeouts for mobile
        toolbarConfig: {
          alwaysVisible: false, // Allow toolbar to hide
          timeout: 6000, // Hide after 6 seconds (longer for mobile)
          initialTimeout: 12000, // Initial visibility for 12 seconds (longer for mobile)
        }
      },
      interfaceConfigOverwrite: {
        APP_NAME: 'Vocably',
        SHOW_JITSI_WATERMARK: false,
        // Mobile toolbar settings with auto-hide - longer timeouts for better UX
        MOBILE_APP_PROMO: false,
        TOOLBAR_ALWAYS_VISIBLE: false, // Allow toolbar to auto-hide
        INITIAL_TOOLBAR_TIMEOUT: 12000, // Show for 12 seconds initially (longer for mobile)
        TOOLBAR_TIMEOUT: 6000, // Show for 6 seconds when tapped (longer for mobile)
        // Mobile-specific bypass settings
        MOBILE_DETECTION_ENABLED: false,
        DISPLAY_WELCOME_PAGE_CONTENT: false,
        SHOW_DEEP_LINKING_IMAGE: false,
        SHOW_PROMOTIONAL_CLOSE_PAGE: false,
        // Enforce direct meeting access
        ENFORCE_NOTIFICATION_AUTO_DISMISS_TIMEOUT: 3000,
        DISABLE_TRANSCRIPTION_SUBTITLES: true
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

      // Mobile-specific: Force auto-join if prejoin screen appears
      api.addListener('videoConferenceJoined', () => {
        console.log('Successfully joined video conference');
      });

      // Force join on mobile devices if stuck on prejoin
      const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        // Add multiple fallbacks to ensure meeting starts on mobile
        setTimeout(() => {
          // Try to find and click join button if it exists
          const joinButton = document.querySelector('[data-testid="prejoin.joinMeeting"]') || 
                           document.querySelector('.prejoin-btn') ||
                           document.querySelector('[aria-label*="Join"]') ||
                           document.querySelector('button:contains("Join")');
          
          if (joinButton && joinButton instanceof HTMLElement) {
            console.log('Found prejoin button, clicking automatically for mobile');
            joinButton.click();
          }
        }, 1500);

        // Backup method: Use API commands
        setTimeout(() => {
          try {
            // Try various API commands to force join
            api.executeCommand('displayName', session?.user?.name || 'Vocably User');
            api.executeCommand('subject', subject);
          } catch (e) {
            console.log('API commands not ready yet');
          }
        }, 2000);
      }
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
      
      // Clean up mobile styles
      const existingStyle = document.getElementById('vocably-mobile-fixes');
      if (existingStyle) {
        existingStyle.remove();
      }
      
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
