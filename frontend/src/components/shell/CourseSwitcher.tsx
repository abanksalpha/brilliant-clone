import { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function selectCourse(name: string) {
    if (name !== CURRENT_COURSE_NAME) return;
    setOpen(false);
    navigate('/dashboard');
  }

  return (
    <div className="course-switcher" ref={ref}>
      <button
        className="course-switcher-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch course"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="course-switcher-label">{CURRENT_COURSE_SHORT}</span>
        <ChevronDown className="course-switcher-caret" size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>

      {open ? (
        <div className="course-menu" role="menu" aria-label="Your courses">
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
