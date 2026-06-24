import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, LogOut, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useSocial } from '../../social/SocialContext';

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg className="google-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

// The slide-down entrance should play once per page load, not every time the
// bar remounts when navigating between shell pages (dashboard <-> friends).
// Module scope survives client-side route changes and resets on a full reload.
let topbarIntroPlayed = false;

export function TopBar() {
  const { currentUser, logout } = useAuth();
  const { incomingCount } = useSocial();
  const email = currentUser?.email ?? '';
  const photoURL = currentUser?.photoURL ?? '';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [playIntro] = useState(() => !topbarIntroPlayed);

  useEffect(() => {
    topbarIntroPlayed = true;
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  return (
    <header className={`topbar${playIntro ? ' topbar--intro' : ''}`}>
      <Link className="brand" to="/dashboard">
        <GraduationCap className="brand-icon" size={28} strokeWidth={2.2} aria-hidden="true" />
        <span className="brand-word">APT</span>
      </Link>

      <div className="topbar-stats">
        <Link
          className="topbar-friends"
          to="/friends"
          title="Friends"
          aria-label={
            incomingCount > 0
              ? `Friends, ${incomingCount} pending request${incomingCount === 1 ? '' : 's'}`
              : 'Friends'
          }
        >
          <Users size={23} strokeWidth={2.2} aria-hidden="true" />
          {incomingCount > 0 ? (
            <span className="topbar-friends-badge" aria-hidden="true">
              {incomingCount}
            </span>
          ) : null}
        </Link>

        <div className="profile" ref={menuRef}>
          <button
            className="avatar-button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {photoURL ? (
              <img className="avatar-photo" src={photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <GoogleIcon />
            )}
          </button>
          {menuOpen ? (
            <div className="profile-menu" role="menu">
              {email ? <p className="profile-email">{email}</p> : null}
              <button className="profile-signout" type="button" role="menuitem" onClick={() => void logout()}>
                <LogOut size={16} strokeWidth={2.2} />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
