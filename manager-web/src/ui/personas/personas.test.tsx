import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../data/world';
import { alerts } from '../../engine/game/alerts';
import { newGame } from '../../engine/game/game';
import { PersonaStylePicker } from '../screens/CareerPanels';
import { Avatar } from './Avatar';
import { PersonaMessage } from './PersonaMessage';
import { PERSONA_ROLES, personaFor, samplePersona, traitsOf } from './personas';
import { PERSONA_STYLES } from './personaStyle';
import { alertVoice } from './voices';

const NAMES = ['Horacio Arregui', 'Marta Quiroga', 'Don Atilio Vaccaro', 'Ciro Ledesma', 'Graciela Fontán', 'Rubén Saravia'];

describe('personas', () => {
  it('traits are deterministic per name', () => {
    expect(traitsOf('Horacio Arregui')).toEqual(traitsOf('Horacio Arregui'));
    expect(traitsOf('Marta Quiroga').female).toBe(true);
  });

  for (const style of PERSONA_STYLES) {
    it(`renders every role in the ${style.label} style`, () => {
      for (const [i, role] of PERSONA_ROLES.entries()) {
        const p = samplePersona(role, NAMES[i % NAMES.length]);
        const html = renderToString(<Avatar persona={p} variant={style.id} size={64} caption={i % 2 === 0} />);
        expect(html).toMatch(style.id === 'fotos' ? /<svg|<img src="[^"]*\/personas\/[a-z-]+-\d+\.jpg"/ : /<svg/);
        expect(html).toContain(`avatar--${style.id === 'fotos' ? 'diario' : style.id}`);
        expect(html).toContain(p.cargo);
      }
    });
  }

  it('renders PersonaMessage in every variant with its text', () => {
    const p = samplePersona('medico', 'Ciro Ledesma');
    for (const variant of ['card', 'compact', 'inline'] as const) {
      const html = renderToString(<PersonaMessage persona={p} variant={variant} title="Parte médico" text="Está todo el mundo sano." actions={<button>Ir</button>} />);
      expect(html).toContain('Está todo el mundo sano.');
      expect(html).toContain('Ciro Ledesma');
      expect(html).toContain(`persona-msg--${variant}`);
    }
  });

  it('uses the staff names of the club and gives every alert a voice', () => {
    const world = createWorld(3);
    const g = newGame(world, world.divisions.find((d) => d.id === 'lpf')!.clubIds[0]);
    for (const m of g.club.staff) expect(personaFor(g, m.role).name).toBe(m.name);
    expect(personaFor(g, 'presidente').name).toBe(personaFor(g, 'presidente').name);
    for (const a of alerts(g)) expect(alertVoice(g, a).text.length).toBeGreaterThan(10);
    const picker = renderToString(<PersonaStylePicker game={g} />);
    for (const s of ['diario', 'silueta']) expect(picker).toContain(`avatar--${s}`);
  });
});
