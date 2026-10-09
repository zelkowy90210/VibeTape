import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/recommend';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';

  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [tracks, setTracks] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef(null);
  const activeTrack = tracks[activeTrackIndex] ?? null;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(API_URL, {
        userPrompt: prompt.trim(),
      });

      setTracks(response.data.randomTracks ?? []);
      setAnalysis(response.data.analysis ?? response.data.aiParams ?? null);
      setActiveTrackIndex(0);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);

      if (!response.data.randomTracks?.length) {
        setError('Nie znaleziono utworów. Spróbuj opisać nastrój inaczej.');
      }
    } catch (requestError) {
      console.error('Nie udało się pobrać utworów:', requestError);
      setError('Nie udało się pobrać muzyki. Sprawdź, czy backend działa.');
      setTracks([]);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeTrack) return;

    audio.load();
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [activeTrackIndex, tracks, activeTrack]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function handleSeek(event) {
    const newTime = Number(event.target.value);

    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }

    setCurrentTime(newTime);
  }

  function playNextTrack() {
    if (activeTrackIndex < tracks.length - 1) {
      setActiveTrackIndex((index) => index + 1);
    } else {
      setIsPlaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090910] px-4 py-8 text-gray-100 sm:px-8">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Pirata+One&display=swap');
        @keyframes vinyl-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="font-['Pirata_One',serif] inline-block cursor-default text-5xl leading-none tracking-wide text-white sm:text-6xl">
              Vibe<span className="text-[#e0245e]">Tape</span>
            </h1>
            <p className="mt-2 text-[11px] uppercase tracking-[0.25em] text-[#9a95b0]">
              // Twój inteligentny kurator muzyki
            </p>
          </div>

          <p className="text-sm text-gray-400" role="status" aria-live="polite">
            {loading ? 'Szukam muzyki…' : isPlaying ? 'Odtwarzanie' : 'Gotowy'}
          </p>
        </header>

        <main className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="space-y-6">
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <label htmlFor="mood" className="mb-3 block text-sm font-medium">
                Na co masz dziś ochotę?
              </label>

              <textarea
                id="mood"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Np. spokojna muzyka na wieczór przy książce…"
                rows={4}
                className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none transition focus:border-pink-500"
              />

              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="mt-3 w-full rounded-lg bg-pink-600 px-4 py-3 text-sm font-semibold transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Szukam…' : 'Znajdź muzykę'}
              </button>

              {error && (
                <p className="mt-3 text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}
            </form>

            {analysis && (
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="mb-3 font-semibold">Rozpoznany klimat</h2>
                <dl className="space-y-2 text-sm">
                  {[
                    ['Gatunek', analysis.genre],
                    ['Nastrój', analysis.mood],
                    ['Brzmienie', analysis.acousticelectric],
                    ['Tempo', analysis.tempo],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <dt className="text-gray-400">{label}</dt>
                        <dd className="text-right">{value}</dd>
                      </div>
                    ))}
                </dl>
              </section>
            )}
          </section>

          <section
            className="flex min-h-80 flex-col justify-center rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
            aria-label="Odtwarzacz"
          >
            {activeTrack ? (
              <>
                <audio
                  ref={audioRef}
                  src={activeTrack.audio}
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
                  onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={playNextTrack}
                />

                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <div className="relative h-48 w-48 shrink-0" aria-label={`Płyta gramofonowa: ${activeTrack.name}`} role="img">
                    <div
                      className="absolute inset-1 rounded-full border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
                      style={{
                        animation: isPlaying ? 'vinyl-spin 5s linear infinite' : 'none',
                        backgroundImage: 'radial-gradient(circle, transparent 0 25%, rgba(255,255,255,0.10) 25.5%, transparent 26%, transparent 32%, rgba(255,255,255,0.08) 32.5%, transparent 33%, transparent 40%, rgba(255,255,255,0.08) 40.5%, transparent 41%, transparent 48%, rgba(255,255,255,0.07) 48.5%, transparent 49%, transparent 56%, rgba(255,255,255,0.07) 56.5%, transparent 57%, transparent 64%, rgba(255,255,255,0.06) 64.5%, transparent 65%), repeating-radial-gradient(circle at center, #09090d 0px, #171720 2px, #09090d 4px, #11111a 6px)',
                      }}
                    >
                      <div className="absolute inset-[29%] overflow-hidden rounded-full border-4 border-[#272733] shadow-inner">
                        <img
                          src={activeTrack.image}
                          alt={`Okładka: ${activeTrack.name}`}
                          className="h-full w-full rounded-full object-cover"
                        />
                      </div>
                      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-500 bg-[#08080b]" />
                    </div>
                    <div aria-hidden="true" className="absolute -right-1 top-1 h-20 w-5 rotate-[18deg]">
                      <span className="absolute right-2 top-0 h-4 w-4 rounded-full border-2 border-gray-500 bg-gray-800 shadow" />
                      <span className="absolute right-[9px] top-3 h-14 w-[3px] rounded-full bg-gradient-to-b from-gray-300 via-gray-500 to-gray-700" />
                      <span className="absolute right-[5px] top-[58px] h-3 w-2 rotate-12 rounded-sm bg-gray-400" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="mb-2 text-xs uppercase tracking-widest text-pink-400">
                      Teraz odtwarzane
                    </p>
                    <h2 className="break-words text-xl font-bold">{activeTrack.name}</h2>
                    <p className="mt-1 text-sm text-gray-400">{activeTrack.artist}</p>

                    <button
                      type="button"
                      onClick={togglePlay}
                      className="mt-5 rounded-lg bg-pink-600 px-6 py-2.5 text-sm font-semibold hover:bg-pink-500"
                    >
                      {isPlaying ? 'Pauza' : 'Odtwórz'}
                    </button>
                  </div>
                </div>

                <div className="mt-7">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={Math.min(currentTime, duration || 0)}
                    onChange={handleSeek}
                    disabled={!duration}
                    aria-label="Pozycja w utworze"
                    className="w-full accent-pink-500 disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="text-xl font-semibold">Czas na muzykę</p>
                <p className="mt-2 text-sm text-gray-400">
                  Opisz swój nastrój, a znajdziemy coś dla Ciebie.
                </p>
              </div>
            )}
          </section>
        </main>

        {tracks.length > 0 && (
          <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 font-semibold">Znalezione utwory ({tracks.length})</h2>
            <ul className="divide-y divide-white/10">
              {tracks.map((track, index) => {
                const isActive = index === activeTrackIndex;

                return (
                  <li key={track.id}>
                    <button
                      type="button"
                      onClick={() => setActiveTrackIndex(index)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/5 ${
                        isActive ? 'text-pink-400' : 'text-gray-100'
                      }`}
                    >
                      <img
                        src={track.image}
                        alt=""
                        className="h-11 w-11 rounded-md object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{track.name}</span>
                        <span className="mt-1 block truncate text-xs text-gray-400">{track.artist}</span>
                      </span>
                      <span className="text-xs text-gray-400">
                        {isActive && isPlaying ? 'Odtwarzane' : isActive ? 'Wybrany' : 'Odtwórz'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <footer className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-gray-500">
          VibeTape
        </footer>
      </div>
    </div>
  );
}
