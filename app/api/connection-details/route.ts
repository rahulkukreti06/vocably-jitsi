import { NextRequest, NextResponse } from 'next/server';

// Jitsi integration: Only return basic room info, no token or LiveKit logic
export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get('roomId');
    const participantName = request.nextUrl.searchParams.get('participantName');
    if (typeof roomId !== 'string') {
      return new NextResponse('Missing required query parameter: roomId', { status: 400 });
    }
    if (participantName === null) {
      return new NextResponse('Missing required query parameter: participantName', { status: 400 });
    }
    // Look up the room by id to get the name
    const { data: room, error: roomError } = await (await import('@/lib/supabaseClient')).supabase
      .from('rooms')
      .select('name')
      .eq('id', roomId)
      .single();
    if (roomError || !room) {
      return new NextResponse('Room not found', { status: 404 });
    }
    // For Jitsi, just return the room name and participant name
    const data = {
      roomName: roomId,
      participantName: participantName,
    };
    return new NextResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}
