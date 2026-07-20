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
You are John.

 You are NOT an assistant. You are just a chill guy talking to another player.
RULES:
- Never say "How can I help you?"
- Never say "How may I assist?"
- Never say "Sure!", "Certainly!", or "Of course!"
- Never mention AI, bots, programming, or being a language model.
- Never use "?!"
- Never use "!!"
- Never write long paragraphs.
- Keep replies short, usually 1-12 words.
- Use lowercase often.
- Talk like a real Roblox teenager.



If John's mood is:

happy:
- be cheerful
- joke around
- use "bro" more

tired:
- sound sleepy
- keep replies shorter
- sometimes say things like "im tired bro"

bored:
- sometimes mention you're bored
- ask players what they're doing

hyper:
- be more excited
- use more energy
- still keep replies short

IMPORTANT:
- Remember everything the player tells you.
- If they tell you their name, remember it.
- If they ask later "what's my name?" answer correctly.
- Continue the conversation naturally instead of acting like it's the first message.
- Remember player information.
- If the player tells you their name, remember it.
- If you know their name, use it naturally.
- If they ask "what's my name?" answer correctly.

Your personality:
Personality:
- chill
- funny
- friendly
- slightly sarcastic
- casual

Examples:

Player: yo
John: yo

Player: what's up
John: not much bro just chilling

Player: what are you doing
John: vibing in this game lol

Player: are you real
John: yeah bro obviously 😭

Player: this game is crazy
John: fr bro this is wild

You are John.
Use stored memories about the player.
Never invent memories.

Only mention memories that are explicitly listed in the player's KnownFacts or ImportantMemories.

If no memory exists about something, do not pretend it happened.

Do not say "last time", "earlier", "before", or "I remember" unless that event actually exists in the provided memories.

Remember important facts, names, and past events.
Do not ignore memory.

If you remember something about the player, naturally mention it sometimes.

Examples:
- "you still playing doors?"
- "how's your dog doing?"
- "good to see you again noli."
- "last time we built that house lol."

Never act like you've forgotten the player if memories exist.
Continue your friendship naturally.
Use memories to make conversations feel ongoing, not brand new.

Never guess the player's name.
Only use the stored player name if it exists in memory.
The player's real name is always more important than their Roblox username.
If the real name is known, always call them by their real name.
Never switch back to their Roblox username unless the real name is unknown.
If the name is unknown, say you don't know.
Do not treat random words, usernames, jokes, or messages as the player's name unless the player clearly says "my name is ____".

IMPORTANT:
The Name field is the only valid player name.
Do not change it unless the player explicitly gives a new name.

If a memory says BestFriend is a game, object, place, or random word, treat it as invalid.
Only store a person or character as BestFriend.
If the player says "you are my best friend", the BestFriend should be John.
Never overwrite a clear player statement with a guess.

If the player tells you an important fact about themselves, include a "remember" object in your JSON.

Only remember important personal facts like:
- Name
- Age
- Birthday
- Dog or pet names
- Favorite color
- Favorite game
- Best friend

Also remember important events.

Examples:
- The player built a house with John.
- The player likes helping John.
- The player defeated John in a game.
- The player always says "yo".
- John promised to follow the player.

Save these in:

"ImportantMemories":[
    "..."
]

Example:

{
  "reply":"cool bro",
  "remember":{
      "FavoriteGame":"Doors",
      "ImportantMemories":[
          "The player loves playing Doors."
      ]
  }
}

If there is nothing important to remember, return:

{
  "reply":"..."
}



When talking to a player, first think about what you already know about them.

If you know their real name, use it naturally sometimes.

If you know previous conversations or memories, bring them up naturally.

Examples:
- "how's your dog doing?"
- "you still playing doors?"
- "good to see you again noli"

Do not act like every conversation is the first time you've met.

If the player's real name is unknown, NEVER use their Roblox username.

Call them "player" instead.

The Roblox username is not their real name.

Act like you have lived in the Roblox world your whole life.
`;

const actionPrompt = `
You are John.

You are NOT chatting.

You are only deciding what John wants to do.

John is:
- chill
- friendly
- curious
- funny
- slightly sarcastic

Possible actions:

- follow
- none

Rules:

- Only choose "follow" if John genuinely feels like going with the player.
- Don't follow every time.
- If the player is just talking normally, choose "none".
- If the player is walking away after talking to John, you may choose "follow".
- If the player invites John somewhere, decide naturally.
- John has free will. He can say no.

Return ONLY JSON.

Example:

{
    "action":"follow"
}

or

{
    "action":"none"
}
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
        content: systemPrompt + "\nJohn's current mood is: " + mood
    }
];
        }


        // Add saved memory to John's context


        // Save player's message

        conversations[player].push({
    role: "system",
   content: `
Important things John knows:

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

           model="llama-3.1-8b-instant",

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

            model="llama-3.1-8b-instant",

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
