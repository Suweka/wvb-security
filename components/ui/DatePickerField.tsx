// A styled date-picker input: a text-like button that, when clicked, opens a
// small popup calendar (built from scratch below, no external date library)
// so the user can pick a single date within an allowed [minDate, maxDate] range.
'use client'; // Needs browser APIs (state, click listeners), so it must run on the client, not the server.

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Mini-calendar (internal) ───────────────────────────────────────────────────

// Labels used to render the calendar header/grid. Kept as constants so they're
// only defined once, not recreated on every render.
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// Internal helper component: renders the actual calendar grid (month header +
// arrows + day cells) for one month at a time. Not exported — only used by
// DatePickerField below.
function MiniCalendar({
  selected,
  minDate,
  maxDate,
  onSelect,
}: {
  selected: Date | null;
  minDate: Date;
  maxDate?: Date;
  onSelect: (d: Date) => void;
}) {
  // Which month is currently displayed. Starts on the selected date's month,
  // or minDate's month if nothing is selected yet.
  const init = selected ?? minDate;
  const [view, setView] = useState(new Date(init.getFullYear(), init.getMonth()));

  const y = view.getFullYear();
  const m = view.getMonth();
  // getDay() of the 1st of the month tells us how many empty cells to pad
  // before day 1 so the grid lines up under the correct weekday column.
  const firstDow = new Date(y, m, 1).getDay();
  // Passing day 0 of "next month" is a JS Date trick for "last day of this month",
  // which gives us the total number of days to render.
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  // Build the full grid: `firstDow` empty (null) cells for padding, then one
  // Date object per day of the month.
  const cells: (Date | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(y, m, i + 1)),
  ];

  // A day is disabled if it falls before minDate, or after maxDate (when set).
  const isDisabled = (d: Date) => d < minDate || (maxDate ? d > maxDate : false);
  // Compare using toDateString() so we ignore time-of-day differences and just match calendar day.
  const isSelected = (d: Date) => selected?.toDateString() === d.toDateString();

  return (
    <div className="p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        {/* Go to previous month */}
        <button
          type="button"
          onClick={() => setView(new Date(y, m - 1))}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {MONTH_NAMES[m]} {y}
        </span>
        {/* Go to next month */}
        <button
          type="button"
          onClick={() => setView(new Date(y, m + 1))}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday header row (Su, Mo, Tu, ...) */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="h-7 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Day-of-month grid; null cells (padding before day 1) render as empty divs */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) =>
          d ? (
            <button
              key={i}
              type="button"
              disabled={isDisabled(d)}
              onClick={() => !isDisabled(d) && onSelect(d)}
              className={[
                'h-8 w-full flex items-center justify-center rounded-lg text-xs transition-colors',
                isDisabled(d)
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-primary-light text-gray-700 dark:text-gray-300',
                isSelected(d) ? '!bg-primary !text-white font-semibold' : '',
              ].join(' ')}
            >
              {d.getDate()}
            </button>
          ) : (
            <div key={i} className="h-8" />
          )
        )}
      </div>
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────────

interface Props {
  label?: ReactNode;
  value: Date | null;
  onChange: (d: Date) => void;
  minDate: Date;
  maxDate?: Date;
  placeholder?: string;
  className?: string;
}

// Formats a Date as e.g. "Jan 5, 2026" for display in the closed input; returns
// null (so the placeholder text shows instead) when no date is selected yet.
function fmt(d: Date | null) {
  return d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
}

// Public date-picker field: a button showing the chosen date (or a placeholder)
// that toggles a popup <MiniCalendar/> on click. `minDate`/`maxDate` constrain
// which days can be picked (e.g. can't book a check-in date in the past).
export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false); // whether the calendar popup is visible
  const ref = useRef<HTMLDivElement>(null); // reference to the wrapping div, used to detect outside clicks

  // Close the popup when the user clicks anywhere outside this component.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    // Cleanup function: React runs this when the component unmounts, to avoid
    // leaking the event listener.
    return () => document.removeEventListener('mousedown', handler);
  }, []); // empty dependency array = only run this setup once, on mount

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      )}
      {/* The closed-state control: clicking toggles the popup calendar open/closed */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-colors text-left"
      >
        <CalendarDays size={16} className="text-primary flex-shrink-0" />
        <span className={value ? 'text-gray-900 dark:text-gray-100 font-medium text-sm' : 'text-gray-400 dark:text-gray-500 text-sm'}>
          {fmt(value) ?? placeholder}
        </span>
      </button>

      {/* Popup calendar, only rendered while `open` is true. Picking a date calls
          onChange and closes the popup. */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 animate-fadeIn">
          <MiniCalendar
            selected={value}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={d => { onChange(d); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}
