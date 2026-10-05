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
        console.log(`[2/3] Otrzymano tekst od AI:`, aiOutput);

        let aiParams;
        try {
            const cleanJson = typeof aiOutput === 'string'
                ? aiOutput.replace(/```json/g, '').replace(/```/g, '').trim()
                : aiOutput;
            aiParams = typeof cleanJson === 'string' ? JSON.parse(cleanJson) : cleanJson;
        } catch (e) {
            console.error('Błąd parsowania JSON od AI, używam fallbacku:', e.message);
            aiParams = { genre: 'rock', mood: 'sad', tempo: 'slow' };
        }
        const searchTags = `${aiParams.genre}+${aiParams.mood}+${aiParams.tempo}`;
        console.log(`[3/3] Szukam w Jamendo utworów z fuzzytags: "${searchTags}"...`);

        const jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=5&fuzzytags=${searchTags}&audioformat=mp32&include=musicinfo`;

        const jamendoResponse = await fetch(jamendoUrl);
        if (!jamendoResponse.ok) {
            console.error(`Błąd Jamendo API: ${jamendoResponse.status} - ${jamendoResponse.statusText}`);
            return res.status(jamendoResponse.status).json({ error: 'Błąd w odpowiedzi Jamendo API' });
        }
        const jamendoData = await jamendoResponse.json();
        const tracks = jamendoData.results.map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artist_name,
            audio: track.audio,
            image: track.image,
        }));
        if(tracks.length === 0) {
            console.warn('Nie znaleziono utworów w Jamendo dla podanych parametrów AI.');
            return res.status(404).json({ error: 'Nie znaleziono utworów w Jamendo dla podanych parametrów AI.' });
        }
        res.json({
            aiParams,
            tracks
        });
    } catch (error) {
        console.error('Błąd ogólny serwera:', error.message);
        res.status(500).json({ error: 'Wystąpił błąd podczas przetwarzania żądania.', details: error.message });
    }
});

app.get('/', (req, res) => {
    res.send(`Backend VibeTape działa na porcie: ${PORT}`);
});

app.listen(PORT, () => {
    console.log(`Serwer uruchomiony, sprawdź http://localhost:${PORT}`);
});