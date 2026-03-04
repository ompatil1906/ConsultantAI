import { NextResponse } from 'next/server';
import OpenAI from "openai";

export async function POST(req) {
    try {
        const { text } = await req.json();
        const cleanText = text.replace(/[*_#`>-]/g, '').trim();

        // Provider 1: ElevenLabs
        const elevenApiKey = process.env.ELEVENLABS_API_KEY;
        if (elevenApiKey && elevenApiKey !== "" && !elevenApiKey.includes('your_')) {
            try {
                const voiceId = "EXAVITQu4vr4xnSDxMaL"; // Sarah (Calm, Professional)
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: "POST",
                    headers: {
                        "Accept": "audio/mpeg",
                        "Content-Type": "application/json",
                        "xi-api-key": elevenApiKey
                    },
                    body: JSON.stringify({
                        text: cleanText,
                        model_id: "eleven_turbo_v2_5",
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                    })
                });

                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    return new Response(buffer, { headers: { 'Content-Type': 'audio/mpeg' } });
                } else {
                    const errorMsg = await response.text();
                    console.warn("ElevenLabs failed:", errorMsg);
                    // Fall through to next provider
                }
            } catch (e) {
                console.warn("ElevenLabs request failed:", e.message);
            }
        }

        // Provider 2: OpenAI (Extremely reliable fallback)
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (openaiApiKey && openaiApiKey !== "" && !openaiApiKey.includes('your_')) {
            try {
                const openai = new OpenAI({ apiKey: openaiApiKey });
                const mp3 = await openai.audio.speech.create({
                    model: "tts-1",
                    voice: "nova", // nova is clear and very professional for medical usage
                    input: cleanText,
                });

                const buffer = Buffer.from(await mp3.arrayBuffer());
                return new Response(buffer, { headers: { 'Content-Type': 'audio/mpeg' } });
            } catch (e) {
                console.warn("OpenAI TTS failed:", e.message);
            }
        }

        // Generic Fallback (Signals frontend use browser TTS)
        return NextResponse.json({ error: "External TTS currently unavailable." }, { status: 503 });

    } catch (error) {
        console.error('Unified TTS API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
