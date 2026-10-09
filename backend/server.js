import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID;
const LANGFLOW_API_URL = process.env.LANGFLOW_API_URL;
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function extractAIParams(rawInput) {
    if (typeof rawInput === 'object' && rawInput !== null) {
        return {
            genre: rawInput.genre || 'rock',
            mood: rawInput.mood || 'sad',
            tempo: rawInput.tempo || 'slow'
        };
    }
    const text = String(rawInput);
    const genreMatch = text.match(/"genre"\s*:\s*"([^"\r\n]+)"/i);
    const moodMatch = text.match(/"mood"\s*:\s*"([^"\r\n]+)"/i);
    const tempoMatch = text.match(/"tempo"\s*:\s*"([^"\r\n]+)"/i);
    return {
        genre: genreMatch ? genreMatch[1].trim() : 'lofi',
        mood: moodMatch ? moodMatch[1].trim() : 'sad',
        tempo: tempoMatch ? tempoMatch[1].trim() : 'slow'
    };
}

app.post('/api/recommend', async (req, res) => {
    try {
        const { userPrompt } = req.body;

        if (!userPrompt) {
            return res.status(400).json({ error: 'Brak opisu nastroju.' });
        }

        console.log(`[1/3] Przekazuję opis: "${userPrompt}" do Langflow API...`);
        const aiResponse = await fetch(LANGFLOW_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': LANGFLOW_API_KEY,
            },
            body: JSON.stringify({
                output_type: 'chat',
                input_type: 'chat',
                input_value: userPrompt,
            })
        });

        if (!aiResponse.ok) {
            console.error(`Błąd Langflow API: ${aiResponse.status} - ${aiResponse.statusText}`);
            return res.status(aiResponse.status).json({ error: 'Błąd w odpowiedzi Langflow API' });
        }

        const aiData = await aiResponse.json();
        const aiOutput = aiData.outputs[0].outputs[0].results.message.data.text;
        console.log(`[2/3] Otrzymano surowy tekst od AI:\n`, aiOutput);
        const aiParams = extractAIParams(aiOutput);
        console.log('[DEBUG] Pomyślnie wyciągnięte parametry:', aiParams);
        let searchTags = `${aiParams.genre}+${aiParams.mood}+${aiParams.tempo}`;
        console.log(`[3/3] Szukam w Jamendo utworów z tagami: "${searchTags}"...`);
        let jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=50&fuzzytags=${encodeURIComponent(searchTags)}&audioformat=mp32`;

        let jamendoResponse = await fetch(jamendoUrl);
        let jamendoData = await jamendoResponse.json();
        let rawResults = jamendoData.results || [];
        if (rawResults.length === 0) {
            searchTags = `${aiParams.genre}+${aiParams.mood}`;
            console.warn(`Brak utworów dla 3 tagów. Próbuję: "${searchTags}"...`);
            jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=50&fuzzytags=${encodeURIComponent(searchTags)}&audioformat=mp32`;
            jamendoResponse = await fetch(jamendoUrl);
            jamendoData = await jamendoResponse.json();
            rawResults = jamendoData.results || [];
        }
        if (rawResults.length === 0) {
            console.warn(`Nadal brak. Szukam po samym gatunku: "${aiParams.genre}"...`);
            jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=50&tags=${encodeURIComponent(aiParams.genre)}&audioformat=mp32`;
            jamendoResponse = await fetch(jamendoUrl);
            jamendoData = await jamendoResponse.json();
            rawResults = jamendoData.results || [];
        }

        const tracks = rawResults.map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artist_name,
            audio: track.audio,
            image: track.image,
        }));

        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }

        const randomTracks = tracks.slice(0, 10);

        if (randomTracks.length === 0) {
            return res.status(404).json({ error: 'Nie znaleziono utworów w bazie Jamendo.' });
        }

        res.json({
            aiParams,
            randomTracks
        });

    } catch (error) {
        console.error('Błąd serwera:', error.message);
        res.status(500).json({ error: 'Błąd serwera', details: error.message });
    }
});

app.get('/', (req, res) => {
    res.send(`Backend VibeTape działa na porcie: ${PORT}`);
});

app.listen(PORT, () => {
    console.log(`Serwer uruchomiony, sprawdź http://localhost:${PORT}`);
});