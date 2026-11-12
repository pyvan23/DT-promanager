import { CompetitionLogo } from './ui/competitions/CompetitionLogo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorld } from './data/world';
import { isSeasonOver, nextUserMatch, matchLabel } from './engine/calendar/calendar';
import { advanceDay, clubOf, divisionOf, endSeason, newGame, normalizeGame, type GameState } from './engine/game/game';
import type { MatchReport } from './engine/game-types';
import type { Player, World } from './engine/types';
import { ClubBadge } from './ui/components/ClubBadge';
import { FlagStrip } from './ui/components/Hinchada';
import { NavIcon } from './ui/components/NavIcon';
import { GAME_NAME } from './ui/config';
import { randomSeed } from './ui/format';
import { FULL_MANAGER_SECTIONS, SECTIONS } from './ui/sections';
import { InicioScreen } from './ui/screens/InicioScreen';
import { TablasScreen } from './ui/screens/TablasScreen';
import { EntrenamientoScreen } from './ui/screens/EntrenamientoScreen';
import { CalendarioScreen } from './ui/screens/CalendarioScreen';
import { ChooseClubScreen } from './ui/screens/ChooseClubScreen';
import { NuevaPartidaScreen, ProOfertasScreen, type SetupChoice } from './ui/screens/NuevaPartidaScreen';
import { ClubesScreen } from './ui/screens/ClubesScreen';
import { DirectivaScreen, EmpleadosScreen, EstadioScreen, FinanzasScreen, MercadoScreen } from './ui/screens/club';
import { CompeticionesScreen } from './ui/screens/CompeticionesScreen';
import { DespachoScreen } from './ui/screens/DespachoScreen';
import { EventOverlay } from './ui/screens/EventOverlay';
import { FinTemporadaScreen } from './ui/screens/FinTemporadaScreen';
import { FiredScreen } from './ui/screens/FiredScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { LiveMatchScreen } from './ui/screens/LiveMatchScreen';
import { SimulacionScreen } from './ui/screens/SimulacionScreen';
import { createLiveMatch } from './engine/matchday';
import { buildMatchInput } from './engine/game/matchday-bridge';
import { NoticiasScreen } from './ui/screens/NoticiasScreen';
import { PlantelScreen } from './ui/screens/PlantelScreen';
import { PlayerSheet } from './ui/screens/PlayerSheet';
import { PostPartidoScreen } from './ui/screens/PostPartidoScreen';
import { PreviaScreen } from './ui/screens/PreviaScreen';
import { longDate, shortDate, type LiveSession, type View } from './ui/screens/shared';
import { TacticaScreen } from './ui/screens/TacticaScreen';
import { LogrosScreen } from './ui/screens/LogrosScreen';
import { decodeAchievement, type SharedAchievement } from './engine/game/achievements';
import { AchievementShare } from './ui/share/AchievementShare';
import { SHARE_PARAM } from './ui/share/share';
import { loadGame, saveGame, type LoadResult } from './ui/storage';
import './App.css';

type Theme = 'auto' | 'light' | 'dark';
const THEME_KEY = 'manager-web:theme';
const SAVE_DELAY = 1500;

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function applyTheme(theme: Theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // per-viewer preference only
  }
}

/** Achievement shared by link (?logro=...), shown as a public page without a game. */
function readSharedAchievement(): SharedAchievement | null {
  try {
    const code = new URLSearchParams(window.location.search).get(SHARE_PARAM);
    return code ? decodeAchievement(code) : null;
  } catch {
    return null;
  }
}

const THEME_NEXT: Record<Theme, Theme> = { auto: 'dark', dark: 'light', light: 'auto' };
const THEME_LABEL: Record<Theme, string> = { auto: 'Tema: sistema', dark: 'Tema: noche', light: 'Tema: diario' };

const VIEW_TITLE: Partial<Record<View, { label: string; hint: string }>> = {
  live: { label: 'Partido en vivo', hint: 'Seguilo minuto a minuto' },
  simulacion: { label: 'Simulación', hint: 'Resultado al descanso y al final' },
  report: { label: 'Post-partido', hint: 'Goles, tarjetas, estadísticas y puntajes' },
  fin: { label: 'Fin de temporada', hint: 'Campeones, ascensos y descensos' },
};

export default function App() {
  const [slot, setSlot] = useState<LoadResult | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [draftWorld, setDraftWorld] = useState<World | null>(null);
  const [stage, setStage] = useState<'home' | 'setup' | 'choose' | 'pro' | 'game'>('home');
  const [setup, setSetup] = useState<SetupChoice | null>(null);
  const [view, setView] = useState<View>('inicio');
  const [reportId, setReportId] = useState<string | null>(null);
  const [live, setLive] = useState<LiveSession | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [sharedAch, setSharedAch] = useState<SharedAchievement | null>(readSharedAchievement);

  useEffect(() => applyTheme(theme), [theme]);

  // The save slot loads asynchronously (IndexedDB).
  useEffect(() => {
    let cancelled = false;
    loadGame().then((r) => !cancelled && setSlot((current) => current ?? r));
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced save: the state weighs several MB, so it is written once things settle.
  const pending = useRef<GameState | null>(null);
  useEffect(() => {
    if (!game || busy) return;
    pending.current = game;
    const t = setTimeout(() => {
      pending.current = null;
      saveGame(game).then((ok) => setSaveFailed(!ok));
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [game, busy]);
  useEffect(() => {
    const flush = () => {
      if (pending.current) saveGame(pending.current);
      pending.current = null;
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const go = useCallback((v: View, matchId?: string) => {
    setView(v);
    if (matchId) setReportId(matchId);
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, []);

  const update = useCallback((g: GameState) => setGame(g), []);

  /** Plays days in small chunks so the page stays responsive and shows the date. */
  const runDays = (start: GameState, label: string, stop: (g: GameState) => boolean, done?: (g: GameState) => void) => {
    setBusy(label);
    setProgress(start.calendar.date);
    let g = start;
    let guard = 0;
    const chunk = () => {
      const t0 = performance.now();
      try {
        while (performance.now() - t0 < 70) {
          if (g.fired || isSeasonOver(g.calendar) || stop(g) || guard++ > 400) {
            setGame(g);
            setBusy(null);
            setProgress(null);
            done?.(g);
            return;
          }
          g = advanceDay(g);
        }
      } catch (e) {
        console.error(e);
        setGame(g);
        setBusy(null);
        setProgress(null);
        return;
      }
      setProgress(g.calendar.date);
      setTimeout(chunk, 0);
    };
    setTimeout(chunk, 30);
  };

  const later = (label: string, fn: () => void) => {
    setBusy(label);
    setTimeout(() => {
      try {
        fn();
      } finally {
        setBusy(null);
      }
    }, 30);
  };

  const startNew = () => {
    setDraftWorld(createWorld(randomSeed()));
    setStage('setup');
  };

  /** Starts the career at the chosen club with the setup options (mode, name, match mode). */
  const begin = (clubId: string) =>
    later('Armando la temporada…', () => {
      if (!draftWorld) return;
      const g = newGame(draftWorld, clubId, setup ?? undefined);
      setGame(g);
      setSlot({ status: 'ok', save: { version: 2, game: g } });
      setLive(null);
      setDraftWorld(null);
      setStage('game');
      go('inicio');
    });

  const continueGame = () => {
    if (slot?.status !== 'ok') return;
    setGame(normalizeGame(slot.save.game));
    setLive(null);
    setStage('game');
    go('inicio');
  };

  if (sharedAch) {
    const play = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete(SHARE_PARAM);
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      setSharedAch(null);
      setStage('home');
    };
    return (
      <div className="ach-stage ach-stage--page">
        <div className="ach-stage__inner">
          <AchievementShare achievement={sharedAch}>
            <button className="btn btn--primary btn--lg" onClick={play} autoFocus>
              Jugar a {GAME_NAME}
            </button>
          </AchievementShare>
        </div>
      </div>
    );
  }

  if (stage === 'home' || (stage === 'game' && !game)) {
    const saved = slot?.status === 'ok' ? slot.save.game : game;
    const label = saved ? `temporada ${saved.world.season} · ${clubOf(saved.world, saved.userClubId).name} · ${longDate(saved.calendar.date)}` : null;
    return (
      <HomeScreen
        hasSave={!!saved}
        saveLabel={label}
        notice={slot?.status === 'outdated' && !game ? 'Tu partida guardada es de una versión anterior; empezá una nueva.' : null}
        onNewGame={startNew}
        onContinue={() => {
          if (game) setStage('game');
          else continueGame();
        }}
      />
    );
  }

  if (stage === 'setup' && draftWorld) {
    return (
      <NuevaPartidaScreen
        world={draftWorld}
        onBack={() => setStage('home')}
        onNext={(choice) => {
          setSetup(choice);
          setStage(choice.mode === 'promanager' ? 'pro' : 'choose');
        }}
      />
    );
  }

  if (stage === 'pro' && draftWorld && setup) {
    return (
      <>
        <ProOfertasScreen world={draftWorld} choice={setup} onBack={() => setStage('setup')} onAccept={begin} />
        {busy && <BusyOverlay label={busy} />}
      </>
    );
  }

  if (stage === 'choose' || !game) {
    if (!draftWorld) return null;
    return (
      <>
        <ChooseClubScreen world={draftWorld} onBack={() => setStage('setup')} onChoose={begin} />
        {busy && <BusyOverlay label={busy} />}
      </>
    );
  }

  if (game.fired) {
    return (
      <FiredScreen
        game={game}
        update={(g) => {
          setGame(g);
          setLive(null);
          go('inicio');
        }}
        onNewGame={startNew}
      />
    );
  }

  const club = clubOf(game.world, game.userClubId);
  const division = divisionOf(game.world, game.userClubId);
  const next = nextUserMatch(game.calendar);
  const today = !!next && next.date === game.calendar.date;
  const over = isSeasonOver(game.calendar);
  const liveForToday = live && next && live.matchId === next.id ? live : null;
  const title = VIEW_TITLE[view] ?? SECTIONS.find((s) => s.id === view) ?? SECTIONS[0];
  const rival = next ? clubOf(game.world, next.homeId === game.userClubId ? next.awayId : next.homeId) : null;

  // "Simular": results-only mode (half-time score with a pause for changes, then the final).
  const simulateMatch = () => {
    if (!next || !today) return;
    setLive({ matchId: next.id, match: createLiveMatch(buildMatchInput(game, next)), mode: 'sim' });
    go('simulacion');
  };

  const finishLive = (report: MatchReport) => {
    later('Cerrando la fecha…', () => {
      setGame(advanceDay(game, { userReport: report }));
      setLive(null);
      go('inicio');
    });
  };

  const props = { game, update, go, pickPlayer: setPlayer };

  return (
    <div className={'shell' + (drawer ? ' shell--drawer' : '')} style={{ ['--club-primary' as string]: club.colors.primary, ['--club-secondary' as string]: club.colors.secondary }}>
      <header className="topbar">
        <button className="topbar__menu" onClick={() => setDrawer((d) => !d)} aria-label="Menú" aria-expanded={drawer}>
          <span />
          <span />
          <span />
        </button>
        <button className="topbar__brand" onClick={() => setStage('home')} title="Menú principal">
          {GAME_NAME}
        </button>
        <div className="topbar__club">
          <ClubBadge club={club} size={30} />
          <div className="topbar__club-text">
            <span className="topbar__club-name">{club.shortName}</span>
            <span className="topbar__club-div">{division.name}</span>
          </div>
        </div>
        <div className="topbar__date">
          <span className="topbar__season">Temporada {game.calendar.season}</span>
          <span className="topbar__day">{longDate(game.calendar.date)}</span>
        </div>
        <button className="topbar__theme" onClick={() => setTheme(THEME_NEXT[theme])} title={THEME_LABEL[theme]} aria-label={THEME_LABEL[theme]}>
          {theme === 'light' ? '☀' : theme === 'dark' ? '☾' : '◐'}
        </button>
      </header>

      <div className="daybar">
        <div className="daybar__date">
          <span className="daybar__label">Hoy</span>
          <b>{longDate(game.calendar.date)}</b>
        </div>
        <div className="daybar__next">
          {next && rival ? (
            <>
              <span className="daybar__label">{today ? 'Hoy se juega' : `Próximo partido · ${shortDate(next.date)}`}</span>
              <span className="daybar__match">
                <ClubBadge club={rival} size={22} />
                <b>{rival.shortName}</b>
                <span className="muted">
                  {next.neutral ? 'Cancha neutral' : next.homeId === game.userClubId ? 'Local' : 'Visitante'} · <CompetitionLogo id={next.competitionId} size={18} /> {matchLabel(game.calendar, next).full}
                </span>
              </span>
            </>
          ) : (
            <span className="daybar__label">{over ? 'Temporada terminada' : 'Sin partidos programados'}</span>
          )}
        </div>
        <div className="daybar__actions">
          {over ? (
            <button
              className="btn btn--primary btn--sm"
              disabled={!!busy}
              onClick={() =>
                later('Cerrando la temporada…', () => {
                  setGame(endSeason(game));
                  setLive(null);
                  go('fin');
                })
              }
            >
              Cerrar temporada
            </button>
          ) : liveForToday ? (
            <button className="btn btn--primary btn--sm" onClick={() => go(liveForToday.mode === 'sim' ? 'simulacion' : 'live')}>
              Volver al partido
            </button>
          ) : today ? (
            <>
              {/* The default mode (Despacho → Opciones) is the main button; the other one stays available. */}
              <button
                className="btn btn--primary btn--sm"
                disabled={!!busy}
                onClick={() => (game.settings.matchMode === 'simulado' ? simulateMatch() : go('partido'))}
              >
                Jugar partido
              </button>

            </>
          ) : (
            <button
              className="btn btn--primary btn--sm"
              disabled={!!busy}
              onClick={() =>
                runDays(game, 'Avanzando hasta el próximo partido…', (g) => nextUserMatch(g.calendar)?.date === g.calendar.date, (g) => {
                  if (nextUserMatch(g.calendar)?.date === g.calendar.date) go('partido');
                })
              }
            >
              Continuar
            </button>
          )}
          {!over && (
            <button
              className="btn btn--ghost btn--sm"
              disabled={!!busy || !!liveForToday}
              onClick={() => {
                setLive(null);
                runDays(game, 'Simulando el resto de la temporada…', () => false);
              }}
            >
              Simular hasta fin de temporada
            </button>
          )}
        </div>
      </div>
      <FlagStrip club={club} />

      <aside className="sidebar" aria-label="Secciones">
        <nav>
          {SECTIONS.filter((s) => game.scope !== 'entrenador' || !FULL_MANAGER_SECTIONS.includes(s.id)).map((s) => (
            <button
              key={s.id}
              className={'sidebar__item' + (s.id === view || (s.id === 'partido' && (view === 'live' || view === 'simulacion' || view === 'report')) ? ' is-active' : '')}
              onClick={() => go(s.id === 'partido' && liveForToday ? (liveForToday.mode === 'sim' ? 'simulacion' : 'live') : s.id)}
              title={s.hint}
            >
              <NavIcon section={s.id} />
              <span className="sidebar__label">{s.id === 'partido' && liveForToday ? (liveForToday.mode === 'sim' ? 'Partido (simulado)' : 'Partido en vivo') : s.label}</span>
              {s.id === 'partido' && today && <span className="sidebar__dot" aria-label="Hoy hay partido" />}
            </button>
          ))}
        </nav>
        <div className="sidebar__foot">
          <button className="sidebar__item" onClick={() => setStage('home')}>
            <NavIcon section="cambiar" />
            <span className="sidebar__label">Menú principal</span>
          </button>
        </div>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      <main className="main">
        <div className="main__head">
          <h1 className="main__title">{title.label}</h1>
          <span className="main__hint">{title.hint}</span>
        </div>
        {saveFailed && <p className="notice">No se pudo guardar la partida en este navegador; seguís jugando en memoria.</p>}

        {view === 'inicio' && <InicioScreen {...props} />}
        {view === 'tablas' && <TablasScreen {...props} />}
        {view === 'entrenamiento' && <EntrenamientoScreen {...props} />}
        {view === 'despacho' && <DespachoScreen {...props} />}
        {view === 'calendario' && <CalendarioScreen {...props} />}
        {view === 'plantel' && <PlantelScreen {...props} />}
        {view === 'tactica' && <TacticaScreen {...props} />}
        {view === 'partido' && (
          <PreviaScreen
            {...props}
            onWatch={(matchId, match) => {
              setLive({ matchId, match });
              go('live');
            }}
            onSimulate={simulateMatch}
          />
        )}
        {view === 'live' &&
          (liveForToday ? (
            <LiveMatchScreen {...props} live={liveForToday} onDone={finishLive} />
          ) : (
            <p className="empty">No hay ningún partido en juego.</p>
          ))}
        {view === 'simulacion' &&
          (liveForToday ? (
            <SimulacionScreen {...props} live={liveForToday} onDone={finishLive} />
          ) : (
            <p className="empty">No hay ningún partido en juego.</p>
          ))}
        {view === 'report' && <PostPartidoScreen {...props} matchId={reportId} />}
        {view === 'competiciones' && <CompeticionesScreen {...props} />}
        {view === 'mercado' && <MercadoScreen game={game} update={update} />}
        {view === 'finanzas' && <FinanzasScreen game={game} update={update} />}
        {view === 'estadio' && <EstadioScreen game={game} update={update} />}
        {view === 'empleados' && <EmpleadosScreen game={game} update={update} />}
        {view === 'directiva' && <DirectivaScreen game={game} update={update} />}
        {view === 'noticias' && <NoticiasScreen {...props} />}
        {view === 'fin' && <FinTemporadaScreen {...props} />}
        {view === 'clubes' && <ClubesScreen {...props} />}
        {view === 'logros' && <LogrosScreen {...props} />}
      </main>

      {player && <PlayerSheet game={game} update={update} player={player} onClose={() => setPlayer(null)} />}
      {busy && <BusyOverlay label={busy} date={progress} />}
      {!busy && view !== 'live' && view !== 'simulacion' && <EventOverlay game={game} update={update} />}
    </div>
  );
}

function BusyOverlay({ label, date }: { label: string; date?: string | null }) {
  return (
    <div className="busy" role="status" aria-live="polite">
      <div className="busy__box">
        <span className="busy__ball" aria-hidden="true">
          ⚽
        </span>
        <b>{label}</b>
        {date && <span className="muted">{longDate(date)}</span>}
      </div>
    </div>
  );
}
