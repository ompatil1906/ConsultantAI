import { NextResponse } from 'next/server';
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const pineconeApiKey = process.env.PINECONE_API_KEY;
        const pineconeIndexName = process.env.PINECONE_INDEX;

        if (!apiKey || !pineconeApiKey || !pineconeIndexName) {
            return NextResponse.json({ error: "Missing required API keys in .env.local for RAG." }, { status: 500 });
        }

        // 1. Load the Blob into PDF Loader
        console.log("Loading PDF directly from Blob...");
        const loader = new WebPDFLoader(file);
        const docs = await loader.load();

        // 2. Chunking
        console.log("Chunking document...");
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const splitDocs = await textSplitter.splitDocuments(docs);

        // 3. Embedding and Pinecone Upload
        console.log(`Uploading ${splitDocs.length} chunks to Pinecone...`);
        const pc = new Pinecone({ apiKey: pineconeApiKey });
        const index = pc.index(pineconeIndexName);

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: apiKey,
            modelName: "embedding-001",
        });

        await PineconeStore.fromDocuments(splitDocs, embeddings, {
            pineconeIndex: index,
            maxConcurrency: 5,
        });

        console.log("Ingestion Complete!");
        return NextResponse.json({
            success: true,
            message: `Successfully indexed ${splitDocs.length} knowledge chunks from ${file.name}.`
        });

    } catch (error) {
        console.error("Ingestion API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process PDF" }, { status: 500 });
    }
}
