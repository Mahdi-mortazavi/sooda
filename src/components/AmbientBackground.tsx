/** Soft drifting color blobs behind the glass surfaces so the blur has something to refract. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="ambient-blob animate-blob-a h-[46vh] w-[46vh] opacity-60 dark:opacity-45"
        style={{
          top: '-8%',
          insetInlineStart: '-12%',
          background: 'radial-gradient(circle at 35% 35%, hsl(165 75% 55% / 0.55), transparent 70%)',
        }}
      />
      <div
        className="ambient-blob animate-blob-b h-[52vh] w-[52vh] opacity-55 dark:opacity-40"
        style={{
          top: '22%',
          insetInlineEnd: '-18%',
          background: 'radial-gradient(circle at 60% 40%, hsl(190 80% 60% / 0.45), transparent 70%)',
        }}
      />
      <div
        className="ambient-blob animate-blob-c h-[40vh] w-[40vh] opacity-45 dark:opacity-30"
        style={{
          bottom: '-10%',
          insetInlineStart: '18%',
          background: 'radial-gradient(circle at 50% 50%, hsl(45 95% 62% / 0.4), transparent 70%)',
        }}
      />
    </div>
  )
}
