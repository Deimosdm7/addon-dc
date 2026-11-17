const axios = require('axios');

let cached = null;
let cachedAt = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000;

const DEFAULT_COMPANY_IDS = '184898,128064';

function normalize(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toCatalogItem(item, type) {
  const date = type === 'movie' ? item.release_date : item.first_air_date;

  return {
    id: `dc_${type === 'tv' ? 'tv' : 'movie'}_tmdb_${item.id}`,
    type: type === 'tv' ? 'series' : 'movie',
    name: item.title || item.name,
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
    background: item.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
      : null,
    description: item.overview || 'Sem descrição disponível.',
    releaseInfo: date ? date.slice(0, 4) : '',
    genres: []
  };
}

async function discover(apiKey, type, today, companyIds) {
  try {
    const response = await axios.get(`https://api.themoviedb.org/3/discover/${type}`, {
      params: {
        api_key: apiKey,
        language: 'pt-BR',
        with_companies: companyIds,
        include_adult: false,
        sort_by: type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
        'primary_release_date.lte': type === 'movie' ? today : undefined,
        'first_air_date.lte': type === 'tv' ? today : undefined
      }
    });

    return (response.data.results || [])
      .filter(item => {
        const date = type === 'movie' ? item.release_date : item.first_air_date;
        return date && date <= today;
      })
      .map(item => toCatalogItem(item, type));
  } catch (error) {
    console.error(`Erro ao buscar filmes/séries da DC no TMDb (${type}):`, error.message);
    return [];
  }
}

async function searchExtra(apiKey, entry, today) {
  try {
    const response = await axios.get(`https://api.themoviedb.org/3/search/${entry.type}`, {
      params: {
        api_key: apiKey,
        language: 'pt-BR',
        query: entry.title,
        include_adult: false
      }
    });

    const item = (response.data.results || []).find(result =>
      normalize(result.title || result.name) === normalize(entry.title)
    );

    if (!item) return null;

    const date = entry.type === 'movie' ? item.release_date : item.first_air_date;

    if (!date || date > today) return null;

    return toCatalogItem(item, entry.type);
  } catch (error) {
    console.error(`Erro ao buscar ${entry.title} no TMDb:`, error.message);
    return null;
  }
}

async function getDcuUniverse(apiKey) {
  if (!apiKey) throw new Error('TMDB_API_KEY não configurada.');
  if (cached && Date.now() - cachedAt < CACHE_DURATION) return cached;

  const today = new Date().toISOString().slice(0, 10);
  const companyIds = process.env.DCU_COMPANY_IDS || DEFAULT_COMPANY_IDS;

  const extras = [
    { title: 'Peacemaker', type: 'tv' },
    { title: 'Creature Commandos', type: 'tv' }
  ];

  const [movies, series, extraResults] = await Promise.all([
    discover(apiKey, 'movie', today, companyIds),
    discover(apiKey, 'tv', today, companyIds),
    Promise.all(extras.map(entry => searchExtra(apiKey, entry, today)))
  ]);

  const unique = new Map();

  [...movies, ...series, ...extraResults.filter(Boolean)].forEach(item => {
    unique.set(item.id, item);
  });

  cached = Array.from(unique.values()).sort((a, b) => {
    const dateA = a.releaseInfo || '';
    const dateB = b.releaseInfo || '';
    return dateB.localeCompare(dateA);
  });

  cachedAt = Date.now();
  return cached;
}

module.exports = getDcuUniverse;
