# Ranking online de DTs (Supabase, plan gratuito)

El juego publica los logros (títulos y ascensos) de cada jugador y muestra una tabla general.
Hasta que esto esté configurado, la sección "Ranking" muestra solo los logros de tu dispositivo.

## 1. Crear el proyecto (lo hace el usuario)
1. Entrar a https://supabase.com y crear una cuenta (gratis) y un proyecto nuevo.
2. En **Authentication → Sign In / Providers**, activar **Allow anonymous sign-ins**.
3. En **SQL Editor**, pegar y ejecutar el SQL de abajo.
4. En **Project Settings → API** copiar la **Project URL** y la **anon public key**.
5. Crear el archivo `manager-web/.env.local` con:
   ```
   VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
   (la anon key es pública por diseño; la seguridad la dan las políticas RLS de abajo).

## 2. SQL
```sql
create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  manager_name text not null check (char_length(manager_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.achievements (
  player_id uuid not null references public.players (id) on delete cascade,
  achievement_key text not null,
  kind text not null check (kind in ('titulo', 'ascenso')),
  competition_id text not null,
  competition_name text not null,
  club_id text not null,
  club_name text not null,
  season int not null,
  achieved_on date not null,
  club_reputation int not null,
  mode text not null,
  points int not null check (points between 0 and 200),
  created_at timestamptz not null default now(),
  primary key (player_id, achievement_key)
);

alter table public.players enable row level security;
alter table public.achievements enable row level security;

-- Everyone can read; each player writes only their own rows.
create policy "players read" on public.players for select using (true);
create policy "players write own" on public.players for insert with check (auth.uid() = id);
create policy "players update own" on public.players for update using (auth.uid() = id);
create policy "achievements read" on public.achievements for select using (true);
create policy "achievements write own" on public.achievements for insert with check (auth.uid() = player_id);

create view public.leaderboard as
select p.id as player_id,
       p.manager_name,
       coalesce(sum(a.points), 0)::int as points,
       count(*) filter (where a.kind = 'titulo')::int as titles,
       count(*) filter (where a.kind = 'ascenso')::int as promotions,
       (array_agg(a.club_name order by a.points desc))[1] as best_club
from public.players p
left join public.achievements a on a.player_id = p.id
group by p.id, p.manager_name;

grant select on public.leaderboard to anon, authenticated;
```

## 3. Límites conocidos
- El juego corre en el navegador, así que un usuario técnico podría inventar logros. Mitigación
  futura: guardar en el servidor la semilla y las decisiones de la carrera y re-simular la temporada
  para validar cada logro (o una Edge Function que valide puntos máximos por temporada).
- Una sesión anónima vive en el dispositivo: si se borran los datos del navegador, se crea otro
  jugador. Más adelante se puede vincular con Google (Supabase Auth) para conservar la cuenta.
