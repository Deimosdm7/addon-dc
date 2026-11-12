const axios = require('axios');

let cached = null;
let cachedAt = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000;

async function getNewDcReleases(apiKey) {
    if (!apiKey) throw new Error('TMDB_API_KEY não configurada.');
    if (cached && Date.now() - cachedAt < CACHE_DURATION) return cached;

    const keywordNames = ['DC Comics', 'DC Universe'];
    const keywordResults = await Promise.all(keywordNames.map(name =>
        axios.get('https://api.themoviedb.org/3/search/keyword', {
            params: { api_key: apiKey, query: name }
        })
    ));
    const keywordIds = [...new Set(keywordResults.flatMap(response =>
        (response.data.results || [])
            .filter(item => item.name.toLowerCase() === 'dc comics' || item.name.toLowerCase() === 'dc universe')
            .map(item => item.id)
    ))];

    if (!keywordIds.length) throw new Error('Não foi possível localizar as palavras-chave da DC no TMDb.');

    const dateFrom = new Date();
    dateFrom.setMonth(dateFrom.getMonth() - 18);
    const dateString = dateFrom.toISOString().slice(0, 10);
    const keywordFilter = keywordIds.join('|');

    const [movies, shows] = await Promise.all([
        axios.get('https://api.themoviedb.org/3/discover/movie', {
            params: {
                api_key: apiKey, language: 'pt-BR', sort_by: 'primary_release_date.desc',
                'primary_release_date.gte': dateString, with_keywords: keywordFilter,
                include_adult: false, page: 1
            }
        }),
        axios.get('https://api.themoviedb.org/3/discover/tv', {
            params: {
                api_key: apiKey, language: 'pt-BR', sort_by: 'first_air_date.desc',
                'first_air_date.gte': dateString, with_keywords: keywordFilter,
                page: 1
            }
        })
    ]);

    const toMeta = (item, type) => ({
        id: `dc_${type}_tmdb_${item.id}`,
        type: type === 'tv' ? 'series' : 'movie',
        name: item.title || item.name,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        background: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        description: item.overview || 'Sem descrição disponível.',
        releaseInfo: (item.release_date || item.first_air_date || '').slice(0, 4),
        genres: []
    });

    const combined = [
        ...(movies.data.results || []).map(item => toMeta(item, 'movie')),
        ...(shows.data.results || []).map(item => toMeta(item, 'tv'))
    ];

    cached = combined
        .filter(item => item.name && item.poster)
        .sort((a, b) => (b.releaseInfo || '').localeCompare(a.releaseInfo || ''))
        .slice(0, 40);
    cachedAt = Date.now();
    return cached;
}

module.exports = getNewDcReleases;
