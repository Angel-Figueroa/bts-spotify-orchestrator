-- ========================================================
-- MIGRACIÓN INICIAL: Borahae Beats (Estructura de Catálogo)
-- ========================================================

-- 1. Habilitar extensión UUID por seguridad en los IDs
create extension if not exists "uuid-ossp";

-- 2. Tabla de Artistas, Solistas y Sub-unidades
create table public.artists (
    id uuid default uuid_generate_v4() primary key,
    name varchar(100) not null,              -- Ej. "BTS", "RM", "Rap Line"
    slug varchar(50) unique not null,        -- Identificador URL (ej. "bts", "rm", "rap-line")
    category varchar(30) not null,           -- "group", "solo", "sub-unit"
    theme_palette varchar(50) not null,      -- Ej. "borahae-purple", "indigo-earth", "orange-neon"
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabla de Canciones del Catálogo Teórico y Spotify
create table public.songs (
    id uuid default uuid_generate_v4() primary key,
    artist_id uuid references public.artists(id) on delete cascade not null,
    title varchar(255) not null,             -- Nombre de la canción
    album varchar(255),                      -- Nombre del álbum o mixtape
    spotify_id varchar(100),                 -- ID de Spotify (nulo si la canción no está disponible)
    spotify_uri varchar(150),                -- URI completa (spotify:track:xxxx)
    is_available boolean default false,      -- True si está en Spotify, False si falta
    release_year integer,                    -- Año de lanzamiento
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Habilitar Row Level Security (RLS) - Seguridad profesional
alter table public.artists enable row level security;
alter table public.songs enable row level security;

-- 5. Crear Políticas de Lectura Pública (Cualquiera puede leer el catálogo en la web)
create policy "Permitir lectura pública de artistas" 
    on public.artists for select 
    using (true);

create policy "Permitir lectura pública de canciones" 
    on public.songs for select 
    using (true);