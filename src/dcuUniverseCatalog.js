const axios = require('axios');

let cached = null;
let cachedAt = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000;

// Somente produções da continuidade principal do novo DCU.
const titles = [
  { title: 'Creature Commandos', type: 'tv' },
  { title: 'Superman', type: 'movie' },
  { title: 'Peacemaker', type: 'tv' },
  { title: 'Supergirl', type: 'movie' },
  { title: 'Lanterns', type: 'tv' },
  { title: 'Clayface', type: 'movie' },
  { title: 'Man of Tomorrow', type: 'movie' },
  { title: 'The People v. Gorilla Grodd', type: 'tv' },
  { title: 'Mister Miracle', type: 'tv' }
];

function normalize(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function getDcuUniverse(apiKey) {
  if (!apiKey) throw new Error('TMDB_API_KEY não configurada.');
  if (cached && Date.now() - cachedAt < CACHE_DURATION) return cached;

  const results = await Promise.all(titles.map(async entry => {
    const response = await axios.get(`https://api.themoviedb.org/3/search/${entry.type}`, {
      params: { api_key: apiKey, language: 'pt-BR', query: entry.title, include_adult: false }
    });
    const item = (response.data.results || []).find(result =>
      normalize(result.title || result.name) === normalize(entry.title)
    );
    if (!item) return null;

    const date = item.release_date || item.first_air_date || '';
    return {
      id: `dc_${entry.type}_tmdb_${item.id}`,
      type: entry.type === 'tv' ? 'series' : 'movie',
      name: item.title || item.name,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      background: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
      description: item.overview || 'Sem descrição disponível.',
      releaseInfo: date.slice(0, 4),
      genres: []
    };
  }));

  cached = results.filter(Boolean).sort((a, b) =>
    (b.releaseInfo || '').localeCompare(a.releaseInfo || '')
  );
  cachedAt = Date.now();
  return cached;
}

module.exports = getDcuUniverse;
