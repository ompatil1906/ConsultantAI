import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";

async function ingestPdf() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("❌ Please provide a path to a PDF file.");
        console.error("Usage: node scripts/ingest.js <path-to-pdf>");
        process.exit(1);
    }

    // Ensure keys are set
    if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in .env.local");
    if (!process.env.PINECONE_API_KEY) throw new Error("Missing PINECONE_API_KEY in .env.local");
    if (!process.env.PINECONE_INDEX) throw new Error("Missing PINECONE_INDEX in .env.local");

    console.log(`📄 Loading PDF from ${filePath}...`);
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    console.log("✂️ Chunking the document...");
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`✅ Split into ${splitDocs.length} chunks.`);

    console.log("🔌 Initializing Pinecone and Google Embeddings...");
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX);

    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        modelName: "embedding-001", // Powerful Google embedding model
    });

    console.log("🚀 Uploading chunks to Pinecone. This may take a minute...");
    await PineconeStore.fromDocuments(splitDocs, embeddings, {
        pineconeIndex: index,
        maxConcurrency: 5,
    });

    console.log("🎉 Ingestion complete! The document is now stored in your vector database.");
    console.log("MedAssist AI will now automatically search these guidelines for its answers!");
}

ingestPdf().catch(console.error);
