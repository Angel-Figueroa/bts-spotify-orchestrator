-- ========================================================
-- MIGRACIÓN INICIAL: Borahae Beats (Estructura de Catálogo)
-- ========================================================

-- 1. Habilitar extensión UUID por seguridad en los IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Artistas, Solistas y Sub-unidades
CREATE TABLE public.artists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,              -- Ej. "BTS", "RM", "Rap Line"
    slug VARCHAR(50) UNIQUE NOT NULL,        -- Identificador URL (ej. "bts", "rm", "rap-line")
    category VARCHAR(30) NOT NULL,           -- "group", "solo", "sub-unit"
    theme_palette VARCHAR(50) NOT NULL,      -- Ej. "borahae-purple", "indigo-earth", "orange-neon"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Canciones del Catálogo Teórico y Spotify
CREATE TABLE public.songs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    artist_id UUID REFERENCES public.artists(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,             -- Nombre de la canción
    album VARCHAR(255),                      -- Nombre del álbum o mixtape
    spotify_id VARCHAR(100) UNIQUE,          -- ID de Spotify (nulo si la canción no está disponible)
    spotify_uri VARCHAR(150),                -- URI completa (spotify:track:xxxx)
    is_available BOOLEAN DEFAULT false,      -- True si está en Spotify, False si falta
    release_year INTEGER,                    -- Año de lanzamiento
    is_instrumental BOOLEAN DEFAULT false,   -- Filtro para versiones instrumentales
    is_explicit BOOLEAN DEFAULT false,       -- Etiqueta de contenido explícito (E)
    cover_url TEXT,                          -- URL de la portada del álbum en alta resolución
    preview_url TEXT,                        -- MP3 de 30 segundos (si Spotify lo provee)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- 5. Crear Políticas de Lectura Pública
CREATE POLICY "Permitir lectura pública de artistas" 
    ON public.artists FOR SELECT 
    USING (true);

CREATE POLICY "Permitir lectura pública de canciones" 
    ON public.songs FOR SELECT 
    USING (true);