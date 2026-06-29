import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';

const CURRENT_COURSE_NAME = 'AP Physics C: Electricity & Magnetism';
const CURRENT_COURSE_SHORT = 'Physics C: E&M';

const COURSE_CATALOG: { subject: string; courses: string[] }[] = [
  { subject: 'Math', courses: ['AP Precalculus', 'AP Calculus AB', 'AP Calculus BC', 'AP Statistics'] },
  {
    subject: 'Science',
    courses: [
      'AP Biology',
      'AP Chemistry',
      'AP Environmental Science',
      'AP Physics 1',
      'AP Physics 2',
      'AP Physics C: Mechanics',
      'AP Physics C: Electricity & Magnetism',
    ],
  },
  { subject: 'Computer Science', courses: ['AP Computer Science A', 'AP Computer Science Principles'] },
  { subject: 'English', courses: ['AP English Language', 'AP English Literature'] },
  {
    subject: 'History & Social Science',
    courses: [
      'AP US History',
      'AP World History: Modern',
      'AP European History',
      'AP US Government & Politics',
      'AP Psychology',
      'AP Macroeconomics',
      'AP Microeconomics',
      'AP Human Geography',
    ],
  },
];

export function CourseSwitcher() {
  const navigate = useNavigate();
  // `open` keeps the menu mounted; `closing` plays the reverse (close) animation
  // before it unmounts, so the menu eases out instead of vanishing instantly.
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const finishClose = useCallback(() => {
    clearCloseTimer();
    setClosing(false);
    setOpen(false);
  }, [clearCloseTimer]);

  // Start the reverse animation; the menu unmounts on its animationend, with a
  // timer fallback in case that event is missed (e.g. the tab is backgrounded).
  const closeMenu = useCallback(() => {
    setClosing(true);
    clearCloseTimer();
    closeTimerRef.current = setTimeout(finishClose, 400);
  }, [clearCloseTimer, finishClose]);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setClosing(false);
    setOpen(true);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closeMenu();
      }
    }

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open, closeMenu]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  function selectCourse(name: string) {
    if (name !== CURRENT_COURSE_NAME) return;
    closeMenu();
    navigate('/dashboard');
  }

  return (
    <div className="course-switcher" ref={ref}>
      <button
        className="course-switcher-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open && !closing}
        aria-label="Switch course"
        onClick={() => (open && !closing ? closeMenu() : openMenu())}
      >
        <span className="course-switcher-label">{CURRENT_COURSE_SHORT}</span>
        <ChevronDown className="course-switcher-caret" size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className={`course-menu${closing ? ' course-menu--closing' : ''}`}
          role="menu"
          aria-label="Your courses"
          onAnimationEnd={() => {
            if (closing) finishClose();
          }}
        >
          {COURSE_CATALOG.map((group) => (
            <div className="course-menu-group" key={group.subject}>
              <p className="course-menu-subject">{group.subject}</p>
              {group.courses.map((course) => {
                const isCurrent = course === CURRENT_COURSE_NAME;
                return (
                  <button
                    key={course}
                    className={`course-menu-item${isCurrent ? ' course-menu-item--active' : ''}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isCurrent}
                    onClick={() => selectCourse(course)}
                  >
                    <span className="course-menu-name">{course}</span>
                    {isCurrent ? (
                      <Check className="course-menu-check" size={16} strokeWidth={2.6} aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
