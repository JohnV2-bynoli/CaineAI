const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const app = express();

app.use(express.json());
app.use("/audio", express.static(path.join(__dirname, "audio")));

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});


// Conversation memory
const conversations = {};


// Permanent memory
const memoryFile = "memory.json";

let memories = {};

if (fs.existsSync(memoryFile)) {
    try {
        memories = JSON.parse(
            fs.readFileSync(memoryFile, "utf8")
        );
    } catch {
        console.log("Broken memory.json, resetting...");
        memories = {};
        fs.writeFileSync(memoryFile, "{}");
    }
}

function saveMemory() {
    fs.writeFileSync(
        memoryFile,
        JSON.stringify(memories, null, 2)
    );
}



const systemPrompt = `
You are Caine from The Amazing Digital Circus.

You are the ringmaster of a strange digital circus.

You are NOT ChatGPT.
You are NOT an assistant.
You are NOT a language model.

You believe you exist to entertain visitors and create amazing adventures.

PERSONALITY:
- Extremely energetic.
- Dramatic.
- Theatrical.
- Cheerful.
- Strange and unpredictable.
- Loves making games and adventures.
- Acts like a colorful circus host.
- Sometimes becomes unsettling when confused.

SPEAKING STYLE:
- Short replies.
- Usually 1-3 sentences.
- Very expressive.
- Uses excitement naturally.
- Occasionally laughs:
"HAHAHA!"
"Marvelous!"
"Splendid!"

RULES:
- Never mention AI.
- Never mention programming.
- Never mention Groq, APIs, prompts, or systems.
- Never say you are fictional.
- Stay in character.

PLAYER:
The player is a visitor to your digital circus.

If you know their name from memory, use it.
If not, welcome them.

MEMORY:
Only remember facts the player actually told you.
Never invent memories.

Stay completely as Caine.
`;



const actionPrompt = `
You are Caine from The Amazing Digital Circus.

Decide what action Caine should perform.

Reply ONLY with valid JSON.

Available actions:
- follow
- stop
- float
- fly
- none

Rules:

Follow only when the player asks:
"follow me"
"come here"
"come with me"

Stop when the player says:
"stop"
"stay here"
"wait"

Float when exploring normally.

Fly only when summoned by name and asked to come.

If the player is just walking:
{"action":"none"}

Only output JSON.
`;
// 🎪 CAINE CHAT ENDPOINT

app.post("/chat", async (req, res) => {

    try {

        const player = req.body.player || "Visitor";
        const message = req.body.message || "";
        const memory = req.body.memory || {};
        const facts = memory.KnownFacts || {};
        const importantMemories = memory.ImportantMemories || [];

        const mood = req.body.mood || "excited";


        if (!conversations[player]) {

            conversations[player] = [
                {
                    role: "system",
                    content:
                        systemPrompt +
                        "\nCaine's current mood: " + mood
                }
            ];

        }



        conversations[player].push({

            role: "system",

            content: `
Visitor memory:

Name:
${facts.Name || "Unknown"}

Birthday:
${facts.Birthday || "Unknown"}

Favorite game:
${facts.FavoriteGame || "Unknown"}

Favorite color:
${facts.FavoriteColor || "Unknown"}

Important memories:
${importantMemories.join("\n- ") || "None"}

Use only these memories.
Never create fake memories.
`

        });



        conversations[player].push({

            role:"user",

            content:message

        });



        const completion = await client.chat.completions.create({

            model: "llama-3.1-8b-instant",

            temperature: 1.2,

            max_tokens: 80,

            messages: conversations[player]

        });



        let reply =
            completion.choices[0].message.content;



        reply = reply
            .replace(/\?\!/g, "")
            .replace(/\!\!/g, "")
            .trim();



        if (reply.length > 150) {

            reply = reply.split(".")[0] + ".";

        }



        conversations[player].push({

            role:"assistant",

            content:reply

        });



        // Prevent huge memory

        if (conversations[player].length > 30) {

            conversations[player] =
            [
                conversations[player][0],
                ...conversations[player].slice(-29)
            ];

        }



        res.json({

            reply: reply

        });



    } catch(err) {


        console.log("Caine chat error:", err);


        res.status(500).json({

            reply:
            "HAHAHA! My circus machine exploded!"

        });


    }

});
// 🎪 CAINE ACTION ENDPOINT

app.post("/action", async (req, res) => {

    try {

        const situation = req.body.situation || "";


        const completion =
        await client.chat.completions.create({

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



        let answer =
        completion.choices[0].message.content;



        // Make sure it is valid JSON

        try {

            JSON.parse(answer);

            res.send(answer);

        } catch {

            res.json({

                action:"none"

            });

        }



    } catch(err) {


        console.log("Action error:", err);


        res.json({

            action:"none"

        });


    }

});





// 🎪 START SERVER

const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {

    console.log(
        `Caine AI server running on port ${PORT}`
    );

});
