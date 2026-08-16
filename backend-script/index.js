import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Error: Faltan las credenciales de Supabase en el archivo .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);


const ARTISTS_CATALOG = [
    { name: 'BTS', slug: 'bts', category: 'group', theme_palette: 'borahae-purple', spotifyId: '3Nrfpe0tUJi4K4DXYWgMUX' },
    { name: 'RM', slug: 'rm', category: 'solo', theme_palette: 'indigo-earth', spotifyId: '2auC28zjQyVTsiZKNgPRGs' },
    { name: 'Jin', slug: 'jin', category: 'solo', theme_palette: 'pink-silver', spotifyId: '5vV3bFXnN6D6N3Nj4xRvaV' },
    { name: 'Agust D', slug: 'agust-d', category: 'solo', theme_palette: 'tangerine-neon', spotifyId: '5RmQ8k4l3HZ8JoPb4mNsML' },
    { name: 'j-hope', slug: 'j-hope', category: 'solo', theme_palette: 'bright-red', spotifyId: '0b1sIQumIAsNbqAoIClSpy' },
    { name: 'Jimin', slug: 'jimin', category: 'solo', theme_palette: 'soft-yellow', spotifyId: '1oSPZhvZMIrWW5I41kPkkY' },
    { name: 'V', slug: 'v', category: 'solo', theme_palette: 'vintage-green', spotifyId: '3JsHnjpbhX4SnySpvpa9DK' },
    { name: 'Jung Kook', slug: 'jung-kook', category: 'solo', theme_palette: 'golden-black', spotifyId: '6HaGTQPmzraVmaVxvz6EUc' }
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getSpotifyAccessToken() {
    const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    if (!data.access_token) throw new Error("No se pudo obtener el token de Spotify.");
    return data.access_token;
}

async function fetchSpotifyURL(url, token) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    
    if (res.status === 429) {
        console.warn("\n Límite de velocidad. Esperando para reintentar...");
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? (parseInt(retryAfter) * 1000) : 5000;
        await delay(waitTime);
        return fetchSpotifyURL(url, token); 
    }

    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`\nStatus: ${res.status}\nRazón de Spotify: ${errorBody}`);
    }
    
    return await res.json();
}

async function syncArtistAndSongs(artistMeta, token) {
    console.log(`\n Sincronizando: ${artistMeta.name}...`);

    const { data: artistRecord, error: artistErr } = await supabase
        .from('artists')
        .upsert({
            name: artistMeta.name,
            slug: artistMeta.slug,
            category: artistMeta.category,
            theme_palette: artistMeta.theme_palette
        }, { onConflict: 'slug' })
        .select()
        .single();

    if (artistErr) {
        console.error(`Error al registrar artista:`, artistErr.message);
        return;
    }

    // market=MX para evitar duplicados por región
    let nextAlbumUrl = `https://api.spotify.com/v1/artists/${artistMeta.spotifyId}/albums?include_groups=album,single,appears_on&market=MX`;

    while (nextAlbumUrl) {
        const albumsData = await fetchSpotifyURL(nextAlbumUrl, token);
        await delay(1000); 

        for (const album of albumsData.items) {
            const releaseYear = album.release_date ? parseInt(album.release_date.split('-')[0]) : null;
            
            // Extraer la portada del álbum (tomamos la de mayor resolución, índice 0)
            const coverUrl = album.images && album.images.length > 0 ? album.images[0].url : null;
            
            let nextTrackUrl = `https://api.spotify.com/v1/albums/${album.id}/tracks?market=MX`;

            while (nextTrackUrl) {
                const tracksData = await fetchSpotifyURL(nextTrackUrl, token);
                await delay(1000); 

                const cancionesParaGuardar = [];

                for (const track of tracksData.items) {
                    
                    const isArtistInTrack = track.artists.some(a => a.id === artistMeta.spotifyId);
                    if (!isArtistInTrack) continue; 

                    // Categorías
                    const isInstrumental = track.name.toLowerCase().includes('instrumental');
                    const isExplicit = track.explicit || false; 

                    cancionesParaGuardar.push({
                        artist_id: artistRecord.id,
                        title: track.name,
                        album: album.name,
                        spotify_id: track.id,
                        spotify_uri: track.uri,
                        is_available: true,
                        release_year: releaseYear,
                        is_instrumental: isInstrumental,
                        is_explicit: isExplicit,
                        cover_url: coverUrl,
                        preview_url: track.preview_url 
                    });
                }

                // Guardar en Supabase todas las canciones de esta página de golpe
                if (cancionesParaGuardar.length > 0) {
                    const { error: batchErr } = await supabase
                        .from('songs')
                        .upsert(cancionesParaGuardar, { onConflict: 'spotify_id' });

                    if (batchErr) {
                        console.error(`Error guardando bloque de ${album.name}:`, batchErr.message);
                    } else {
                        console.log(`Guardadas ${cancionesParaGuardar.length} canciones de "${album.name}"`);
                    }
                }

                nextTrackUrl = tracksData.next; 
            }
        }
        nextAlbumUrl = albumsData.next; 
    }
    console.log(`${artistMeta.name} sincronizado correctamente.`);
}

async function main() {
    console.log("Iniciando orquestador");
    try {
        const token = await getSpotifyAccessToken();
        console.log("Conexión exitosa con Spotify API.");

        for (const artist of ARTISTS_CATALOG) {
            await syncArtistAndSongs(artist, token);
            await delay(2000); 
        }

        console.log("Catálogo completo sincronizado exitosamente en Supabase");
    } catch (error) {
        console.error("Error en la ejecución:", error.message);
    }
}

main();