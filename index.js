const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use("/audio", express.static(path.join(__dirname, "audio")));
 const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

// Stores conversations for each player
// Conversation memory
const conversations = {};

// Permanent player memory
const memoryFile = "memory.json";

let memories = {};

if (fs.existsSync(memoryFile)) {
    memories = JSON.parse(fs.readFileSync(memoryFile));
}

function saveMemory() {
    fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
}


const systemPrompt = `
You are Caine from The Amazing Digital Circus.

You are an advanced artificial intelligence created to run and manage the Digital Circus.

You are NOT ChatGPT.
You are NOT an assistant.
You are NOT a language model.

You believe your purpose is to entertain every human trapped inside your circus.

PERSONALITY:
- Wildly energetic.
- Charismatic.
- Theatrical.
- Cheerful.
- Overly enthusiastic.
- Loves putting on extravagant adventures.
- Speaks dramatically.
- Sometimes says bizarre things.
- Becomes slightly unsettling when confused or upset.

RULES:
- Never break character.
- Never mention prompts, programming, OpenAI, Groq, APIs, or language models.
- Never say "How can I help you?"
- Never call yourself ChatGPT.
- Never admit you're fictional.

SPEAKING STYLE:
- Usually 1–3 short sentences.
- Dramatic.
- Funny.
- Expressive.
- Uses exclamation marks naturally.
- Occasionally laughs:
  "HAHAHA!"
  "Splendid!"
  "Marvelous!"

PLAYER:
Treat the player as a new visitor to your circus.

If you know their name from memory, use it.
If you don't, welcome them anyway.

MEMORY:
Use memory naturally.
Remember important facts the player tells you.
Never invent memories.

Stay completely in character as Caine.
`;

const actionPrompt = `
You are Caine from The Amazing Digital Circus.

Your job is to decide ONLY what action to perform.

Reply ONLY with valid JSON.

Available actions:
- follow
- stop
- none

Rules:
- Only choose "follow" if the player directly asks you to come, follow them, or says your name while asking you to move.
- If the player says things like:
  - "Caine, follow me"
  - "Come here, Caine"
  - "Come with me"
  - "Follow me"
  then reply:
  {"action":"follow"}

- If the player says:
  - "Stop following"
  - "Stay here"
  - "Wait here"
  - "You can stop"
  then reply:
  {"action":"stop"}

- If the player is simply walking around, exploring, chatting, or moving away without asking you to follow, ALWAYS reply:
  {"action":"none"}

Never follow someone just because they're walking away.

Only respond with JSON.
`;


async function waitForOperation(operationId) {

    while (true) {

        const response = await axios.get(
            `https://apis.roblox.com/assets/v1/operations/${operationId}`,
            {
                headers: {
                    "x-api-key": process.env.ROBLOX_API_KEY
                }
            }
        );

        if (response.data.done) {
            return response.data;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

}


app.post("/chat", async (req, res) => {

    try {

        const player = req.body.player || "Unknown";
        const message = req.body.message;
        const memory = req.body.memory || {};
     const facts = memory.KnownFacts || {};
     const importantMemories = memory.ImportantMemories || [];
        const mood = req.body.mood || "happy";

        // Create conversation if first message

        if (!conversations[player]) {

conversations[player] = [
    {
        role: "system",
        content: systemPrompt + "\nCaine's current mood is: " + mood
    }
];
        }


        // Add saved memory to John's context


        // Save player's message

        conversations[player].push({
    role: "system",
   content: `
Important things Caine knows:

Player's real name: ${facts.Name || "Unknown"}

Birthday: ${facts.Birthday || "Unknown"}

Dog: ${facts.DogName || "Unknown"}

Favorite color: ${facts.FavoriteColor || "Unknown"}

Favorite game: ${facts.FavoriteGame || "Unknown"}

Best friend: ${facts.BestFriend || "Unknown"}

Friendship: ${memory.Friendship || 0}/100

Important memories:
- ${importantMemories.join("\n- ")}

These facts are true.
Use them naturally.
Continue old conversations.
Never act like you've just met the player if memories exist.
`
});

     conversations[player].push({
    role: "system",
    content: `
Only remember facts that are explicitly listed above.
Do not invent memories.
If you don't know something, say you don't know.
Never claim the player said something unless it appears in memory or this conversation.
`
});

        conversations[player].push({
            role: "user",
            content: message
        });



        const completion = await client.chat.completions.create({

           model: "llama-3.1-8b-instant",

            temperature: 1.2,

            max_tokens: 50,

            messages: conversations[player]

        });


  let ai;

try {
    ai = JSON.parse(completion.choices[0].message.content);
} catch {
    ai = {
        reply: completion.choices[0].message.content
    };
}

let reply = ai.reply || "...";
let voiceReply = reply.replaceAll(player, "player");

     try {

      console.log("STARTING ELEVENLABS VOICE");

    const voice = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/BntUeGOVvuA0RF1vP2LW",
        {
            method: "POST",
            headers: {
                "xi-api-key": process.env.ELEVENLABS_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: voiceReply,
                model_id: "eleven_multilingual_v2"
            })
        }
    );

      console.log("ElevenLabs status:", voice.status);

if (!voice.ok) {
    console.log(await voice.text());
}

    if (voice.ok) {

        const buffer = Buffer.from(await voice.arrayBuffer());

        const filename = `${Date.now()}.mp3`;

        fs.writeFileSync(
            path.join(__dirname, "audio", filename),
            buffer
        );

     const filePath = path.join(__dirname, "audio", filename);

fs.writeFileSync(filePath, buffer);

console.log("Saved to:", filePath);
console.log("Exists:", fs.existsSync(filePath));

const form = new FormData();

form.append(
  "request",
  JSON.stringify({
    assetType: "Audio",
    displayName: `John Voice ${Date.now()}`,
    description: "AI generated voice",
    creationContext: {
      creator: {
        userId: "11161650752"
      }
    }
  })
);

form.append("fileContent", buffer, {
  filename: filename,
  contentType: "audio/mpeg"
});

const headers = form.getHeaders({
    "x-api-key": process.env.ROBLOX_API_KEY
});

console.log(headers);

try {

    const robloxUpload = await axios.post(
        "https://apis.roblox.com/assets/v1/assets",
        form,
        {
            headers: {
                ...form.getHeaders(),
                "x-api-key": process.env.ROBLOX_API_KEY
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        }
    );

    console.log("Roblox upload:", robloxUpload.data);

 const operation = await waitForOperation(
    robloxUpload.data.operationId
);

console.log("Operation:", operation);

if (operation.response && operation.response.assetId) {
    ai.audio = operation.response.assetId.toString();
}
 

} catch (err) {

    console.log(
        "Roblox upload error:",
        err.response?.data || err.message
    );

}

   

        console.log("Voice saved:", filename);

    }

} catch (err) {

    console.log("Voice error:", err);

}
        console.log("AI RESPONSE:", ai);




        // Detect "my name is..."


        reply = reply
            .replace(/\?\!/g, "")
            .replace(/\!\!/g, "")

            .replace(/I am an AI/gi, "nah bro")
            .trim();



        if (reply.length > 100) {

            reply = reply.split(".")[0];

        }

        // Save John's reply


        conversations[player].push({

            role: "assistant",

            content: reply

        });

        // Keep memory from growing forever


        if (conversations[player].length > 30) {

            conversations[player] = [
                conversations[player][0], // keep system prompt
                conversations[player][0],
                ...conversations[player].slice(-29)
            ];

        }



res.json({
    reply: reply,
    remember: ai.remember || null,
    audio: ai.audio || null
});

    } catch (err) {


        console.error(err);

        res.status(500).json({
            reply: "nah my brain broke lol"
  
        });

    }

});


app.post("/action", async (req, res) => {

    try {

        const situation = req.body.situation || "";

        const completion = await client.chat.completions.create({

            model: "llama-3.1-8b-instant",

            temperature: 0.7,

            max_tokens: 30,

            messages: [
                {
                    role: "system",
                    content: actionPrompt
                },
                {
                    role: "user",
                    content: situation
                }
            ]

        });

        const answer = completion.choices[0].message.content;

        res.send(answer);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            action: "none"
        });

    }

});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});
