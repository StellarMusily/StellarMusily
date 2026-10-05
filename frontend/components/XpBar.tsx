import type { Progress } from '@/lib/api';

export function XpBar({ progress, compact = false }: { progress: Progress; compact?: boolean }) {
  const pct = Math.round((progress.xpIntoLevel / progress.xpForNextLevel) * 100);
  return (
    <div className={compact ? 'xp compact' : 'xp'}>
      <span className="xp-level">Lv {progress.level}</span>
      <div className="xp-track" aria-label={`${pct}% to next level`}>
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="xp-streak" title="Daily practice streak">
        🔥 {progress.streak}
      </span>
      {!compact && (
        <span className="muted">
          {progress.xpIntoLevel}/{progress.xpForNextLevel} XP
        </span>
      )}
    </div>
  );
}
