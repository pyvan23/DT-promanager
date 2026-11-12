// Sharing an achievement: link (?logro=...), clipboard, PNG export of the card and the native share sheet.

import { encodeAchievement, type Achievement, type SharedAchievement } from '../../engine/game/achievements';
import { GAME_NAME } from '../config';
import { CARD_H, CARD_W, cardData, isShared } from './AchievementCard';

export const SHARE_PARAM = 'logro';

/** Full achievement from a shared one (only the fields the link carries are meaningful). */
function asAchievement(a: Achievement | SharedAchievement): Achievement {
  if (!isShared(a)) return a;
  return {
    id: `${a.k}:${a.nid}:${a.s}`,
    kind: a.k,
    competitionId: a.nid,
    competitionName: a.n,
    clubId: a.cid,
    clubName: a.c,
    country: '',
    season: a.s,
    date: a.d,
    managerName: a.m,
    mode: 'manager',
    scope: 'completo',
    clubReputation: 0,
    points: a.p,
  };
}

export function shareUrl(a: Achievement | SharedAchievement): string {
  return `${location.origin}${location.pathname}?${SHARE_PARAM}=${encodeAchievement(asAchievement(a))}`;
}

/** Text that goes with the link. */
export function shareText(a: Achievement | SharedAchievement): string {
  const d = cardData(a);
  const what = d.kind === 'titulo' ? `salí campeón de ${d.competition}` : `ascendí en ${d.competition}`;
  return `¡${what} con ${d.club} (temporada ${d.season}) y sumé ${d.points} puntos en ${GAME_NAME}!`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back to the textarea trick
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Serialized copy of the card with every <image> inlined, so the canvas is not tainted. */
async function inlineSvg(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(CARD_W));
  clone.setAttribute('height', String(CARD_H));
  clone.removeAttribute('class');
  const images = Array.from(clone.querySelectorAll('image'));
  await Promise.all(
    images.map(async (img) => {
      const href = img.getAttribute('href') ?? img.getAttribute('xlink:href');
      if (!href || href.startsWith('data:')) return;
      try {
        const r = await fetch(new URL(href, location.href).href);
        if (!r.ok) throw new Error(String(r.status));
        img.setAttribute('href', await blobToDataUrl(await r.blob()));
      } catch {
        img.remove(); // better without the crest than a tainted canvas
      }
    }),
  );
  return new XMLSerializer().serializeToString(clone);
}

/** The card as a PNG blob (1080×1350). */
export async function cardPngBlob(svg: SVGSVGElement): Promise<Blob> {
  const markup = await inlineSvg(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo dibujar la tarjeta.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El navegador no permite dibujar la imagen.');
    ctx.drawImage(img, 0, 0, CARD_W, CARD_H);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadCardPng(svg: SVGSVGElement, fileName: string): Promise<void> {
  const blob = await cardPngBlob(svg);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "campeon-lpf-2026-juan-perez.png" */
export function cardFileName(a: Achievement | SharedAchievement): string {
  const d = cardData(a);
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${d.kind === 'titulo' ? 'campeon' : 'ascenso'}-${slug(d.competition)}-${d.season}-${slug(d.manager)}.png`;
}

export const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** Native share sheet, with the PNG attached when the browser can share files. */
export async function nativeShare(a: Achievement | SharedAchievement, url: string, svg?: SVGSVGElement | null): Promise<boolean> {
  if (!canNativeShare()) return false;
  const data: ShareData = { title: GAME_NAME, text: shareText(a), url };
  if (svg && typeof navigator.canShare === 'function') {
    try {
      const file = new File([await cardPngBlob(svg)], cardFileName(a), { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) data.files = [file];
    } catch {
      // share the link alone
    }
  }
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false; // cancelled by the user
  }
}
