import { NextResponse } from 'next/server';
import { getPbClient } from '@/lib/pb';

export const dynamic = 'force-dynamic';

const startTime = Date.now();

export async function GET() {
  let dbHealthy = false;

  try {
    const pb = await getPbClient();
    const health = await pb.health.check();
    dbHealthy = health.code === 200;
  } catch {
    dbHealthy = false;
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  // Format timestamp in Asia/Kolkata (IST)
  const timestamp = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

  if (!dbHealthy) {
    return NextResponse.json(
      { status: 'degraded', db: false, timestamp, uptime: uptimeSeconds },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: 'ok',
    db: true,
    timestamp,
    uptime: uptimeSeconds,
  });
}
