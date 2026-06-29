type LoadingScreenProps = {
  // Fill the parent flex area (e.g. a lesson stage) instead of the whole viewport.
  inset?: boolean;
  testId?: string;
};

// The single loading state shared across pages: just the word "Loading", centered.
export function LoadingScreen({ inset = false, testId }: LoadingScreenProps) {
  return (
    <div
      className={inset ? 'loading-screen loading-screen--inset' : 'loading-screen'}
      role="status"
      data-testid={testId}
    >
      Loading
    </div>
  );
}
