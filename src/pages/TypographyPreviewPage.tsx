import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOGO_SRC } from '../components/SahhaBrand';
import {
  buildGoogleFontsUrl,
  filterPairs,
  TYPOGRAPHY_FONT_FAMILIES,
  TYPOGRAPHY_PAIRS,
  type TypographyFilter,
  type TypographyPair,
} from '../data/typographyCandidates';

const FILTERS: { id: TypographyFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'single-family', label: 'Single family' },
  { id: 'serif-wordmark', label: 'Serif wordmark' },
];

function pairStyles(pair: TypographyPair): React.CSSProperties {
  return {
    ['--preview-wordmark' as string]: `"${pair.wordmarkFont}", ui-sans-serif, system-ui, sans-serif`,
    ['--preview-ui' as string]: `"${pair.uiFont}", ui-sans-serif, system-ui, sans-serif`,
    ['--preview-wordmark-weight' as string]: String(pair.wordmarkWeight),
    ['--preview-ui-weight' as string]: String(pair.uiWeight ?? 400),
    ['--preview-wordmark-tracking' as string]: pair.wordmarkLetterSpacing ?? '0.03em',
  };
}

function PreviewCard({
  pair,
  selected,
  onSelect,
}: {
  pair: TypographyPair;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <article
      className={`type-preview-card ${selected ? 'type-preview-card--selected' : ''}`.trim()}
      style={pairStyles(pair)}
    >
      <div className="type-preview-card__header">
        <div>
          <h2 className="type-preview-card__title">{pair.name}</h2>
          <p className="type-preview-card__meta">
            Wordmark: {pair.wordmarkFont} · UI: {pair.uiFont}
          </p>
        </div>
        <div className="type-preview-card__badges">
          {pair.recommended && <span className="type-preview-badge type-preview-badge--rec">Pick</span>}
          {pair.singleFamily && <span className="type-preview-badge">One family</span>}
          {pair.serifWordmark && <span className="type-preview-badge">Serif</span>}
        </div>
      </div>

      <p className="type-preview-card__note">{pair.note}</p>

      {/* Brand lockup */}
      <div className="type-preview-lockup">
        <img src={LOGO_SRC} alt="" className="type-preview-lockup__mark" draggable={false} />
        <span className="type-preview-wordmark">Sahha</span>
      </div>

      {/* UI samples */}
      <div className="type-preview-ui">
        <p className="type-preview-label">Good morning</p>
        <h3 className="type-preview-headline">You&apos;re on track today</h3>
        <p className="type-preview-body">Say what you ate. See the breakdown.</p>

        <div className="type-preview-macros">
          <div><span className="type-preview-macro type-preview-macro--cal">420</span><span className="type-preview-macro-label">Cal</span></div>
          <div><span className="type-preview-macro type-preview-macro--pro">32g</span><span className="type-preview-macro-label">Protein</span></div>
          <div><span className="type-preview-macro type-preview-macro--carb">48g</span><span className="type-preview-macro-label">Carbs</span></div>
          <div><span className="type-preview-macro type-preview-macro--fat">14g</span><span className="type-preview-macro-label">Fats</span></div>
        </div>

        <div className="type-preview-row">
          <span className="type-preview-entry">Grilled chicken · 320 cal</span>
          <span className="type-preview-entry-meta">12:34 PM</span>
        </div>

        <button type="button" className="type-preview-btn">Log a meal</button>
      </div>

      <button
        type="button"
        className={`type-preview-select ${selected ? 'type-preview-select--active' : ''}`}
        onClick={() => onSelect(pair.id)}
      >
        {selected ? 'Shortlisted' : 'Shortlist this pair'}
      </button>
    </article>
  );
}

const TypographyPreviewPage: React.FC = () => {
  const [filter, setFilter] = useState<TypographyFilter>('recommended');
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem('sahha-type-shortlist'),
  );

  useEffect(() => {
    const linkId = 'typography-preview-fonts';
    if (document.getElementById(linkId)) return;

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = buildGoogleFontsUrl(TYPOGRAPHY_FONT_FAMILIES);
    document.head.appendChild(link);
  }, []);

  const visiblePairs = useMemo(() => filterPairs(filter), [filter]);
  const selectedPair = TYPOGRAPHY_PAIRS.find((p) => p.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    const next = selectedId === id ? null : id;
    setSelectedId(next);
    if (next) localStorage.setItem('sahha-type-shortlist', next);
    else localStorage.removeItem('sahha-type-shortlist');
  };

  return (
    <div className="type-preview-page app-bg min-h-dvh">
      <header className="type-preview-page__header safe-top">
        <div className="type-preview-page__header-inner">
          <div>
            <p className="type-preview-page__eyebrow">Sahha design</p>
            <h1 className="type-preview-page__title">Typography preview</h1>
            <p className="type-preview-page__desc">
              Compare wordmark + UI pairings. Brand text should stand out; everything else stays clean and aligned.
            </p>
          </div>
          <Link to="/" className="type-preview-back">← Back to app</Link>
        </div>

        <div className="type-preview-filters" role="tablist" aria-label="Filter pairings">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`type-preview-filter ${filter === id ? 'type-preview-filter--active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedPair && (
          <div className="type-preview-shortlist">
            <strong>Shortlisted:</strong> {selectedPair.name} — tell me this ID ({selectedPair.id}) when you&apos;re ready to apply it app-wide.
          </div>
        )}
      </header>

      <main className="type-preview-grid safe-bottom">
        {visiblePairs.map((pair) => (
          <PreviewCard
            key={pair.id}
            pair={pair}
            selected={selectedId === pair.id}
            onSelect={handleSelect}
          />
        ))}
      </main>
    </div>
  );
};

export default TypographyPreviewPage;
