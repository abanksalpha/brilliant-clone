type AvatarProps = {
  name: string;
  photoURL?: string | null;
  size?: number;
  title?: string;
  className?: string;
};

function joinClassNames(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** Initials from the first one or two words of a name (e.g. "Ada Lovelace" -> "AL"). */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const first = words[0]![0] ?? '';
  const second = words.length > 1 ? (words[words.length - 1]![0] ?? '') : '';
  return (first + second).toUpperCase() || '?';
}

/**
 * Round avatar that shows a photo when available and falls back to initials.
 * Used in the friends list/search and stacked on the dashboard timeline.
 */
export function Avatar({ name, photoURL, size = 36, title, className }: AvatarProps) {
  return (
    <span
      className={joinClassNames('avatar', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      title={title ?? name}
      role="img"
      aria-label={name}
    >
      {photoURL ? (
        <img className="avatar-img" src={photoURL} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="avatar-initials" aria-hidden="true">
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}
