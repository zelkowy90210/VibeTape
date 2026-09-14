import express from 'express'
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config()

const app = express()
const PORT = 5000;
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send(`Backend dziala na porcie: ${PORT}`)
})
app.listen(PORT, () =>{
    console.log(`Serwer uruchomiony, sprawdz localhost:${PORT}`)
})
