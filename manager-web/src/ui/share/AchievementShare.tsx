import { useEffect, useRef, useState } from 'react';
import type { Achievement, SharedAchievement } from '../../engine/game/achievements';
import { AchievementCard } from './AchievementCard';
import { canNativeShare, cardFileName, copyText, downloadCardPng, nativeShare, shareUrl } from './share';
import './share.css';

// The celebration card scaled to the screen, with the share buttons under it.

export function AchievementShare({
  achievement,
  colors,
  children,
  share = true,
}: {
  achievement: Achievement | SharedAchievement;
  colors?: { primary: string; secondary: string };
  /** Extra buttons after the share ones ("Seguir", "Jugar"...). */
  children?: React.ReactNode;
  /** Show "Copiar enlace" and "Compartir". */
  share?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    setError(null);
    if (await copyText(shareUrl(achievement))) setCopied(true);
    else setError('No se pudo copiar el enlace.');
  };
  const download = async () => {
    if (!svg.current) return;
    setBusy(true);
    setError(null);
    try {
      await downloadCardPng(svg.current, cardFileName(achievement));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la imagen.');
    } finally {
      setBusy(false);
    }
  };
  const shareIt = async () => {
    setBusy(true);
    setError(null);
    try {
      await nativeShare(achievement, shareUrl(achievement), svg.current);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ach-share">
      <div className="ach-share__card">
        <AchievementCard ref={svg} achievement={achievement} colors={colors} />
      </div>
      <div className="ach-share__actions">
        {share && (
          <button className="btn" onClick={copy}>
            {copied ? '¡Copiado!' : 'Copiar enlace'}
          </button>
        )}
        <button className="btn" onClick={download} disabled={busy}>
          {busy ? 'Generando…' : 'Descargar imagen'}
        </button>
        {share && canNativeShare() && (
          <button className="btn" onClick={shareIt} disabled={busy}>
            Compartir
          </button>
        )}
        {children}
      </div>
      <span className="ach-share__status" role="status" aria-live="polite">
        {copied ? 'Enlace copiado al portapapeles' : error}
      </span>
    </div>
  );
}
