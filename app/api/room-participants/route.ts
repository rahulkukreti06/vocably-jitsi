import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET handler: fetch participant counts from Supabase
export async function GET() {
  const { data, error } = await supabase.from('rooms').select('id,participants');
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch participant counts' }, { status: 500 });
  }
  const countsObj: { [roomId: string]: number } = {};
  data.forEach((room: any) => {
    countsObj[room.id] = room.participants;
  });
  return NextResponse.json({ rooms: countsObj });
}

// POST handler: update participant count in Supabase
export async function POST(request: Request) {
  const { roomId, action } = await request.json();
  if (!roomId || !action) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    // Fetch current count from Supabase
    const { data, error } = await supabase.from('rooms').select('participants').eq('id', roomId).single();
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch current count' }, { status: 500 });
    }
    let newCount = data?.participants || 0;
    if (action === 'join') {
      newCount += 1;
    } else if (action === 'leave') {
      newCount = Math.max(0, newCount - 1);
    }
    // Update Supabase
    const { error: updateError } = await supabase.from('rooms').update({ participants: newCount }).eq('id', roomId);
    if (updateError) {
      return NextResponse.json({ error: 'Failed to update count' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update participant count' }, { status: 500 });
  }
}
