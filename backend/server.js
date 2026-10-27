import express, { raw } from 'express';
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
            genre: rawInput.genre || 'pop',
            mood: rawInput.mood || 'happy',
            vocalinstrumental: rawInput.vocalinstrumental || 'vocal',
            acousticelectric: rawInput.acousticelectric || 'electric'
        };
    }
    const text = String(rawInput);
    const genreMatch = text.match(/"genre"\s*:\s*"([^"\r\n]+)"/i);
    const moodMatch = text.match(/"mood"\s*:\s*"([^"\r\n]+)"/i);
    const vocalMatch = text.match(/"vocalinstrumental"\s*:\s*"([^"\r\n]+)"/i);
    const acousticMatch = text.match(/"acousticelectric"\s*:\s*"([^"\r\n]+)"/i);
    return {
        genre: genreMatch ? genreMatch[1].trim() : 'indie',
        mood: moodMatch ? moodMatch[1].trim() : 'chill',
        vocalinstrumental: vocalMatch ? vocalMatch[1].trim() : 'vocal',
        acousticelectric: acousticMatch ? acousticMatch[1].trim() : 'electric'
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
        console.log(`[2/3] Otrzymano tekst od AI:`, aiOutput);
        const aiParams = extractAIParams(aiOutput);
        console.log('[DEBUG] Parametry docelowe:', aiParams);
        console.log(`[3/3] Szukam w Jamendo utworów z weryfikacją brzmienia...`);
        const searchTags = `${aiParams.genre}+${aiParams.mood}`;
        let jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=40&fuzzytags=${encodeURIComponent(searchTags)}&vocalinstrumental=${aiParams.vocalinstrumental}&acousticelectric=${aiParams.acousticelectric}&include=musicinfo&audioformat=mp32&boost=popularity_month`;
        let jamendoResponse = await fetch(jamendoUrl);
        let jamendoData = await jamendoResponse.json();
        let rawResults = jamendoData.results || [];
        if (rawResults.length === 0) {
            console.warn(`Brak wyników z filtrami vocal/acoustic. Szukam po samym fuzzytags: "${searchTags}"...`);
            jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=40&fuzzytags=${encodeURIComponent(searchTags)}&include=musicinfo&audioformat=mp32&boost=popularity_month`;
            jamendoResponse = await fetch(jamendoUrl);
            jamendoData = await jamendoResponse.json();
            rawResults = jamendoData.results || [];
        }
        if (rawResults.length === 0) {
            console.warn(`Nadal brak utworów. Szukam po nastroju: "${aiParams.mood}"...`);
            jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=40&fuzzytags=${encodeURIComponent(aiParams.mood)}&include=musicinfo&audioformat=mp32&boost=popularity_month`;
            jamendoResponse = await fetch(jamendoUrl);
            jamendoData = await jamendoResponse.json();
            rawResults = jamendoData.results || [];
        }
        if (rawResults.length === 0) {
            return res.status(404).json({ error: 'Nie znaleziono pasujących utworów w bazie Jamendo.' });
        }
        const conflictingTagsMap = {
            sad: ['happy', 'party', 'dance', 'fun', 'upbeat', 'festive', 'energetic', 'joy'],
            calm: ['aggressive', 'hard', 'metal', 'heavy', 'fast', 'action', 'epic', 'punchy'],
            relaxing: ['screaming', 'loud', 'heavy', 'metal', 'distorted', 'angry', 'hardcore'],
            melancholic: ['happy', 'party', 'dance', 'club', 'celebration', 'summer'],
            chill: ['fast', 'hard', 'heavy', 'intense', 'screaming'],
            energetic: ['sleep', 'lullaby', 'slow', 'sad', 'meditation', 'depressive'],
            dark: ['happy', 'cute', 'cheerful', 'bright', 'sweet', 'sunshine', 'kids']
        };

        const blacklistedTags = conflictingTagsMap[aiParams.mood.toLowerCase()] || [];

        const scoredTracks = rawResults.map(track => {
            let score = 0;
            const info = track.musicinfo || {};
            const trackTags = [
                ...(info.tags?.genres || []),
                ...(info.tags?.vartags || []),
                ...(info.tags?.instruments || [])
            ].map(t => String(t).toLowerCase());
            if (trackTags.includes(aiParams.mood.toLowerCase())) score += 5;
            if (trackTags.includes(aiParams.genre.toLowerCase())) score += 3;
            if (info.acousticelectric === aiParams.acousticelectric) score += 2;
            if (info.vocalinstrumental === aiParams.vocalinstrumental) score += 2;
            const hasConflict = blacklistedTags.some(tag => trackTags.includes(tag));
            if (hasConflict) score -= 15;

            return { track, score };
        });
        const validTracks = scoredTracks
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.track);

        console.log(`Audyt brzmienia: ${rawResults.length} pobranych -> ${validTracks.length} spełnia kryteria jakości.`);
        const finalPool = validTracks.length >= 5 ? validTracks : rawResults;
        const topConsistentPool = finalPool.slice(0, 15);
        for (let i = topConsistentPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [topConsistentPool[i], topConsistentPool[j]] = [topConsistentPool[j], topConsistentPool[i]];
        }
        const randomTracks = topConsistentPool.slice(0, 5).map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artist_name,
            audio: track.audio,
            image: track.image,
        }));

        res.json({
            aiParams,
            randomTracks
        });

    } catch (error) {
        console.error('Błąd ogólny serwera:', error.message);
        res.status(500).json({ error: 'Wystąpił błąd podczas przetwarzania żądania.', details: error.message });
    }
});
app.post('/api/artist', async (req, res) => {
    const { artistName } = req.body;

    if (!artistName || artistName.trim().length === 0) {
        return res.status(400).json({ error: 'Nazwa artysty jest pusta' });
    }

    const artistNameEncoded = encodeURIComponent(artistName);
    const jamendoApiUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=50&artist_name=${artistNameEncoded}&audioformat=mp32`;

    try {
        const response = await fetch(jamendoApiUrl);
        const data = await response.json();
        const rawResults = data.results || [];
        if(typeof(rawResults) === 'undefined' || rawResults.length === 0){
            return res.status(404).json({ error: 'Nie znaleziono utworów dla podanego artysty' });
        }
        const tracks = rawResults.map((track) => ({
            id: track.id,
            name: track.name,
            artist: track.artist_name,
            audio: track.audio,
            image: track.image,
        }));
        for(let i = tracks.length-1; i>=0;i--){
            var randomNumber = Math.floor(Math.random()*(i+1))
            var temp = tracks[i]
            tracks[i] = tracks[randomNumber]
            tracks[randomNumber] = temp
        }
        var slicedTracks = tracks.slice(0,5)
        return res.json({slicedTracks});
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Błąd pobierania artysty' });
    }
});

app.get('/', (req, res) => {
    res.send(`Backend VibeTape działa na porcie: ${PORT}`);
});

app.listen(PORT, () => {
    console.log(`Serwer uruchomiony, sprawdź http://localhost:${PORT}`);
});