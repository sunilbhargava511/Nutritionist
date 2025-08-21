export async function GET() {
  return Response.json({
    NEXT_PUBLIC_ELEVENLABS_AGENT_ID: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
    ELEVENLABS_AGENT_ID: process.env.ELEVENLABS_AGENT_ID,
    NODE_ENV: process.env.NODE_ENV,
    // Don't expose API keys, just check if they exist
    hasApiKey: !!process.env.ELEVENLABS_API_KEY,
    hasPublicApiKey: !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
  });
}