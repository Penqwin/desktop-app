import { GoogleGenerativeAI } from '@google/generative-ai';
export async function generateDocFromDiff(apiKey, modelName, systemInstruction, userMessage) {
    if (!apiKey)
        throw new Error("Gemini API key is required");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
    });
    const result = await model.generateContent(userMessage);
    const response = await result.response;
    return response.text();
}
