import { useState, useMemo } from 'react';
import { Lock, Crosshair, Shield } from 'lucide-react';
import { Theme, TournamentMatch, FilterCategory } from '../types';
import { cx } from '../utils/formatters';
import { FILTERS, ESPORTS_GAMES } from '../data/mockData';
import { MatchCard } from '../components/tournaments/MatchCard';

interface TournamentsScreenProps {
  theme: Theme;
  matches: TournamentMatch[];
  joinedIds: string[];
  onOpenMatch: (match: TournamentMatch) => void;
  selectedFilter: FilterCategory;
  onFilter: (filter: FilterCategory) => void;
  onLockedGame: (name: string) => void;
  heroJoined?: boolean;
  onHeroJoin?: () => void;
}

export function TournamentsScreen({
  theme,
  matches,
  joinedIds,
  onOpenMatch,
  selectedFilter,
  onFilter,
  onLockedGame,
}: TournamentsScreenProps) {
  const isDark = theme === 'dark';
  const [selectedGame, setSelectedGame] = useState('FREE FIRE');

  const filtered = useMemo(
    () =>
      selectedFilter === 'All Matches'
        ? matches
        : matches.filter((match) => match.category === selectedFilter),
    [matches, selectedFilter]
  );

  return (
    <div className="space-y-4">
      {/* Esports Game Titles Selector */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span
            className={cx(
              'text-[10px] font-black uppercase tracking-wider',
              isDark ? 'text-slate-400' : 'text-slate-500'
            )}
          >
            Select Esports Title
          </span>
          <span className={cx('text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
            1 Live • 3 Upcoming
          </span>
        </div>

        {/* Wider & Sleek Game Cards with Consistent Size */}
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {ESPORTS_GAMES.map((game) => {
            const isSelected = selectedGame === game.name;

            return (
              <button
                key={game.name}
                type="button"
                onClick={() => {
                  if (game.active) {
                    setSelectedGame(game.name);
                  } else {
                    onLockedGame(game.name);
                  }
                }}
                className={cx(
                  'relative flex h-[52px] min-w-[155px] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-all active:scale-[0.97]',
                  isSelected
                    ? isDark
                      ? 'border-2 border-white bg-[#0F1E36] shadow-md'
                      : 'border-2 border-slate-800 bg-white shadow-sm ring-1 ring-slate-800/10'
                    : isDark
                    ? 'border-white/10 bg-[#0B1526]/60 opacity-45 hover:opacity-75'
                    : 'border-slate-200 bg-slate-100/70 opacity-50 hover:opacity-80'
                )}
              >
                {/* Game Icon / Official Logo */}
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/20 shadow-xs">
                  {game.icon ? (
                    <img
                      src={game.icon}
                      alt={game.name}
                      className="h-full w-full object-cover transition-all"
                    />
                  ) : game.name.includes('COD') ? (
                    <Crosshair className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Shield className="h-4 w-4 text-slate-400" />
                  )}
                </div>

                {/* Game Title & Status Indicator */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cx(
                      'truncate text-[11px] font-black tracking-tight uppercase leading-tight',
                      isSelected
                        ? isDark
                          ? 'text-white'
                          : 'text-slate-950'
                        : isDark
                        ? 'text-slate-300'
                        : 'text-slate-700'
                    )}
                  >
                    {game.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1">
                    {game.active ? (
                      <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE NOW
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[8px] font-bold text-slate-400">
                        <Lock className="h-2 w-2" />
                        {game.tag}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Category Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onFilter(filter)}
            className={cx(
              'shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95',
              selectedFilter === filter
                ? isDark
                  ? 'border-white bg-white text-slate-950 font-black'
                  : 'border-slate-950 bg-slate-950 text-white font-black shadow-sm'
                : isDark
                ? 'border-white/10 bg-[#0B1526] text-slate-300 hover:text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Upcoming Matches List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3
            className={cx(
              'text-xs font-black uppercase tracking-wider',
              isDark ? 'text-slate-200' : 'text-slate-900'
            )}
          >
            Upcoming Matches ({filtered.length})
          </h3>
          <span className={cx('text-[10px] font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Instant Room ID • Auto Payout
          </span>
        </div>
        {filtered.map((match) => (
          <MatchCard
            key={match.id}
            theme={theme}
            match={match}
            joined={joinedIds.includes(match.id)}
            onOpen={() => onOpenMatch(match)}
          />
        ))}
      </div>
    </div>
  );
}
