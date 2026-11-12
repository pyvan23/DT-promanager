import { useMemo, useState } from 'react';
import {
  fireStaff,
  hireStaff,
  severanceFor,
  STAFF_ROLE_NAMES,
  STAFF_ROLES,
  staffCandidates,
  staffEffects,
  type StaffEffects,
  type StaffRole,
} from '../../../engine/club';
import { clubOf, divisionOf } from '../../../engine/game/game';
import type { StaffMember } from '../../../engine/game-types';
import { createRng } from '../../../engine/rng';
import { Bar, Panel } from '../../components/Panel';
import { PersonaMessage } from '../../personas/PersonaMessage';
import { personaFor } from '../../personas/personas';
import { Avatar } from '../../personas/Avatar';
import { StatStrip } from './shared';
import { hashString, money, pct, type ScreenProps } from './util';

const x2 = (v: number) => `×${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** What each role does, read from the staff effects. */
const ROLE_EFFECT: Record<StaffRole, { label: string; value: (e: StaffEffects) => string; good: (e: StaffEffects) => number }> = {
  'segundo-entrenador': { label: 'Progreso en los entrenamientos', value: (e) => x2(e.trainingProgress), good: (e) => e.trainingProgress },
  'preparador-fisico': { label: 'Recuperación física diaria', value: (e) => x2(e.fitnessRecovery), good: (e) => e.fitnessRecovery },
  medico: { label: 'Duración de las lesiones', value: (e) => x2(e.injuryDays), good: (e) => -e.injuryDays },
  ojeador: { label: 'Precisión de los informes', value: (e) => pct(e.scoutAccuracy), good: (e) => e.scoutAccuracy },
  'entrenador-juveniles': { label: 'Calidad de los juveniles', value: (e) => x2(e.youthQuality), good: (e) => e.youthQuality },
  'secretario-tecnico': { label: 'Descuento al negociar', value: (e) => pct(e.negotiationDiscount, 1), good: (e) => e.negotiationDiscount },
};

export function EmpleadosScreen({ game, update }: ScreenProps) {
  const [role, setRole] = useState<StaffRole>(STAFF_ROLES[0]);
  const date = game.calendar.date;
  const { staff, finances } = game.club;
  const effects = staffEffects(staff);
  const club = clubOf(game.world, game.userClubId);
  const level = divisionOf(game.world, game.userClubId).level;
  const memberOf = (r: StaffRole) => staff.find((s) => s.role === r);

  const candidates = useMemo(() => {
    const rng = createRng(hashString(`${game.world.seed}:${game.userClubId}:${date}:${role}`));
    return staffCandidates(role, club, rng, level);
  }, [game.world.seed, game.userClubId, date, role, club, level]);

  const current = memberOf(role);
  const severance = current ? severanceFor(current) : 0;
  const monthly = staff.reduce((s, m) => s + m.wage, 0);
  const isCurrent = (c: StaffMember) => !!current && current.name === c.name && current.quality === c.quality;

  return (
    <div className="stack cl-screen">
      <StatStrip
        items={[
          { label: 'Empleados', value: `${staff.length}/${STAFF_ROLES.length}` },
          { label: 'Sueldos de empleados', value: `${money(monthly)}/mes` },
          { label: 'Saldo', value: <span className={finances.balance < 0 ? 'cl-down' : undefined}>{money(finances.balance)}</span> },
        ]}
      />

      <Panel title="Cuerpo técnico y empleados" flush>
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th className="left">Rol</th>
                <th className="left">Nombre</th>
                <th className="left">Calidad</th>
                <th>Sueldo</th>
                <th className="left hide-sm">Efecto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {STAFF_ROLES.map((r) => {
                const m = memberOf(r);
                const eff = ROLE_EFFECT[r];
                return (
                  <tr key={r} className={`is-clickable${r === role ? ' is-selected' : ''}`} onClick={() => setRole(r)}>
                    <td className="left strong">{STAFF_ROLE_NAMES[r]}</td>
                    <td className="left">{m ? <span className="staff-cell"><Avatar persona={personaFor(game, r)} size={34} />{m.name}</span> : <span className="cl-down">Vacante</span>}</td>
                    <td className="left">{m ? <span className="cl-progress"><Bar value={m.quality} /><b>{m.quality}</b></span> : '—'}</td>
                    <td>{m ? money(m.wage) : '—'}</td>
                    <td className="left hide-sm"><span className="muted small">{eff.label}:</span> <b>{eff.value(effects)}</b></td>
                    <td>
                      {m ? (
                        <button
                          className="btn btn--xs"
                          title={`Indemnización: ${money(severanceFor(m))}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`¿Despedir a ${m.name}? La indemnización es de ${money(severanceFor(m))}.`)) update({ ...game, club: fireStaff(game.club, r, date) });
                          }}
                        >
                          Despedir · {money(severanceFor(m))}
                        </button>
                      ) : (
                        <button className="btn btn--xs btn--primary" onClick={(e) => { e.stopPropagation(); setRole(r); }}>Buscar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Candidatos · ${STAFF_ROLE_NAMES[role]}`} aside={<span className="muted">Se renuevan cada día</span>} flush>
        <div className="chips cl-pad">
          {STAFF_ROLES.map((r) => (
            <button key={r} className={`chip${r === role ? ' chip--active' : ''}`} onClick={() => setRole(r)}>{STAFF_ROLE_NAMES[r]}</button>
          ))}
        </div>
        <div className="cl-pad">
          <PersonaMessage
            persona={personaFor(game, role)}
            variant="compact"
            text={
              current
                ? `Soy ${current.name}, tu ${STAFF_ROLE_NAMES[role].toLowerCase()}. ${current.quality >= 70 ? 'Creo que estoy rindiendo bien' : current.quality >= 45 ? 'Hago lo que puedo con lo que hay' : 'Ya sé que no soy el mejor del mercado'}; si buscás reemplazo, acá tenés los candidatos.`
                : `El puesto de ${STAFF_ROLE_NAMES[role].toLowerCase()} está vacante: lo cubro de interino, pero conviene contratar a alguien.`
            }
          />
        </div>
        {current && (
          <p className="small muted cl-pad">
            Si contratás a alguien, {current.name} se va con una indemnización de <b>{money(severance)}</b> ({money(current.wage)} × 6 meses).
          </p>
        )}
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th className="left">Nombre</th>
                <th className="left">Calidad</th>
                <th>Sueldo</th>
                <th className="left hide-sm">{ROLE_EFFECT[role].label}</th>
                <th>Costo inmediato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const withC = staffEffects([...staff.filter((s) => s.role !== role), c]);
                const eff = ROLE_EFFECT[role];
                const delta = eff.good(withC) - eff.good(effects);
                const same = isCurrent(c);
                return (
                  <tr key={`${c.name}-${c.quality}`}>
                    <td className="left player-name"><span className="staff-cell"><Avatar persona={{ ...personaFor(game, role), name: c.name }} size={30} />{c.name}</span></td>
                    <td className="left"><span className="cl-progress"><Bar value={c.quality} /><b>{c.quality}</b></span></td>
                    <td>
                      {money(c.wage)}
                      {current && <span className={`tiny ${c.wage > current.wage ? 'cl-down' : 'cl-up'}`}> ({money(c.wage - current.wage, true)})</span>}
                    </td>
                    <td className="left hide-sm">
                      <b>{eff.value(withC)}</b> <span className={`tiny ${delta > 0 ? 'cl-up' : delta < 0 ? 'cl-down' : 'muted'}`}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '='}</span>
                    </td>
                    <td>{severance ? money(severance) : <span className="muted">—</span>}</td>
                    <td>
                      <button className="btn btn--xs btn--primary" disabled={same} onClick={() => update({ ...game, club: hireStaff(game.club, c, date) })}>
                        {same ? 'Contratado' : 'Contratar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
