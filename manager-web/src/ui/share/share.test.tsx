import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { createWorld } from '../../data/world';
import { decodeAchievement, encodeAchievement, type Achievement } from '../../engine/game/achievements';
import { newGame } from '../../engine/game/game';
import { LogrosScreen } from '../screens/LogrosScreen';
import { AchievementCard } from './AchievementCard';
import { AchievementShare } from './AchievementShare';
import { cardFileName, shareUrl } from './share';

const sample: Achievement = {
  id: 'titulo:lpf:2026',
  kind: 'titulo',
  competitionId: 'lpf',
  competitionName: 'Liga Profesional',
  clubId: 'ar-banfield',
  clubName: 'Club Atlético Banfield',
  country: 'ARG',
  season: 2026,
  date: '2026-12-13',
  managerName: 'Ñato Pérez',
  mode: 'promanager',
  scope: 'completo',
  clubReputation: 58,
  points: 32,
};

afterEach(() => vi.unstubAllGlobals());

it('encodes the share link and decodes it back (accents included)', () => {
  vi.stubGlobal('location', { origin: 'https://juego.example', pathname: '/manager/' });
  const url = shareUrl(sample);
  expect(url.startsWith('https://juego.example/manager/?logro=')).toBe(true);
  const code = new URL(url).searchParams.get('logro')!;
  expect(code).toBe(encodeAchievement(sample));
  expect(code).not.toMatch(/[+/=]/);
  const shared = decodeAchievement(code)!;
  expect(shared).toMatchObject({ k: 'titulo', m: 'Ñato Pérez', c: 'Club Atlético Banfield', cid: 'ar-banfield', n: 'Liga Profesional', nid: 'lpf', s: 2026, d: '2026-12-13', p: 32 });
  // A shared achievement re-encodes to the same link.
  expect(shareUrl(shared)).toBe(url);
  expect(decodeAchievement('basura!!')).toBeNull();
  expect(cardFileName(sample)).toBe('campeon-liga-profesional-2026-nato-perez.png');
});

it('renders the celebration card from a career or a shared achievement', () => {
  const html = renderToString(<AchievementCard achievement={sample} />);
  expect(html).toContain('viewBox="0 0 1080 1350"');
  expect(html).toContain('¡CAMPEÓN!');
  expect(html).toContain('Ñato Pérez');
  expect(html).toContain('CLUB ATLÉTICO BANFIELD');
  expect(html).toContain('+32');
  expect(html).toContain('domingo 13 de diciembre de 2026');
  const shared = decodeAchievement(encodeAchievement({ ...sample, kind: 'ascenso', competitionId: 'nacional', competitionName: 'Primera Nacional', clubId: 'nope' }))!;
  const html2 = renderToString(<AchievementCard achievement={shared} noImages />);
  expect(html2).toContain('¡ASCENSO!');
  expect(html2).toContain('PRIMERA NACIONAL');
  expect(renderToString(<AchievementShare achievement={sample} />)).toContain('Copiar enlace');
});

it('renders the Logros y ranking section', () => {
  const world = createWorld(5);
  const club = world.divisions.find((d) => d.id === 'lpf')!.clubIds[3];
  const g = newGame(world, club);
  expect(renderToString(<LogrosScreen game={g} update={() => {}} />)).toContain('Todavía no ganaste nada');
  const html = renderToString(<LogrosScreen game={{ ...g, achievements: [sample] }} update={() => {}} />);
  expect(html).toContain('Ranking de DTs');
  expect(html).toContain('Liga Profesional');
  expect(html).toContain('bonus Pro Mánager');
});
