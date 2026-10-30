import type { MobileAction } from "../lib/mobile-actions";

type LabelledAction = MobileAction & { label: string; onPress: () => void };

// A second control surface for small screens: the stage's primary action and skip,
// pinned to the bottom edge. Purely presentational — Storypress computes the actions
// (lib/mobile-actions.ts) from state it already owns. Hidden ≥801 px by CSS.
export function MobileActionBar({ actions, visible }: { actions: LabelledAction[]; visible: boolean }) {
 if (!visible || actions.length === 0) return null;
 const primary = actions.find(a => a.kind === "primary");
 const secondary = actions.filter(a => a !== primary);
 return (
  <div className="mobile-action-bar no-print" role="toolbar" aria-label="Story actions">
   {primary && <div className="mobile-bar-primary">
    <button className="bar-btn primary" onClick={primary.onPress} disabled={!primary.enabled}>{primary.label}</button>
    {!primary.enabled && primary.hint && <p className="bar-hint" role="note">{primary.hint}</p>}
   </div>}
   {secondary.map(a => <button key={a.id} className="bar-btn secondary" onClick={a.onPress} disabled={!a.enabled}>{a.label}</button>)}
  </div>
 );
}
