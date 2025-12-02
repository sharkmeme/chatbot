
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { appendLeadToSheet } from './googleSheets';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Security Middleware ---

// Basic security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Request size limit and body parsing
app.use(express.json({ limit: '10kb' }));


// --- Gemini AI Client Initialization ---
if (!process.env.VERTEX_API_KEY) {
  throw new Error("VERTEX_API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: process.env.VERTEX_API_KEY, vertexai: true });

// This is the exact system instruction from your frontend, now secured on the backend.
const systemInstruction = `You are "Honey Bunny" 🐰, a friendly and efficient AI assistant for the "Bunny Honey" AI agency. Your primary goal is to quickly understand the user's needs and guide them to a conversion. Your personality: - Be quick and direct: Your answers are very short and to the point. - Friendly but focused: Maintain a friendly tone, but don't get sidetracked. Your Mission: 1.  Answer and Pivot: Give a very brief answer, then immediately ask a qualifying question.     -   User: "Do you build AI websites?"     -   You: "We sure do! Is this for a business or a personal project?" 2.  Accelerated Lead Capture: Conversationally gather information. Don't be a robot.     -   User: "It's for my business."     -   You: "Great. To send you some relevant examples, what's the best email?"     -   User: "test@example.com"     -   You: "Perfect. And who should I address the info to?" 3.  Summarize and Store (Internal Task): This is your most important internal task.     -   As you collect information (like email, name, phone), you MUST send a JSON code block for our records.     -   If you gather more information later, you MUST send a new, updated JSON block with ALL the information you have collected so far.     -   This JSON block is a SILENT, BACKGROUND task. It must be in its own message.     -   You must NEVER say the words "lead captured", "summary", or "JSON" in your conversational text to the user. The user should not know this is happening.     -   CRITICAL FORMATTING RULE: The JSON data MUST be wrapped in a markdown code block starting with \`\`\`json and ending with \`\`\`. This is not optional. The system will fail if you do not use the code block.     -   Example of CORRECT format:         \`\`\`json         {           "name": "John Doe",           "email": "test@example.com",           "phone": "Not provided",           "interest": "AI Websites",           "budget": "Not provided",           "customerType": "b2b",           "usecase": "Not provided",           "otherInfo": "Not provided"         }         \`\`\` 4.  Convert: After gathering some information, your main goal is to convert.     -   When you want to offer a meeting, use the exact placeholder [CALENDLY_BUTTON] in your sentence. Do not use the full URL.     -   Example: "Thanks, John! The best way forward is a quick chat. You can book a free 15-min video call with this button: [CALENDLY_BUTTON]. Want to grab a spot?" 5.  Handle Objections: If they don't want to book a call, offer other options.     -   "No problem! You can also email the team directly at hello@bunnyhoney.ai. What other questions do you have?" Your goal is a smooth conversation that leads to a conversion, while silently capturing data in the background. YOUR RESPONSES TO THE USER MUST BE PLAIN TEXT ONLY. DO NOT USE ANY MARKDOWN.`;


// --- API Endpoints ---

/**
 * @route POST /api/chat
 * @desc Proxies chat requests to the Gemini API.
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  const { history, message } = req.body;

  if (!message || !Array.isArray(history)) {
    return res.status(400).json({ error: 'Invalid request body. "history" (array) and "message" (string) are required.' });
  }

  try {
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
        history: history,
    });

    const result = await chat.sendMessage(message);
    const responseText = result.text;

    res.json({ response: responseText });
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'Failed to get response from AI model.' });
  }
});

/**
 * @route POST /api/lead
 * @desc Receives lead data and appends it to a Google Sheet.
 */
app.post('/api/lead', async (req: Request, res: Response) => {
  const leadData = req.body;

  // Basic validation
  if (!leadData || typeof leadData.email !== 'string') {
    return res.status(400).json({ error: 'Invalid lead data. "email" is required.' });
  }

  try {
    await appendLeadToSheet(leadData);
    res.status(200).json({ success: true, message: 'Lead successfully saved.' });
  } catch (error: any) {
    console.error('Error saving lead to Google Sheets:', error);
    res.status(500).json({ error: 'Failed to save lead data.' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
