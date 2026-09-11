import { useEffect, useMemo, useRef, useState } from 'react';
import type { Answers, AppState, Config } from './types';
import { storage } from './modules/storage';
import { defaultConfig, resolveConfig } from './modules/settings/config';
import { questions } from './modules/questionnaire/data';
import { assess } from './modules/questionnaire/scoring';
import { applyDirectionGate } from './modules/dom';

const format = (n?: number | null) => n == null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
function mergedConfig(s: AppState): Config { return resolveConfig(s.config); }
type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type Phase = 'idle' | 'leaving-forward' | 'entering-forward' | 'leaving-back' | 'entering-back';

export function App() {
  const [state, setState] = useState<AppState>(() => storage.read());
  const [showSettings, setShowSettings] = useState(false);
  const [settingsText, setSettingsText] = useState('');
  const [isOpen, setIsOpen] = useState(() => storage.read().popupOpen ?? false);
  const [draftAnswers, setDraftAnswers] = useState<Answers>(() => storage.read().answers ?? {});
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [popupPosition, setPopupPosition] = useState(() => storage.read().popupPosition);
  const [popupSize, setPopupSize] = useState(() => storage.read().popupSize);
  const latestPosition = useRef(popupPosition);
  const latestSize = useRef(popupSize);
  const config = mergedConfig(state);
  const configKey = JSON.stringify(config);
  const result = useMemo(() => assess(draftAnswers), [draftAnswers]);
  const dayPercent = state.capital && state.dayPnl != null ? state.dayPnl / state.capital * 100 : null;
  const [id, label, options] = questions[activeQuestion];

  useEffect(() => {
    const refresh = () => setState(storage.read());
    window.addEventListener('kattappa:update', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('kattappa:update', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  useEffect(() => {
    const root = document.getElementById('kattappa-root');
    if (!root) return;
    if (popupPosition) { root.style.left = `${popupPosition.left}px`; root.style.top = `${popupPosition.top}px`; root.style.right = 'auto'; }
    if (popupSize) { root.style.width = `${popupSize.width}px`; root.style.height = `${popupSize.height}px`; }
  }, [popupPosition, popupSize]);
  useEffect(() => {
    document.getElementById('kattappa-root')?.classList.toggle('kattappa-collapsed', !isOpen);
  }, [isOpen]);
  useEffect(() => {
    applyDirectionGate(state.bias ?? 'LOCKED', config);
  }, [configKey, state.bias]);

  function chooseAnswer(value: string) {
    if (phase !== 'idle') return;
    const next = { ...draftAnswers, [id]: value };
    setDraftAnswers(next); storage.write({ answers: next });
    if (activeQuestion < questions.length - 1) transition('forward');
  }
  function nextQuestion() {
    if (!draftAnswers[id] || phase !== 'idle') return;
    if (activeQuestion < questions.length - 1) { transition('forward'); return; }
    const outcome = assess(draftAnswers);
    storage.write({ answers: draftAnswers, bias: outcome.bias });
    applyDirectionGate(outcome.bias, config);
  }
  function resetAssessment() {
    setDraftAnswers({}); setActiveQuestion(0); setPhase('idle');
    storage.write({ answers: {}, bias: 'LOCKED' }); applyDirectionGate('LOCKED', config);
  }
  function transition(direction: 'forward' | 'back') {
    if (phase !== 'idle' || (direction === 'back' && activeQuestion === 0)) return;
    setPhase(`leaving-${direction}`);
    window.setTimeout(() => {
      setActiveQuestion(current => current + (direction === 'forward' ? 1 : -1));
      setPhase(`entering-${direction}`);
      window.setTimeout(() => setPhase('idle'), 220);
    }, 190);
  }
  function saveSettings() {
    try { storage.write({ config: { ...defaultConfig, ...JSON.parse(settingsText) } }); setShowSettings(false); }
    catch { alert('Settings JSON is invalid. Nothing was changed.'); }
  }
  function startDrag(event: React.PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button')) return;
    const root = document.getElementById('kattappa-root'); if (!root) return;
    event.preventDefault(); const rect = root.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    const move = (pointer: PointerEvent) => {
      const next = { left: clamp(start.left + pointer.clientX - start.x, 0, window.innerWidth - rect.width), top: clamp(start.top + pointer.clientY - start.y, 0, window.innerHeight - rect.height) };
      latestPosition.current = next; setPopupPosition(next);
    };
    const end = () => { window.removeEventListener('pointermove', move); storage.write({ popupPosition: latestPosition.current }); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true });
  }
  function startResize(event: React.PointerEvent<HTMLDivElement>, direction: Direction) {
    const root = document.getElementById('kattappa-root'); if (!root) return;
    event.preventDefault(); event.stopPropagation(); const rect = root.getBoundingClientRect();
    const card = root.shadowRoot?.querySelector<HTMLElement>('.kattappa-card');
    // Temporarily remove the forced fill height to find the height needed by real content.
    const previousHeight = card?.style.height ?? '';
    if (card) card.style.height = 'auto';
    const maximumContentHeight = Math.max(400, card?.scrollHeight ?? 400);
    if (card) card.style.height = previousHeight;
    const start = { x: event.clientX, y: event.clientY };
    const move = (pointer: PointerEvent) => {
      const dx = pointer.clientX - start.x, dy = pointer.clientY - start.y;
      const east = direction.includes('e'), west = direction.includes('w'), south = direction.includes('s'), north = direction.includes('n');
      let width = clamp(rect.width + (east ? dx : west ? -dx : 0), 400, east ? window.innerWidth - rect.left : rect.right);
      let height = clamp(rect.height + (south ? dy : north ? -dy : 0), 400, Math.min(maximumContentHeight, south ? window.innerHeight - rect.top : rect.bottom));
      const position = { left: west ? rect.right - width : rect.left, top: north ? rect.bottom - height : rect.top };
      const size = { width, height };
      latestPosition.current = position; latestSize.current = size; setPopupPosition(position); setPopupSize(size);
    };
    const end = () => { window.removeEventListener('pointermove', move); storage.write({ popupPosition: latestPosition.current, popupSize: latestSize.current }); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true });
  }
  if (!isOpen) return <button className="load-kattappa" type="button" onClick={() => { setIsOpen(true); storage.write({ popupOpen: true }); }}>Kattappa</button>;
  return <><div className="kattappa-overlay" aria-hidden="true" /><main className="kattappa-card">
    <header onPointerDown={startDrag}><b>Kattappa</b><span>Trading discipline · drag here</span><button type="button" className="close-kattappa" aria-label="Hide Kattappa" title="Hide Kattappa" onClick={() => { setIsOpen(false); storage.write({ popupOpen: false }); }}>×</button></header>
    <section className="stats"><Stat label="Capital" value={`₹${format(state.capital)}`} /><Stat label="Day P&L" value={`₹${format(state.dayPnl)}`} tone={state.dayPnl == null ? '' : state.dayPnl >= 0 ? 'good' : 'bad'} detail={dayPercent == null ? '' : `${dayPercent.toFixed(2)}%`} /><Stat label="Open P&L" value={`₹${format(state.openTradePnl)}`} tone={state.openTradePnl == null ? '' : state.openTradePnl >= 0 ? 'good' : 'bad'} /><Stat label="Direction" value={state.bias ?? 'LOCKED'} tone={(state.bias ?? 'LOCKED') === 'CE' ? 'good' : (state.bias ?? 'LOCKED') === 'PE' ? 'bad' : 'warn'} /></section>
    {state.killTriggered && <aside className="notice bad"><b>Kill switch triggered.</b> {state.killTriggered.reason}</aside>}
    {state.tradeLossAlert && <aside className="notice warn"><b>Trade-loss alert.</b> {state.tradeLossAlert.percent.toFixed(2)}% of capital reached.</aside>}
    <section className="questionnaire"><div className="progress"><span>Market assessment</span><b>{activeQuestion + 1} / {questions.length}</b></div><div className={`question-stage ${phase}`}><label className="question">{label}<select value={draftAnswers[id] ?? ''} onChange={event => chooseAnswer(event.target.value)} disabled={phase !== 'idle'}><option value="" disabled>Choose an assessment…</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label></div><div className="question-nav"><div className="question-nav-left"><button type="button" className="secondary" onClick={() => transition('back')} disabled={activeQuestion === 0 || phase !== 'idle'}>← Back</button>{activeQuestion < questions.length - 1 && <button type="button" onClick={nextQuestion} disabled={!draftAnswers[id] || phase !== 'idle'}>Next →</button>}<button type="button" className="secondary reset-icon" onClick={resetAssessment} aria-label="Reset assessment" title="Reset assessment">↺</button></div>{activeQuestion === questions.length - 1 && draftAnswers[id] && <button type="button" onClick={nextQuestion} disabled={phase !== 'idle'}>Suggest trend</button>}</div></section>
    {result.answered === questions.length && <aside className={`notice ${result.bias === 'CE' ? 'good' : result.bias === 'PE' ? 'bad' : 'warn'}`}><b>Direction result:</b> {result.bias === 'CE' ? 'Bullish — CE access allowed.' : result.bias === 'PE' ? 'Bearish — PE access allowed.' : 'No clear direction — both sides remain locked.'} {state.bias === result.bias ? '' : 'Press Suggest trend to enforce it.'}</aside>}
    <p className="score">Score <b>{result.score}</b> · {result.answered}/6 answered · CE needs +3, PE needs −3.</p>
    <div className="actions"><button className="secondary" onClick={() => storage.write({ bias: 'LOCKED' })}>Lock both sides</button><button className="secondary" onClick={() => setState(storage.read())}>Refresh values</button><button className="secondary" onClick={() => { setSettingsText(JSON.stringify(config, null, 2)); setShowSettings(!showSettings); }}>Settings</button><button className="danger" onClick={() => storage.write({ killTriggered: null, tradeLossAlert: null })}>Reset alerts</button></div>
    {showSettings && <section className="settings"><p>Use verified broker URLs and selectors only. Both automatic actions are off by default.</p><textarea value={settingsText} onChange={e => setSettingsText(e.target.value)} /><button onClick={saveSettings}>Save settings</button></section>}
    <footer>DOM-only · Browser storage key: <code>{storage.key}</code></footer>
    {(['n', 'e', 's', 'w'] as const).map(edge => <div key={edge} className={`drag-boundary ${edge}`} onPointerDown={startDrag} aria-label="Drag Kattappa" />)}
    {(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as Direction[]).map(direction => <div key={direction} className={`resize-handle ${direction}`} onPointerDown={event => startResize(event, direction)} />)}
  </main></>;
}
function Stat({ label, value, tone = '', detail = '' }: { label: string; value: string; tone?: string; detail?: string }) { return <div className="stat"><small>{label}</small><b className={tone}>{value}</b>{detail && <small>{detail}</small>}</div>; }
