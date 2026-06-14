import React from 'react';
import { StudyStats } from '../../../shared/types';
import './StudyHeader.css';

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/** Склонение «день/дня/дней». */
function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

const FlameIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
    <path
      d="M12 2.2c.6 3-1.7 4.4-3.2 6.1C7.2 10 6 11.7 6 14a6 6 0 0 0 12 0c0-2.1-1-3.8-2-5.2-.5 1-1.2 1.7-2.2 2 .8-2.3.3-5.3-1.8-8.6z"
      fill={active ? 'url(#flame)' : 'var(--border)'}
    />
    <defs>
      <linearGradient id="flame" x1="6" y1="2" x2="18" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffd27a" />
        <stop offset="0.55" stopColor="#ff9d4d" />
        <stop offset="1" stopColor="#ff6a3d" />
      </linearGradient>
    </defs>
  </svg>
);

interface StudyHeaderProps {
  stats: StudyStats;
  /** Дневная цель по числу повторов. */
  goal?: number;
}

const StudyHeader: React.FC<StudyHeaderProps> = ({ stats, goal = 30 }) => {
  const { streakDays, studiedToday, last7Days } = stats;
  const streakActive = streakDays > 0;
  const goalReached = studiedToday >= goal && goal > 0;

  // Кольцо прогресса дня
  const R = 26;
  const C = 2 * Math.PI * R;
  const ratio = goal > 0 ? Math.min(1, studiedToday / goal) : 0;
  const dash = C * ratio;

  const maxCount = Math.max(1, ...last7Days.map((d) => d.count));

  return (
    <div className="study-header">
      <div className={`sh-streak ${streakActive ? 'is-active' : ''}`}>
        <FlameIcon active={streakActive} />
        <div className="sh-streak-text">
          <span className="sh-streak-num">{streakDays}</span>
          <span className="sh-streak-label">
            {pluralDays(streakDays)} подряд
          </span>
        </div>
      </div>

      <div className="sh-goal" title={`Сегодня ${studiedToday} из ${goal}`}>
        <svg viewBox="0 0 64 64" width="64" height="64" className="sh-ring">
          <circle className="sh-ring-track" cx="32" cy="32" r={R} />
          <circle
            className={`sh-ring-fill ${goalReached ? 'is-done' : ''}`}
            cx="32"
            cy="32"
            r={R}
            strokeDasharray={`${dash} ${C - dash}`}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div className="sh-goal-text">
          {goalReached ? (
            <span className="sh-goal-done">✓</span>
          ) : (
            <span className="sh-goal-num">{studiedToday}</span>
          )}
          <span className="sh-goal-sub">/ {goal}</span>
        </div>
      </div>

      <div className="sh-week">
        <div className="sh-week-bars">
          {last7Days.map((d, i) => {
            const isToday = i === last7Days.length - 1;
            const h = d.count > 0 ? 8 + (d.count / maxCount) * 30 : 4;
            return (
              <div className="sh-bar-col" key={d.dayStart}>
                <div
                  className={`sh-bar ${d.count > 0 ? 'has' : ''} ${
                    isToday ? 'today' : ''
                  }`}
                  style={{ height: `${h}px` }}
                  title={`${d.count} повт.`}
                />
                <span className={`sh-bar-day ${isToday ? 'today' : ''}`}>
                  {DAY_LABELS[new Date(d.dayStart).getDay()]}
                </span>
              </div>
            );
          })}
        </div>
        <span className="sh-week-label">Активность за неделю</span>
      </div>
    </div>
  );
};

export default StudyHeader;
