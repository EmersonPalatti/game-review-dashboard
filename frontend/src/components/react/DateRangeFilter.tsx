import { Calendar } from 'lucide';
import { useEffect, useRef, useState } from 'react';
import { formatDate } from '../../lib/format';
import { useFilters } from '../../lib/useNanostore';
import { filters, type Filters } from '../../stores/filters';
import { RailIcon } from './RailIcon';

function patchFilters(patch: Partial<Filters>): void {
  filters.set({ ...filters.get(), ...patch });
}

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const YEARS = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021];

const WEEKDAYS = [
  { short: 'D', full: 'Domingo' },
  { short: 'S', full: 'Segunda-feira' },
  { short: 'T', full: 'Terça-feira' },
  { short: 'Q', full: 'Quarta-feira' },
  { short: 'Q', full: 'Quinta-feira' },
  { short: 'S', full: 'Sexta-feira' },
  { short: 'S', full: 'Sábado' },
] as const;

const DATE_PRESETS = [
  { label: 'Tudo', from: null, to: null },
  { label: '2020', from: '2020-01-01', to: '2020-12-31' },
  { label: '2019', from: '2019-01-01', to: '2019-12-31' },
  { label: '2018', from: '2018-01-01', to: '2018-12-31' },
] as const;

const MIN_DATE = '2013-03-05';
const MAX_DATE = '2021-01-23';

export function DateRangeFilter() {
  const currentFilters = useFilters();
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const [viewYear, setViewYear] = useState<number>(2020);
  const [viewMonth, setViewMonth] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fromTriggerRef = useRef<HTMLButtonElement>(null);
  const toTriggerRef = useRef<HTMLButtonElement>(null);
  const lastFieldRef = useRef<'from' | 'to'>('from');

  const closePopover = (restoreFocusTo?: 'from' | 'to') => {
    setActiveField(null);
    setHoveredDate(null);
    if (restoreFocusTo === 'from') {
      fromTriggerRef.current?.focus();
    } else if (restoreFocusTo === 'to') {
      toTriggerRef.current?.focus();
    }
  };

  // Sync calendar view month/year and manage focus when popover opens or active field changes
  useEffect(() => {
    if (!activeField) return;

    lastFieldRef.current = activeField;

    const targetDate = activeField === 'from' ? currentFilters.dateFrom : currentFilters.dateTo;
    const fallbackDate = activeField === 'from' ? currentFilters.dateTo : currentFilters.dateFrom;
    const dateToParse = targetDate || fallbackDate;

    if (dateToParse) {
      const parts = dateToParse.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setViewYear(parts[0]);
        setViewMonth(parts[1] - 1);
      }
    } else {
      if (activeField === 'to') {
        setViewYear(2020);
        setViewMonth(11);
      } else {
        setViewYear(2020);
        setViewMonth(0);
      }
    }

    const raf = requestAnimationFrame(() => {
      if (!popoverRef.current) return;
      const selected = popoverRef.current.querySelector<HTMLButtonElement>(
        '.date-cell.is-selected:not(:disabled)'
      );
      if (selected) {
        selected.focus();
        return;
      }
      const firstEnabled = popoverRef.current.querySelector<HTMLButtonElement>(
        '.date-cell:not(:disabled)'
      );
      if (firstEnabled) {
        firstEnabled.focus();
        return;
      }
      const firstFocusable = popoverRef.current.querySelector<HTMLElement>(
        'button:not(:disabled), select:not(:disabled)'
      );
      firstFocusable?.focus();
    });

    return () => cancelAnimationFrame(raf);
  }, [activeField]);

  // Click outside and Escape key listeners
  useEffect(() => {
    if (!activeField) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closePopover();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopover(activeField);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeField]);

  const toggleField = (field: 'from' | 'to') => {
    setActiveField((prev) => {
      if (prev === field) {
        setHoveredDate(null);
        return null;
      }
      lastFieldRef.current = field;
      setHoveredDate(null);
      return field;
    });
  };

  const handleSelectDay = (dateStr: string) => {
    setHoveredDate(null);
    if (activeField === 'from') {
      if (!currentFilters.dateTo || dateStr > currentFilters.dateTo) {
        patchFilters({
          dateFrom: dateStr,
          dateTo: currentFilters.dateTo && dateStr > currentFilters.dateTo ? null : currentFilters.dateTo,
        });
        lastFieldRef.current = 'to';
        setActiveField('to');
        return;
      }
      patchFilters({ dateFrom: dateStr });
      closePopover('from');
    } else if (activeField === 'to') {
      if (currentFilters.dateFrom && dateStr < currentFilters.dateFrom) {
        patchFilters({ dateFrom: dateStr, dateTo: currentFilters.dateFrom });
      } else {
        patchFilters({ dateTo: dateStr });
      }
      closePopover('to');
    }
  };

  const handleClearCurrent = () => {
    const fieldToRestore = activeField;
    if (activeField === 'from') {
      patchFilters({ dateFrom: null });
    } else if (activeField === 'to') {
      patchFilters({ dateTo: null });
    }
    closePopover(fieldToRestore ?? undefined);
  };

  const goToPrevMonth = () => {
    if (viewYear === 2013 && viewMonth <= 2) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewYear === 2021 && viewMonth >= 0) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let delta = 0;
    if (event.key === 'ArrowLeft') delta = -1;
    else if (event.key === 'ArrowRight') delta = 1;
    else if (event.key === 'ArrowUp') delta = -7;
    else if (event.key === 'ArrowDown') delta = 7;
    else return;

    if (!popoverRef.current) return;
    const enabledButtons = Array.from(
      popoverRef.current.querySelectorAll<HTMLButtonElement>('.date-cell:not(:disabled)')
    );
    if (enabledButtons.length === 0) return;

    const currentIndex = enabledButtons.findIndex((btn) => btn === document.activeElement);
    event.preventDefault();

    if (currentIndex === -1) {
      const selectedBtn = enabledButtons.find((btn) => btn.classList.contains('is-selected'));
      (selectedBtn ?? enabledButtons[0]).focus();
      return;
    }

    const targetIndex = Math.min(Math.max(currentIndex + delta, 0), enabledButtons.length - 1);
    enabledButtons[targetIndex]?.focus();
  };

  const hasActiveDate = currentFilters.dateFrom !== null || currentFilters.dateTo !== null;
  const oppositeBound = activeField === 'from' ? currentFilters.dateTo : currentFilters.dateFrom;

  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  return (
    <div
      className={`sidebar-row is-field${hasActiveDate ? ' is-filtered' : ''}`}
      data-filter-row="dateRange"
      title="Período de avaliação"
    >
      <RailIcon icon={Calendar} />
      <span className="sidebar-reveal" style={{ overflow: 'visible' }}>
        <span className="sidebar-reveal-inner field" style={{ overflow: 'visible' }}>
          <span className="field-label">Período de avaliação</span>

          <div ref={containerRef} className="relative w-full">
            {/* Side-by-side trigger buttons */}
            <div className="flex items-center gap-1.5 w-full">
              <button
                ref={fromTriggerRef}
                type="button"
                id="filter-date-from"
                aria-label="Data inicial"
                aria-expanded={activeField === 'from'}
                aria-haspopup="dialog"
                className={`field-control date-trigger${
                  currentFilters.dateFrom ? ' has-value' : ''
                }${activeField === 'from' ? ' is-open' : ''}`}
                onClick={() => toggleField('from')}
              >
                <span className="truncate">
                  {currentFilters.dateFrom ? formatDate(currentFilters.dateFrom) : 'Início'}
                </span>
                <svg
                  className="date-trigger-chevron"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="text-muted text-xs select-none" aria-hidden="true">
                —
              </span>
              <button
                ref={toTriggerRef}
                type="button"
                id="filter-date-to"
                aria-label="Data final"
                aria-expanded={activeField === 'to'}
                aria-haspopup="dialog"
                className={`field-control date-trigger${
                  currentFilters.dateTo ? ' has-value' : ''
                }${activeField === 'to' ? ' is-open' : ''}`}
                onClick={() => toggleField('to')}
              >
                <span className="truncate">
                  {currentFilters.dateTo ? formatDate(currentFilters.dateTo) : 'Fim'}
                </span>
                <svg
                  className="date-trigger-chevron"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Custom Calendar Popover (placed immediately after triggers, before presets) */}
            <div
              ref={popoverRef}
              role="dialog"
              aria-modal="false"
              aria-label={`Selecionar data ${(activeField ?? lastFieldRef.current) === 'to' ? 'final' : 'inicial'}`}
              aria-hidden={!activeField}
              inert={!activeField ? true : undefined}
              data-active-field={activeField ?? lastFieldRef.current}
              className={`date-popover${activeField ? ' is-open' : ''}`}
            >
              {/* Contextual header strip */}
              <div className="date-popover-status">
                <span className="date-popover-status-badge">
                  <span className="date-popover-status-dot" aria-hidden="true" />
                  {(activeField ?? lastFieldRef.current) === 'to' ? 'Data final' : 'Data inicial'}
                </span>
                <span className="date-popover-status-range">
                  {`${currentFilters.dateFrom ? formatDate(currentFilters.dateFrom) : '...'} → ${
                    currentFilters.dateTo ? formatDate(currentFilters.dateTo) : '...'
                  }`}
                </span>
              </div>

              {/* Header: Month / Year Selects & Navigation Buttons */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  disabled={viewYear === 2013 && viewMonth <= 2}
                  onClick={goToPrevMonth}
                  className="date-nav-btn"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M10 12l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div className="flex items-center gap-1">
                  <select
                    aria-label="Selecionar mês"
                    value={viewMonth}
                    onChange={(e) => setViewMonth(Number(e.target.value))}
                    className="date-select"
                  >
                    {MONTHS.map((name, index) => {
                      const disabled =
                        (viewYear === 2013 && index < 2) || (viewYear === 2021 && index > 0);
                      return (
                        <option key={name} value={index} disabled={disabled}>
                          {name}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    aria-label="Selecionar ano"
                    value={viewYear}
                    onChange={(e) => {
                      const newYear = Number(e.target.value);
                      setViewYear(newYear);
                      if (newYear === 2013 && viewMonth < 2) setViewMonth(2);
                      if (newYear === 2021 && viewMonth > 0) setViewMonth(0);
                    }}
                    className="date-select"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  aria-label="Próximo mês"
                  disabled={viewYear === 2021 && viewMonth >= 0}
                  onClick={goToNextMonth}
                  className="date-nav-btn"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted mb-1">
                {WEEKDAYS.map((day, idx) => (
                  <span key={idx} className="date-weekday">
                    <abbr title={day.full} className="no-underline">
                      {day.short}
                    </abbr>
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div
                className="grid grid-cols-7 gap-1 text-center"
                onKeyDown={handleGridKeyDown}
                onMouseLeave={() => setHoveredDate(null)}
              >
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-7 h-7" aria-hidden="true" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isOutOfRange = dateStr < MIN_DATE || dateStr > MAX_DATE;
                  const isSelected =
                    dateStr === currentFilters.dateFrom || dateStr === currentFilters.dateTo;
                  const isInRange =
                    currentFilters.dateFrom !== null &&
                    currentFilters.dateTo !== null &&
                    dateStr > currentFilters.dateFrom &&
                    dateStr < currentFilters.dateTo;

                  let isPreviewRange = false;
                  if (hoveredDate && oppositeBound && !isSelected && !isOutOfRange) {
                    const [minBound, maxBound] =
                      hoveredDate < oppositeBound
                        ? [hoveredDate, oppositeBound]
                        : [oppositeBound, hoveredDate];
                    if (dateStr > minBound && dateStr < maxBound) {
                      isPreviewRange = true;
                    }
                  }

                  const cellClass = `date-cell${isSelected ? ' is-selected' : ''}${
                    isInRange ? ' is-in-range' : ''
                  }${isPreviewRange ? ' is-preview-range' : ''}`;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={isOutOfRange}
                      aria-label={`${day} de ${MONTHS[viewMonth].toLowerCase()} de ${viewYear}`}
                      aria-pressed={isSelected}
                      title={isOutOfRange ? 'Fora do período da base (05/03/2013 a 23/01/2021)' : undefined}
                      className={cellClass}
                      onClick={() => handleSelectDay(dateStr)}
                      onMouseEnter={() => !isOutOfRange && setHoveredDate(dateStr)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Footer: Limpar and Fechar */}
              <div className="date-footer">
                <button
                  type="button"
                  className="date-footer-btn"
                  onClick={handleClearCurrent}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  className="date-footer-btn is-primary"
                  onClick={() => closePopover(activeField ?? lastFieldRef.current)}
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Quick preset pills */}
            <div
              className={`date-presets${activeField !== null ? ' is-dimmed' : ''}`}
              role="group"
              aria-label="Presets de período"
            >
              {DATE_PRESETS.map((preset) => {
                const isActive =
                  currentFilters.dateFrom === preset.from && currentFilters.dateTo === preset.to;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className="preset-btn text-xs"
                    data-date-preset={preset.from === null ? 'all' : preset.label}
                    aria-pressed={isActive ? 'true' : 'false'}
                    onClick={() => {
                      patchFilters({ dateFrom: preset.from, dateTo: preset.to });
                      closePopover();
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </span>
      </span>
    </div>
  );
}
