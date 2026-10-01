import express from 'express'
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config()

const app = express()
const PORT = 5000;
const CLIENT_ID = process.env.JAMENDO_CLIENT_ID
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.get('/', (req, res) => {
    res.send(`Backend dziala na porcie: ${PORT}`)
})
app.post('/api/get-song', async (req,res) => {
    try{
        const gatunek = req.body.gatunek
        const clientId = process.env.JAMENDO_CLIENT_ID;
        const jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&tags=${gatunek}`
        console.log("Działa")
        const reponse = await fetch(jamendoUrl)
        const data = await reponse.json();
        const track = data.results[0]
        res.json({
            song:{
                title: track.name,
                artist: track.artist_name
            }
        })
        console.log(`Znalazłem utwór: ${track.name}`)

    }
    catch(err){
        console.log(`Error o nazwie: ${err}`)
        res.status(500).json({error: "Błąd serwera"})
    }
})
app.listen(PORT, () =>{
    console.log(`Serwer uruchomiony, sprawdz localhost:${PORT}`)
})
app.post('/search', async (req, res) => {
    const {query} = req.body;
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}&format=json&limit=10&tags=${query}`;
    const response = await fetch(url)
    if(!response.ok){
        throw new Error(`Error: ${response.status}`)
    }
    const data = await response.json()
    res.json(data.results[0].name)
})