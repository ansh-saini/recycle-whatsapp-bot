// @ts-nocheck

import express, { Request, Response } from 'express';
import MessagingResponse from 'twilio/lib/twiml/MessagingResponse';
import axios from 'axios';
import OpenAI from 'openai';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: 'redacted'
});

// const accountSid = 'redacted';
// const authToken = 'redacted';
// const client = require('twilio')(accountSid, authToken);

// client.messages
//     .create({
//         body: 'Reduce, Reuse & Recycle ♻️',
//         from: 'whatsapp:+SANDBOX_NUMBER',
//         to: 'whatsapp:+MY_NUMBER'
//     })
//     .then(message => console.log(message.sid))
//     .done();

// Endpoint to handle incoming WhatsApp messages
app.post('/whatsapp', async (req: Request, res: Response) => {
  const incomingMsg = req.body.Body || '';
  const mediaUrl = req.body.MediaUrl0 || '';
  console.log("Got a message!")
  console.log({incomingMsg, mediaUrl})

  const twiml = new MessagingResponse();
  const msg = twiml.message();

  try {
    let itemDescription = incomingMsg;

    if (mediaUrl) {
      // Process image to get item description
      itemDescription = await processImage(mediaUrl);
    }

    // Get recycling info using AI
    const recyclingInfo = await getRecyclingInfo(itemDescription);
    msg.body(recyclingInfo);
  } catch (error) {
    msg.body('Sorry, something went wrong. Please try again.');
    console.error(error);
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

// Function to process image using Google Vision API
async function processImage(mediaUrl: string): Promise<string> {
  const visionApiKey = 'your_google_vision_api_key';
  const response = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
    {
      requests: [
        {
          image: { source: { imageUri: mediaUrl } },
          features: [{ type: 'LABEL_DETECTION' }]
        }
      ]
    }
  );

  const description = response.data.responses[0].labelAnnotations[0].description;
  return description;
}

// Function to get recycling info using OpenAI
async function getRecyclingInfo(description: string): Promise<string> {
  const aiResponse = await openai.completions.create({
    engine: 'text-davinci-003',
    model: "gpt-3.5-turbo-instruct",
    prompt: `How to recycle or dispose of ${description}?`,
    maxTokens: 150
  });

  const recyclingInfo = aiResponse.choices[0].text.trim();
  return recyclingInfo;
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
