// Removed LiveKit imports

export interface SessionProps {
  roomName: string;
  identity: string;
  // audioTrack and videoTrack removed (LiveKit-specific)
  region?: string;
  turnServer?: RTCIceServer;
  forceRelay?: boolean;
}

export interface TokenResult {
  identity: string;
  accessToken: string;
}

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};
