import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);

  // Odtwarzacz
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const activeTrack = tracks[activeTrackIndex] || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/recommend', {
        userPrompt: prompt
      });

      if (response.data) {
        setAnalysis(response.data.analysis);
        setTracks(response.data.tracks || []);
        setActiveTrackIndex(0);
        setCurrentTime(0);
      }
    } catch (err) {
      console.error('Błąd pobierania utworów:', err);
    } finally {
      setLoading(false);
    }
  };

  // Automatyczny start muzyki po znalezieniu
  useEffect(() => {
    if (activeTrack && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [activeTrackIndex, tracks]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-[#d8dee9] flex flex-col justify-between p-6 sm:p-12 font-mono">
      
      {/* UKRYTE AUDIO */}
      {activeTrack && (
        <audio
          ref={audioRef}
          src={activeTrack.audio}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            if (activeTrackIndex < tracks.length - 1) {
              setActiveTrackIndex(prev => prev + 1);
            } else {
              setIsPlaying(false);
            }
          }}
        />
      )}

      {/* PROSTY, ELEGANCKI NAGŁÓWEK */}
      <header className="border-b border-[#22272e] pb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-white">VIBETAPE</h1>
          <p className="text-xs text-[#00ffa3] mt-1">Twój inteligentny kurator muzyki</p>
        </div>
        <div className="text-xs text-[#5e6773]">
          {loading ? 'Szukam utworu...' : isPlaying ? 'Odtwarzanie' : 'Gotowy'}
        </div>
      </header>

      {/* GŁÓWNA CZĘŚĆ STRONY */}
      <main className="my-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* LEWA STRONA: WYSZUKIWARKA I CECHY */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-xs text-[#5e6773]">
              Opisz swój nastrój, sytuację lub czego chcesz posłuchać:
            </label>
            <div className="flex flex-col sm:flex-row border border-[#22272e] bg-[#14171a] focus-within:border-[#00ffa3]">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="np. Spokojny wieczór przy książce..."
                className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-[#5e6773] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#00ffa3] text-black font-bold text-xs px-6 py-3 uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Szukam...' : 'Znajdź muzykę'}
              </button>
            </div>
          </form>

          {/* PARAMETRY ROZPOZNANE PRZEZ AI */}
          {analysis && (
            <div className="border border-[#22272e] bg-[#14171a] p-4 text-xs space-y-2">
              <span className="text-[#5e6773] block mb-2 border-b border-[#22272e] pb-1">Rozpoznany klimat:</span>
              <div className="flex justify-between">
                <span className="text-[#5e6773]">Gatunek:</span>
                <span className="text-[#00ffa3] uppercase font-bold">{analysis.genre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5e6773]">Nastrój:</span>
                <span className="text-white uppercase font-bold">{analysis.mood}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5e6773]">Brzmienie:</span>
                <span className="text-white uppercase font-bold">{analysis.acousticelectric}</span>
              </div>
            </div>
          )}
        </div>

        {/* PRAWA STRONA: OBRACAJĄCA SIĘ PŁYTA I ODTWARZACZ */}
        <div className="lg:col-span-7 flex flex-col sm:flex-row items-center gap-8 bg-[#14171a] border border-[#22272e] p-8">
          
          {activeTrack ? (
            <>
              {/* OBRACAJĄCY SIĘ WINYL */}
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0">
                <div 
                  className={`w-full h-full rounded-full border-4 border-[#22272e] bg-[#0b0c0e] relative flex items-center justify-center transition-all ${
                    isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{
                    animationDuration: '10s',
                    backgroundImage: 'radial-gradient(circle, #1a1d20 10%, #0b0c0e 11%, #1a1d20 25%, #0b0c0e 26%, #1a1d20 45%, #0b0c0e 46%, #1a1d20 70%, #0b0c0e 71%)'
                  }}
                >
                  {/* OKŁADKA NA ŚRODKU PŁYTY */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#22272e] relative z-10">
                    <img 
                      src={activeTrack.image} 
                      alt={activeTrack.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* DZIURKA W ŚRODKU PŁYTY */}
                  <div className="w-4 h-4 rounded-full bg-[#0b0c0e] border border-[#22272e] absolute z-20"></div>
                </div>
              </div>

              {/* DANE UTWORU I PASEK POSTĘPU */}
              <div className="flex-1 w-full">
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                  {activeTrack.name}
                </h2>
                <p className="text-xs text-[#00ffa3] mt-1">
                  {activeTrack.artist}
                </p>

                {/* PASEK CZASU I SUWAK */}
                <div className="my-6">
                  <div 
                    onClick={handleSeek}
                    className="w-full h-2 bg-[#0b0c0e] border border-[#22272e] cursor-pointer relative"
                  >
                    <div 
                      className="h-full bg-[#00ffa3] transition-all duration-75"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#5e6773] mt-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* PRZYCISK PLAY / PAUZA */}
                <button
                  onClick={togglePlay}
                  className="border border-[#22272e] bg-[#0b0c0e] px-6 py-2 text-xs font-bold uppercase hover:border-[#00ffa3] hover:text-[#00ffa3] transition-colors"
                >
                  {isPlaying ? 'Pauza' : 'Odtwórz'}
                </button>
              </div>
            </>
          ) : (
            <div className="w-full py-16 text-center text-xs text-[#5e6773]">
              Wpisz swój nastrój powyżej, aby odkryć muzykę.
            </div>
          )}

        </div>

      </main>

      {/* LISTA ZNALEZIONYCH UTWORÓW */}
      {tracks.length > 0 && (
        <section className="border border-[#22272e] bg-[#14171a] p-4">
          <div className="text-xs text-[#5e6773] mb-3 pb-2 border-b border-[#22272e]">
            Znalezione utwory ({tracks.length}):
          </div>
          <div className="divide-y divide-[#22272e] text-xs">
            {tracks.map((track, idx) => (
              <div
                key={track.id}
                onClick={() => setActiveTrackIndex(idx)}
                className={`py-3 px-2 flex justify-between items-center cursor-pointer transition-colors ${
                  activeTrackIndex === idx ? 'text-[#00ffa3] font-bold' : 'hover:text-white text-[#5e6773]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <span>0{idx + 1}.</span>
                  <span className="truncate">{track.name}</span>
                  <span className="text-[#5e6773] truncate">– {track.artist}</span>
                </div>
                <span>{activeTrackIndex === idx && isPlaying ? 'Odtwarzane' : 'Wybierz'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <footer className="mt-8 pt-4 border-t border-[#22272e] text-[11px] text-[#5e6773] text-center">
        VibeTape – Jakub Lewkowicz
      </footer>

    </div>
  );
}