import { useMemo } from 'react';

export function BandcampPlayer(props: { embedSrc: string; show: boolean }) {
  const { embedSrc, show } = props;

  const pipClass = show
    ? 'absolute inset-0 z-10'
    : 'absolute bottom-4 right-4 w-72 h-24 z-20 rounded-lg overflow-hidden shadow-lg border border-border bg-background';

  const src = useMemo(() => embedSrc.trim(), [embedSrc]);

  return (
    <div className={pipClass}>
      <iframe
        title="Bandcamp player"
        style={{ border: 0, width: '100%', height: '100%' }}
        src={src}
        seamless
      />
    </div>
  );
}

