import React from 'react';
import { StudyStats } from '../../../shared/types';
import { useT } from '../../prefs/PreferencesProvider';
import './StudyHeader.css';

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
  const t = useT();
  const DAY_LABELS = [
    t('studyHeader.daySun'),
    t('studyHeader.dayMon'),
    t('studyHeader.dayTue'),
    t('studyHeader.dayWed'),
    t('studyHeader.dayThu'),
    t('studyHeader.dayFri'),
    t('studyHeader.daySat'),
  ];
  const { streakDays, studiedToday, reviewedTotal, last7Days } = stats;
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
            {streakDays === 1 ? t('studyHeader.streakSingular') : t('studyHeader.streakPlural')}
          </span>
        </div>
      </div>

      <div className="sh-goal" title={t('studyHeader.todayOf').replace('{n}', String(studiedToday)).replace('{goal}', String(goal))}>
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

      <div className="sh-summary">
        <div className="sh-sum-item">
          <span className="sh-sum-num">{studiedToday}</span>
          <span className="sh-sum-label">{t('studyHeader.today')}</span>
        </div>
        <div className="sh-sum-divider" />
        <div className="sh-sum-item">
          <span className="sh-sum-num">{reviewedTotal}</span>
          <span className="sh-sum-label">{t('studyHeader.totalReviews')}</span>
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
                  title={t('studyHeader.nReviews').replace('{n}', String(d.count))}
                />
                <span className={`sh-bar-day ${isToday ? 'today' : ''}`}>
                  {DAY_LABELS[new Date(d.dayStart).getDay()]}
                </span>
              </div>
            );
          })}
        </div>
        <span className="sh-week-label">{t('studyHeader.weeklyActivity')}</span>
      </div>
    </div>
  );
};

export default StudyHeader;
