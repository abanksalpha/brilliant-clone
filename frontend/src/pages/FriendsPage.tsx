import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Clock, UserPlus, Users, X } from 'lucide-react';
import { AppShell } from '../components/shell/AppShell';
import { Avatar } from '../components/Avatar';
import { friendPositionLabel } from '../content/courseMap';
import { useSocial } from '../social/SocialContext';
import type { Profile } from '../social/types';

function personName(profile: Profile | null, fallbackUid: string): string {
  if (profile?.displayName) {
    return profile.displayName;
  }
  return `Learner ${fallbackUid.slice(0, 4)}`;
}

export function FriendsPage() {
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    listPeople,
    getRelationship,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
  } = useSocial();

  const [people, setPeople] = useState<Profile[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyUids, setBusyUids] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let active = true;
    setIsLoadingPeople(true);
    listPeople()
      .then((found) => {
        if (active) {
          setPeople(found);
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not load classmates. Please try again.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingPeople(false);
        }
      });
    return () => {
      active = false;
    };
  }, [listPeople]);

  // The "request sent" banner is transient; clear it after a few seconds.
  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Only people you have no relationship with yet are addable; friends, pending,
  // and incoming requests are handled in their own sections below.
  const addable = useMemo(
    () => people.filter((person) => getRelationship(person.uid) === 'none'),
    [people, getRelationship],
  );

  // Search is by email only; results display the person's name. A case-insensitive
  // substring match keeps a typed address forgiving, and the list is capped so the
  // section stays tidy.
  const trimmedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!trimmedQuery) {
      return [];
    }
    return addable
      .filter((person) => person.email.toLowerCase().includes(trimmedQuery))
      .slice(0, 8);
  }, [addable, trimmedQuery]);

  async function handleAdd(uid: string) {
    const person =
      matches.find((candidate) => candidate.uid === uid) ??
      addable.find((candidate) => candidate.uid === uid);
    const name = person ? personName(person, uid) : 'this person';
    const sent = await runAction(uid, () => sendRequest(uid));
    if (sent) {
      setQuery('');
      setNotice(`Friend request sent to ${name}. They'll need to accept it before you're connected.`);
    }
  }

  async function runAction(uid: string, action: () => Promise<void>): Promise<boolean> {
    setBusyUids((previous) => new Set(previous).add(uid));
    setError('');
    setNotice('');
    try {
      await action();
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong.');
      return false;
    } finally {
      setBusyUids((previous) => {
        const next = new Set(previous);
        next.delete(uid);
        return next;
      });
    }
  }

  return (
    <AppShell className="app-shell--handdrawn" showCourseSwitcher={false}>
      <div className="friends-page">
        <Link className="friends-back" to="/dashboard">
          <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" /> Return to dashboard
        </Link>
        <header className="friends-header">
          <h1 className="friends-title">
            <Users size={26} strokeWidth={2.2} aria-hidden="true" /> Friends
          </h1>
          <p className="friends-lede">
            Search for a classmate by email, then send them a friend request.
          </p>
        </header>

        <section className="friends-section" aria-labelledby="friends-add-title">
          <h2 id="friends-add-title" className="friends-section-title">
            Add a friend
          </h2>
          <form className="friends-add" onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="friend-search">
              Search by email
            </label>
            <input
              id="friend-search"
              type="search"
              className="friends-select"
              value={query}
              placeholder="Search by email"
              autoComplete="off"
              disabled={isLoadingPeople}
              onChange={(event) => {
                setError('');
                setNotice('');
                setQuery(event.target.value);
              }}
            />
          </form>

          {isLoadingPeople ? (
            <p className="friends-empty" role="status">
              Loading classmates…
            </p>
          ) : trimmedQuery && matches.length === 0 ? (
            <p className="friends-empty" role="status">
              No one found with that email.
            </p>
          ) : matches.length > 0 ? (
            <ul className="friends-list" aria-label="Search results">
              {matches.map((person) => {
                const name = personName(person, person.uid);
                const busy = busyUids.has(person.uid);
                return (
                  <li className="friend-row" key={person.uid}>
                    <Avatar name={name} photoURL={person.photoURL} size={44} />
                    <div className="friend-row-info">
                      <span className="friend-row-name">{name}</span>
                      {person.email ? <span className="friend-row-meta">{person.email}</span> : null}
                    </div>
                    <div className="friend-row-action">
                      <button
                        type="button"
                        className="friend-action"
                        disabled={busy}
                        onClick={() => void handleAdd(person.uid)}
                      >
                        <UserPlus size={15} strokeWidth={2.4} aria-hidden="true" /> Add friend
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="friends-notice" role="status">
              {notice}
            </p>
          ) : null}
        </section>

        {incomingRequests.length > 0 ? (
          <section className="friends-section" aria-labelledby="friends-incoming-title">
            <h2 id="friends-incoming-title" className="friends-section-title">
              Friend requests ({incomingRequests.length})
            </h2>
            <ul className="friends-list" aria-label="Incoming friend requests">
              {incomingRequests.map(({ uid, profile }) => {
                const busy = busyUids.has(uid);
                const name = personName(profile, uid);
                return (
                  <li className="friend-row" key={uid}>
                    <Avatar name={name} photoURL={profile?.photoURL ?? null} size={44} />
                    <div className="friend-row-info">
                      <span className="friend-row-name">{name}</span>
                      {profile?.email ? <span className="friend-row-meta">{profile.email}</span> : null}
                    </div>
                    <div className="friend-row-action friend-row-action--pair">
                      <button
                        type="button"
                        className="friend-action friend-action--accept"
                        disabled={busy}
                        onClick={() => void runAction(uid, () => acceptRequest(uid))}
                      >
                        <Check size={15} strokeWidth={2.6} aria-hidden="true" /> Accept
                      </button>
                      <button
                        type="button"
                        className="friend-action friend-action--ghost"
                        disabled={busy}
                        aria-label={`Decline request from ${name}`}
                        onClick={() => void runAction(uid, () => declineRequest(uid))}
                      >
                        <X size={15} strokeWidth={2.6} aria-hidden="true" /> Decline
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="friends-section" aria-labelledby="friends-list-title">
          <h2 id="friends-list-title" className="friends-section-title">
            Your friends ({friends.length})
          </h2>
          {friends.length > 0 ? (
            <ul className="friends-list" aria-label="Your friends">
              {friends.map(({ uid, profile }) => {
                const busy = busyUids.has(uid);
                const name = personName(profile, uid);
                return (
                  <li className="friend-row" key={uid}>
                    <Avatar name={name} photoURL={profile?.photoURL ?? null} size={44} />
                    <div className="friend-row-info">
                      <span className="friend-row-name">{name}</span>
                      <span className="friend-row-meta">
                        On: {friendPositionLabel(profile?.completedCount ?? 0, profile?.completedPsetCount ?? 0)}
                      </span>
                    </div>
                    <div className="friend-row-action">
                      <button
                        type="button"
                        className="friend-action friend-action--ghost"
                        disabled={busy}
                        aria-label={`Remove ${name}`}
                        onClick={() => void runAction(uid, () => removeFriend(uid))}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="friends-empty" role="status">
              No friends yet. Pick a classmate above to add some.
            </p>
          )}
        </section>

        {outgoingRequests.length > 0 ? (
          <section className="friends-section" aria-labelledby="friends-outgoing-title">
            <h2 id="friends-outgoing-title" className="friends-section-title">
              Sent requests ({outgoingRequests.length})
            </h2>
            <ul className="friends-list" aria-label="Sent friend requests">
              {outgoingRequests.map(({ uid, profile }) => {
                const busy = busyUids.has(uid);
                const name = personName(profile, uid);
                return (
                  <li className="friend-row" key={uid}>
                    <Avatar name={name} photoURL={profile?.photoURL ?? null} size={44} />
                    <div className="friend-row-info">
                      <span className="friend-row-name">{name}</span>
                      <span className="friend-row-meta">
                        <Clock size={13} strokeWidth={2.4} aria-hidden="true" /> Pending
                      </span>
                    </div>
                    <div className="friend-row-action">
                      <button
                        type="button"
                        className="friend-action friend-action--ghost"
                        disabled={busy}
                        aria-label={`Cancel request to ${name}`}
                        onClick={() => void runAction(uid, () => cancelRequest(uid))}
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
