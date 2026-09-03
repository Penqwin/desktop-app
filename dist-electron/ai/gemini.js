import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSystemInstruction } from './promptTemplates.js';
export async function generateDocFromDiff(apiKey, modelName, systemInstruction, // Kept for backwards compatibility but ignored
userMessage) {
    if (!apiKey)
        throw new Error("Gemini API key is required");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: getSystemInstruction(),
    });
    const result = await model.generateContent(userMessage);
    const response = await result.response;
    return response.text();
}
