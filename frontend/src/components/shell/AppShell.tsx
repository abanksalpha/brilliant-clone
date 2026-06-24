import type { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { CourseSwitcher } from './CourseSwitcher';
import { StatDock } from './StatDock';

type AppShellProps = {
  children: ReactNode;
  className?: string;
  /** Show the bottom-left course switcher. Hidden on pages like Friends. */
  showCourseSwitcher?: boolean;
};

function joinClassNames(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AppShell({ children, className, showCourseSwitcher = true }: AppShellProps) {
  return (
    <div className={joinClassNames('app-shell', className)}>
      <TopBar />
      <main className="app-main">{children}</main>
      {showCourseSwitcher ? <CourseSwitcher /> : null}
      <StatDock />
    </div>
  );
}
