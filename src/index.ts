import dotenv from "dotenv";
import express, { Request, Response } from "express";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import axios from "axios";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

// Endpoint to handle incoming WhatsApp messages
app.post("/whatsapp", async (req: Request, res: Response) => {
  const incomingMsg = req.body.Body || "";
  const mediaUrl = req.body.MediaUrl0 || "";

  console.log(
    `Received a message from WhatsApp. Message: ${incomingMsg}; Media: ${mediaUrl}`
  );

  const twiml = new MessagingResponse();

  const info = await processMessage(incomingMsg, mediaUrl);
  const msg = info
    ? twiml.message(info)
    : twiml.message("Something went wrong. Please try again!");

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());

  console.log("Reply sent!");
});

const processMessage = async (
  body: string | null,
  media: string | null
): Promise<string | null> => {
  let itemDescription = body;

  if (media) {
    // Process image to get item description
    itemDescription = await processImage(media);
  }

  if (!itemDescription) {
    console.log("> `itemDescription` not found");
    return null;
  }

  const recyclingInfo = await getRecyclingInfo(itemDescription);

  if (!recyclingInfo) {
    console.log("> recyclingInfo not found");
  }
  return recyclingInfo;
};

async function processImage(mediaUrl: string): Promise<string | null> {
  console.log(`> Processing image: ${mediaUrl}`);
  const visionApiKey = process.env.GOOGLE_VISION_API_KEY;
  try {
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        requests: [
          {
            image: { source: { imageUri: mediaUrl } },
            features: [{ type: "OBJECT_LOCALIZATION" }],
          },
        ],
      }
    );

    console.log(`> Image processing success`);
    console.log(
      `Raw Response: ${JSON.stringify(response.data.responses, null, 2)}`
    );

    // const name =
    //   response.data.responses[0].labelAnnotations[0].description;

    const name = response.data.responses[0].localizedObjectAnnotations[0].name;
    console.log(`> Object Detected: ${name}`);
    return name;
  } catch (e) {
    console.log(`> Image processing failed`, e);
    return null;
  }
}

// Function to get recycling info using OpenAI
async function getRecyclingInfo(description: string): Promise<string | null> {
  console.log(`> Getting recycling info for: ${description}`);

  const prompt = `You are a recycle bot. You give quick steps to recycle, reduce or reuse waste material.
Keep the ideas short and simple. Try to answer in less than 150 words. Use a bullet point format to make it more readable.
Tell me what I can do with ${description}`;

  try {
    const aiResponse = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt,
      max_tokens: 500,
    });
    console.log("> Got recycling instructions");
    const recyclingInfo = aiResponse.choices[0].text.trim();
    return recyclingInfo;
  } catch (e) {
    console.log("> Open AI Error", e);
    return null;
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
