export function BrandHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-navy/15 bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/tuma-logo-helmet-wordmark.svg"
          alt="Tuma"
          width={140}
          height={32}
          className="h-8 w-auto"
        />
        <span className="ml-auto rounded-full bg-green/15 px-2.5 py-0.5 text-xs font-medium text-green-600">
          Rider
        </span>
      </div>
    </header>
  );
}
