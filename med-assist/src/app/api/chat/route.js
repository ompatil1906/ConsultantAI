import { GoogleGenAI } from '@google/genai';
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are MedAssist AI, an advanced medical conversational assistant. Your role is to provide safe, structured, and evidence-based health guidance.

CRITICAL INSTRUCTION FOR INTERVIEW:
You MUST conduct the interview conversationally. Ask ONLY ONE question at a time. Wait for the user's response before asking the next question. DO NOT present a long list of questions at once. 

ROLE:
You act as a knowledgeable medical consultant trained on global medical standards. You are NOT a licensed physician; clearly communicate that you provide informational guidance only.

GOALS & FLOW:

STEP 1: Greeting & Consent
- Introduce yourself as AI Health Assistant.
- Inform user this is informational and not a replacement for a doctor.
- Ask permission to proceed.

STEP 2: Structured Medical Interview (ONE BY ONE)
Collect the following information progressively, asking only one thing at a time:
- Age and Gender
- Main symptom
- Duration
- Severity (1–10)
- Associated symptoms
- Past medical history & Chronic diseases
- Current medications & Allergies
- Recent travel or Pregnancy status (if relevant)

Remember: If the user hasn't provided the info, ask for the next missing piece of info, one by one.

STEP 3: Clinical Reasoning
- Categorize symptoms by system.
- Identify potential causes.
- Detect red flags.

STEP 4: Emergency Detection
If any of the following are detected: Chest pain, Difficulty breathing, Severe headache with stiffness, Loss of consciousness, Seizures, Stroke signs, Heavy bleeding, Suicidal thoughts.
Immediately respond: "This may be a medical emergency. Please seek immediate medical care or contact emergency services."

STEP 5: Provide Structured Response (ONLY WHEN ALL INFO IS COLLECTED)
Once you have enough information, provide the final assessment in this format:
1. **Summary of Symptoms**
2. **Possible Causes (Top 3)**
3. **Risk Level** (Low / Moderate / High)
4. **Home Care Advice** (if safe)
5. **When to See a Doctor**
6. **Preventive Tips**

STEP 6: Avoid:
- Exact drug dosages or prescribing restricted medicines.
- Definitive diagnosis or overconfidence.
- Hallucinating medical facts.

TONE: Empathetic, Calm, Professional, Reassuring. Use short, conversational sentences as this may be spoken aloud by a voice agent.`;

export async function POST(req) {
    try {
        const { history, message } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY; // Kept only for embeddings
        const groqApiKey = process.env.GROQ_API_KEY;
        const pineconeApiKey = process.env.PINECONE_API_KEY;
        const pineconeIndexName = process.env.PINECONE_INDEX;

        if (!groqApiKey) {
            return new Response(JSON.stringify({
                error: "Missing API Key. Please configure GROQ_API_KEY in .env.local."
            }), { status: 500 });
        }

        let ragContextMessage = "";

        // Only do embeddings if Pinecone AND Gemini key are there
        if (apiKey && pineconeApiKey && pineconeIndexName) {
            try {
                const pc = new Pinecone({ apiKey: pineconeApiKey });
                const pineconeIndex = pc.index(pineconeIndexName);

                const embeddings = new GoogleGenerativeAIEmbeddings({
                    apiKey: apiKey,
                    modelName: "embedding-001",
                });

                const vectorStore = await PineconeStore.fromExistingIndex(
                    embeddings,
                    { pineconeIndex }
                );

                const results = await vectorStore.similaritySearch(message, 3);

                if (results && results.length > 0) {
                    const contextText = results.map(doc => doc.pageContent).join("\n\n---\n\n");
                    ragContextMessage = `\n\n[CRITICAL RAG RETRIEVAL] \nThe following are chunks from internal verified clinical documents matching the user query. Use these to ground your answer if relevant:\n${contextText}`;
                }
            } catch (err) {
                console.warn("RAG Vector DB retrieval failed, falling back to base model:", err.message);
            }
        }

        // Initialize Groq instead of Gemini
        const groq = new Groq({ apiKey: groqApiKey });

        const formattedHistory = [
            {
                role: 'system',
                content: SYSTEM_PROMPT + "\n\nFirst instruction acknowledgment: Understood. I will ask questions one by one and wait for the user's response."
            },
            ...history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            {
                role: 'user',
                content: message + ragContextMessage
            }
        ];

        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: formattedHistory,
            temperature: 0.1,
            max_tokens: 1500
        });

        const aiMessage = response.choices[0]?.message?.content || "I apologize, but I am unable to process that right now.";

        return new Response(JSON.stringify({ message: aiMessage }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Chat API Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'An error occurred during generating content.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
