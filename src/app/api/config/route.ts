export async function GET() {
  return Response.json({
    ELEVENLABS_AGENT_ID: process.env.ELEVENLABS_AGENT_ID || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
  });
}