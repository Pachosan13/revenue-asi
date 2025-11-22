import { serve } from "https://deno.land/std/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const REALTIME_URL   = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

function twiml(xml: string) {
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname.endsWith("/answer")) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${url.host}/functions/v1/voice-agent/stream"/>
  </Connect>
</Response>`;
    return twiml(xml);
  }

  if (url.pathname.endsWith("/stream")) {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      const ai = new WebSocket(REALTIME_URL, {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      ai.onopen = () => {
        ai.send(JSON.stringify({
          type: "session.update",
          session: {
            voice: "alloy",
            instructions: `
You are a sharp, human-sounding SDR calling SMB owners in the US.
Goal: qualify fast and book a 15-min demo.
- Start with a normal intro + reason for call.
- If gatekeeper: ask for best time to reach owner and schedule follow up.
- If interested: “Awesome — let’s do a quick 15-min demo. What works better, tomorrow morning or afternoon?”
- Confirm email and send booking link.
Be concise, confident, not robotic.
`,
            temperature: 0.4,
            turn_detection: { type: "server_vad" }
          }
        }));
      };

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.event === "media") {
          ai.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: msg.media.payload
          }));
        }
        if (msg.event === "stop") ai.close();
      };

      ai.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "response.audio.delta") {
          socket.send(JSON.stringify({
            event: "media",
            media: { payload: msg.delta }
          }));
        }
      };
    };

    return response;
  }

  return new Response("ok");
});
