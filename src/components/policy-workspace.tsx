'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe2,
  LayoutDashboard,
  ListFilter,
  Loader2,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import type { PolicyChange, PolicyDashboardData } from '@/lib/policy-service';
import { auditCatalog, csvCell } from '@/lib/policy-domain';
import {
  dateLabel,
  Dialog,
  EmptyState,
  moneyLabel,
  PayerMark,
  PolicyRow,
  Priority,
  SourceLink,
} from './policy-ui';
import './policy-workspace.css';

type View =
  | 'Overview'
  | 'Policy feed'
  | 'Daily briefings'
  | 'Chargemaster'
  | 'CPT explorer'
  | 'Action items'
  | 'Payer sources'
  | 'Settings';
const navItems = [
  { title: 'Overview', icon: LayoutDashboard },
  { title: 'Policy feed', icon: Radio },
  { title: 'Daily briefings', icon: Sparkles },
  { title: 'Chargemaster', icon: FileSpreadsheet },
  { title: 'CPT explorer', icon: Code2 },
  { title: 'Action items', icon: FileCheck2 },
] as const;

export function PolicyWorkspace({ initialData }: { initialData: PolicyDashboardData }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>('Overview');
  const [demo, setDemo] = useState(true);
  const [query, setQuery] = useState('');
  const [payer, setPayer] = useState('All payers');
  const [impact, setImpact] = useState('All impacts');
  const [tab, setTab] = useState('All updates');
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<'upload' | 'source' | 'help' | null>(null);
  const [briefingId, setBriefingId] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const updates = data.updates.filter((update) => update.isDemo === demo);
  const sources = data.sources.filter((source) => source.isDemo === demo);
  const briefs = data.briefings.filter((brief) => brief.isDemo === demo);
  const entries = data.catalog?.entries ?? [];
  const audited = useMemo(
    () =>
      auditCatalog(
        data.catalog?.entries ?? [],
        data.updates.filter((update) => update.isDemo === demo),
      ),
    [data, demo],
  );
  const impacted = audited.filter((entry) => entry.updateIds.length);
  const affectedCodes = new Set(impacted.map((entry) => entry.code));
  const actions = updates.filter((update) => update.priority === 'High' && !update.reviewed);
  const today = new Date().toISOString().slice(0, 10);
  const todaysUpdates = updates.filter((update) => update.createdAt.startsWith(today));
  const detail = data.updates.find((update) => update.id === selected);
  const briefing = briefs.find((brief) => brief.id === briefingId);
  const matchedEntries = detail
    ? entries.filter((entry) => detail.codes.split(',').includes(entry.code))
    : [];
  const filtered = updates.filter((update) => {
    const text =
      `${update.title} ${update.payer} ${update.codes} ${update.category} ${update.summary}`.toLowerCase();
    return (
      text.includes(query.toLowerCase()) &&
      (payer === 'All payers' || update.payer === payer) &&
      (impact === 'All impacts' || update.priority === impact) &&
      (tab !== 'Needs review' || !update.reviewed) &&
      (tab !== 'My chargemaster' ||
        impacted.some((entry) => entry.updateIds.includes(update.id))) &&
      (view !== 'Action items' || (update.priority === 'High' && !update.reviewed))
    );
  });
  const nextDates = updates
    .filter((update) => update.effectiveAt && new Date(update.effectiveAt) >= new Date(today))
    .sort((a, b) => a.effectiveAt!.localeCompare(b.effectiveAt!))
    .slice(0, 3);
  const go = (next: View) => {
    setView(next);
    setQuery('');
    setPayer('All payers');
    setImpact('All impacts');
    setTab('All updates');
    setMobileNav(false);
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function mutate(body: object | FormData, key: string): Promise<boolean> {
    if (busy) return false;
    setBusy(key);
    try {
      const response = await fetch(
        '/api/policies',
        body instanceof FormData
          ? { method: 'POST', body }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
      );
      const result: { message?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed.');
      const refreshed = await fetch('/api/policies');
      if (!refreshed.ok)
        throw new Error('The change was saved, but refreshing failed. Reload the page.');
      setData(await refreshed.json());
      setToast({ message: result.message || 'Saved.', error: false });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete the request.';
      setToast({ message, error: true });
      if (key === 'upload') setUploadError(message);
      if (key === 'source') setSourceError(message);
      const refreshed = await fetch('/api/policies').catch(() => null);
      if (refreshed?.ok) setData(await refreshed.json());
      return false;
    } finally {
      setBusy('');
    }
  }
  function download(text: string, name: string, type = 'text/csv') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportAudit() {
    const header = [
      'code',
      'description',
      'department',
      'charge',
      'annual_volume',
      'matched_policies',
      'dataset',
    ];
    const rows = audited.map((entry) => [
      entry.code,
      entry.description,
      entry.department,
      entry.charge,
      entry.annualVolume,
      entry.updateIds
        .map((id) => updates.find((update) => update.id === id)?.title ?? '')
        .join('; '),
      demo ? 'SYNTHETIC EXAMPLES' : 'Live page change candidates',
    ]);
    download(
      [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'),
      'policy-impact-audit.csv',
    );
  }
  async function upload() {
    if (!file) {
      setUploadError('Choose a CSV file first.');
      return;
    }
    setUploadError('');
    const form = new FormData();
    form.set('file', file);
    if (await mutate(form, 'upload')) {
      setModal(null);
      setFile(null);
      go('Chargemaster');
    }
  }
  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSourceError('');
    const values = new FormData(event.currentTarget);
    if (
      await mutate(
        {
          action: 'source',
          name: values.get('name'),
          payer: values.get('payer'),
          url: values.get('url'),
        },
        'source',
      )
    ) {
      setModal(null);
      setDemo(false);
      go('Payer sources');
    }
  }
  const openUpload = () => {
    setUploadError('');
    setFile(null);
    setModal('upload');
  };
  const matchCount = (update: PolicyChange) =>
    new Set(
      impacted.filter((entry) => entry.updateIds.includes(update.id)).map((entry) => entry.code),
    ).size;
  const renderFeed = () => (
    <section className="pp-panel feed-panel">
      <div className="panel-heading">
        <div>
          <h2>
            {view === 'Action items' ? 'Your review queue' : 'Latest policy updates'}{' '}
            <span className="count-badge">{filtered.length}</span>
          </h2>
          <p>
            {view === 'Action items'
              ? 'High-impact changes that need your team’s attention.'
              : 'The changes that matter, with the context you need.'}
          </p>
        </div>
        {view === 'Overview' && (
          <button className="text-link" onClick={() => go('Policy feed')}>
            View all <ArrowRight size={14} />
          </button>
        )}
      </div>
      <div className="feed-tabs">
        {['All updates', 'Needs review', 'My chargemaster'].map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item}
            {item === 'Needs review' && (
              <span>{updates.filter((update) => !update.reviewed).length}</span>
            )}
          </button>
        ))}
      </div>
      <div className="feed-filters">
        <label className="filter-search">
          <Search size={15} />
          <input
            aria-label="Search policy updates"
            placeholder="Search policies, CPT codes..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="select-wrap">
          <Filter size={14} />
          <select
            aria-label="Filter by payer"
            value={payer}
            onChange={(event) => setPayer(event.target.value)}
          >
            <option>All payers</option>
            {[...new Set(updates.map((update) => update.payer))].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="select-wrap">
          <ListFilter size={14} />
          <select
            aria-label="Filter by impact"
            value={impact}
            onChange={(event) => setImpact(event.target.value)}
          >
            <option>All impacts</option>
            {['High', 'Medium', 'Low', 'Review'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length ? (
        filtered
          .slice(0, view === 'Overview' ? 5 : undefined)
          .map((change) => (
            <PolicyRow
              key={change.id}
              change={change}
              matches={matchCount(change)}
              open={() => setSelected(change.id)}
            />
          ))
      ) : (
        <EmptyState title="You’re all caught up">
          {updates.length
            ? 'No policy updates match these filters. Try another payer or CPT code.'
            : 'Add a payer source and save a baseline. Future page changes will appear here.'}
        </EmptyState>
      )}
      <div className="feed-footer">
        <span>
          <ShieldCheck size={13} />
          {demo
            ? 'Illustrative policies · verify with the original payer'
            : 'Source-linked changes · review before updating billing rules'}
        </span>
        <span>
          {Math.min(filtered.length, view === 'Overview' ? 5 : filtered.length)} of{' '}
          {filtered.length} updates
        </span>
      </div>
    </section>
  );

  return (
    <div className="pp-app">
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`pp-sidebar ${mobileNav ? 'is-open' : ''}`}>
        <button className="pp-logo" onClick={() => go('Overview')}>
          <span className="logo-symbol">
            <Activity size={24} strokeWidth={2.5} />
          </span>
          <span>
            Policy<span>Pulse</span>
            <small>PAYER INTELLIGENCE</small>
          </span>
        </button>
        <button className="workspace-select" onClick={() => go('Settings')}>
          <span className="practice-icon">
            <Plus size={16} />
          </span>
          <span>
            My practice<small>Revenue operations</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(({ title, icon: Icon }) => (
            <button
              key={title}
              onClick={() => go(title)}
              className={`nav-item ${view === title ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{title}</span>
              {title === 'Policy feed' && (
                <span className="nav-count">
                  {updates.filter((update) => !update.reviewed).length}
                </span>
              )}
              {title === 'Action items' && actions.length > 0 && (
                <span className="nav-count orange">{actions.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label manage-label">MANAGE</div>
        <button
          className={`nav-item ${view === 'Payer sources' ? 'active' : ''}`}
          onClick={() => go('Payer sources')}
        >
          <Globe2 size={18} />
          <span>Payer sources</span>
          <span className="source-dot" />
        </button>
        <button
          className={`nav-item ${view === 'Settings' ? 'active' : ''}`}
          onClick={() => go('Settings')}
        >
          <Settings2 size={18} />
          <span>Settings</span>
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <span className="promo-spark">
              <Sparkles size={19} />
            </span>
            <h3>Make it personal.</h3>
            <p>
              Connect your chargemaster.
              <br />
              See what matters to your practice.
            </p>
            <button onClick={openUpload}>
              Upload chargemaster <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="help-button" onClick={() => setModal('help')}>
            <CircleHelp size={17} />
            Help & getting started <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-profile">
            <span className="avatar">NS</span>
            <div>
              Nishanth S.<small>Practice administrator</small>
            </div>
            <button
              className="icon-button"
              aria-label="Workspace settings"
              onClick={() => go('Settings')}
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="pp-main">
        <header className="pp-header">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <div className="header-actions">
            <label className="global-search">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search workspace"
                placeholder="Search anything..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (!['CPT explorer', 'Chargemaster'].includes(view)) setView('Policy feed');
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="icon-button notification-button"
              aria-label="View unreviewed notifications"
              onClick={() => {
                go('Policy feed');
                setTab('Needs review');
              }}
            >
              <Bell size={19} />
              {updates.some((update) => !update.reviewed) && <i />}
            </button>
            <span className="header-divider" />
            <span className="avatar small-avatar">NS</span>
          </div>
        </header>
        <main className="pp-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </div>
              <h1>{view === 'Overview' ? 'Your policy radar, in focus.' : view}</h1>
              <p>
                {
                  {
                    Overview:
                      'Stay ahead of payer changes. Know what changed, why it matters, and what to do next.',
                    'Policy feed': 'Every policy change, connected to the services you provide.',
                    'Daily briefings':
                      'Your daily readout of payer changes and practical next steps.',
                    Chargemaster: 'Your services, connected to payer policy intelligence.',
                    'CPT explorer':
                      'Follow a code from your chargemaster to the policies that mention it.',
                    'Action items': 'Turn policy intelligence into a clear plan for your team.',
                    'Payer sources': 'Manage the public policy pages your practice follows.',
                    Settings: 'A clear view of your workspace and monitoring configuration.',
                  }[view]
                }
              </p>
            </div>
            <div className="page-heading-actions">
              <button
                className="pp-button secondary"
                onClick={() => {
                  setSourceError('');
                  setModal('source');
                }}
              >
                <Plus size={16} />
                Add payer
              </button>
              <button className="pp-button primary" onClick={openUpload}>
                <Upload size={16} />
                Upload chargemaster
              </button>
            </div>
          </div>
          <div className="workspace-context">
            <div className="dataset-switch">
              <button
                className={demo ? 'active' : ''}
                onClick={() => {
                  setDemo(true);
                  setPayer('All payers');
                }}
              >
                Example workspace
              </button>
              <button
                className={!demo ? 'active' : ''}
                onClick={() => {
                  setDemo(false);
                  setPayer('All payers');
                }}
              >
                Live sources
              </button>
            </div>
            <span>
              <span className={`status-dot ${demo ? 'violet' : 'green'}`} />
              {demo
                ? 'Sample policies & illustrative recommendations'
                : 'Public page monitoring · checks run on demand or via your daily job'}
            </span>
          </div>

          {view === 'Overview' && (
            <>
              <section className="stats-grid">
                {[
                  {
                    label: 'Policy updates today',
                    value: todaysUpdates.length,
                    icon: FileText,
                    tone: 'purple',
                    note: `${new Set(todaysUpdates.map((update) => update.payer)).size} payers with new activity`,
                    goto: 'Policy feed' as View,
                  },
                  {
                    label: 'Payers monitored',
                    value: new Set(
                      sources.filter((source) => source.enabled).map((source) => source.payer),
                    ).size,
                    icon: Globe2,
                    tone: 'blue',
                    note: demo
                      ? 'Explore your sample source library'
                      : `${sources.filter((source) => source.lastError).length} sources need attention`,
                    goto: 'Payer sources' as View,
                  },
                  {
                    label: 'CPT / HCPCS codes affected',
                    value: affectedCodes.size,
                    icon: Code2,
                    tone: 'purple',
                    note: 'Matched to your chargemaster',
                    goto: 'CPT explorer' as View,
                  },
                  {
                    label: 'Action items',
                    value: actions.length,
                    icon: FileCheck2,
                    tone: 'orange',
                    note: 'High-impact updates to review',
                    goto: 'Action items' as View,
                  },
                ].map(({ label, value, icon: Icon, tone, note, goto }) => (
                  <button className="stat-card" key={label} onClick={() => go(goto)}>
                    <div className="stat-label">
                      {label}
                      <span className={`stat-icon ${tone}`}>
                        <Icon size={17} />
                      </span>
                    </div>
                    <strong>{value.toString().padStart(2, '0')}</strong>
                    <div className={`stat-note ${tone === 'orange' ? 'orange-text' : ''}`}>
                      {tone === 'orange' ? (
                        <Clock3 size={12} />
                      ) : (
                        <span className={`mini-dot ${tone}`} />
                      )}
                      {note}
                      <ArrowUpRight size={13} />
                    </div>
                  </button>
                ))}
              </section>
              <div className="overview-grid">
                <div className="overview-primary">
                  <section className="briefing-card">
                    <div className="briefing-watermark">
                      <Sparkles />
                    </div>
                    <div className="briefing-top">
                      <span className="briefing-icon">
                        <Sparkles size={19} />
                      </span>
                      <h2>Your daily intelligence briefing</h2>
                      <span className="ai-badge">
                        {demo ? 'DEMO BRIEFING' : data.aiConfigured ? 'AI ASSISTED' : 'RULE-BASED'}
                      </span>
                      <span className="briefing-date">{dateLabel(new Date().toISOString())}</span>
                    </div>
                    <h3>A little clarity for a busy day.</h3>
                    <p>
                      {todaysUpdates.length ? (
                        <>
                          We found <strong>{todaysUpdates.length} policy updates</strong> today.{' '}
                          {actions.length ? (
                            <>
                              <strong>{actions.length} need a closer look</strong>
                            </>
                          ) : (
                            <>Your high-impact queue is clear</>
                          )}
                          , with <strong>{affectedCodes.size} codes</strong> matching your
                          chargemaster.
                        </>
                      ) : (
                        'Your next briefing starts with your sources. Add a public payer policy page and check it to establish a baseline.'
                      )}
                    </p>
                    <div className="briefing-highlights">
                      {todaysUpdates.slice(0, 2).map((update) => (
                        <button key={update.id} onClick={() => setSelected(update.id)}>
                          <span
                            className={`brief-dot ${update.priority === 'High' ? 'amber' : ''}`}
                          />
                          <span>
                            <strong>{update.payer}</strong> — {update.title}
                          </span>
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                    </div>
                    <div className="briefing-bottom">
                      <button
                        className="briefing-read"
                        disabled={Boolean(busy)}
                        onClick={async () => {
                          if (briefs[0]?.day === today) setBriefingId(briefs[0].id);
                          else if (await mutate({ action: 'briefing', isDemo: demo }, 'briefing'))
                            go('Daily briefings');
                        }}
                      >
                        Read full briefing <ArrowRight size={15} />
                      </button>
                      <span>
                        <Clock3 size={12} />
                        {demo
                          ? 'Illustrative summary'
                          : data.aiConfigured
                            ? 'Source-grounded AI summary'
                            : 'AI connection available in settings'}
                      </span>
                    </div>
                  </section>
                  {renderFeed()}
                </div>
                <aside className="overview-secondary">
                  <section className="pp-panel health-panel">
                    <div className="compact-heading">
                      <h2>Payer watchlist</h2>
                      <span className="soft-label">{sources.length} sources</span>
                    </div>
                    <p className="panel-subtitle">Your policy sources, in one place.</p>
                    <div className="watchlist">
                      {sources.slice(0, 6).map((source) => (
                        <button key={source.id} onClick={() => go('Payer sources')}>
                          <PayerMark payer={source.payer} small />
                          <span>{source.payer}</span>
                          <span className={`watch-status ${source.lastError ? 'error' : ''}`}>
                            <i />
                            {source.isDemo
                              ? 'Sample'
                              : !source.enabled
                                ? 'Paused'
                                : source.lastError
                                  ? 'Check failed'
                                  : source.checkedAt
                                    ? 'Checked'
                                    : 'Not checked'}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!sources.length && (
                      <p className="inline-hint">
                        Add your first payer source to start monitoring.
                      </p>
                    )}
                    <button className="panel-link" onClick={() => go('Payer sources')}>
                      Manage payer sources <ArrowRight size={14} />
                    </button>
                  </section>
                  <section className="pp-panel deadline-panel">
                    <div className="compact-heading">
                      <h2>On the horizon</h2>
                      <CalendarDays size={17} />
                    </div>
                    <p className="panel-subtitle">Upcoming policy effective dates.</p>
                    {nextDates.map((update) => (
                      <button
                        className="deadline"
                        key={update.id}
                        onClick={() => setSelected(update.id)}
                      >
                        <span className="date-tile">
                          <small>
                            {new Date(update.effectiveAt!).toLocaleDateString('en-US', {
                              month: 'short',
                              timeZone: 'UTC',
                            })}
                          </small>
                          <strong>{new Date(update.effectiveAt!).getUTCDate()}</strong>
                        </span>
                        <span>
                          <strong>{update.payer}</strong>
                          <small>{update.title.split(':')[0]}</small>
                          <em>
                            {Math.ceil(
                              (new Date(update.effectiveAt!).getTime() -
                                new Date(today).getTime()) /
                                86400000,
                            )}{' '}
                            days to prepare
                          </em>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                    {!nextDates.length && (
                      <p className="inline-hint">No verified effective dates available yet.</p>
                    )}
                    <div className="horizon-note">
                      <Clock3 size={13} />A little preparation goes a long way.
                    </div>
                  </section>
                  <div className="connected-card">
                    <span className="connected-icon">
                      <ShieldCheck size={21} />
                    </span>
                    <div>
                      <h3>Your chargemaster, connected.</h3>
                      <p>{entries.length} services ready for policy matching.</p>
                      <button onClick={() => go('Chargemaster')}>
                        View impact audit <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
          {(view === 'Policy feed' || view === 'Action items') && renderFeed()}
          {view === 'Daily briefings' && (
            <section className="pp-panel">
              <div className="panel-heading">
                <div>
                  <h2>A smarter start to your day</h2>
                  <p>
                    {demo
                      ? 'Example summaries help you explore the workflow.'
                      : data.aiConfigured
                        ? 'AI summaries are generated from captured source changes.'
                        : 'Rule-based summaries are available. Connect an AI key to enable model-generated summaries.'}
                  </p>
                </div>
                <button
                  className="pp-button primary"
                  disabled={Boolean(busy)}
                  onClick={() => mutate({ action: 'briefing', isDemo: demo }, 'briefing')}
                >
                  {busy === 'briefing' ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  Generate today’s briefing
                </button>
              </div>
              {briefs.length ? (
                briefs.map((brief) => (
                  <button
                    className="briefing-list-row"
                    key={brief.id}
                    onClick={() => setBriefingId(brief.id)}
                  >
                    <span className="briefing-list-icon">
                      <Sparkles size={23} />
                    </span>
                    <div>
                      <h3>Daily policy briefing · {dateLabel(brief.day, true)}</h3>
                      <p>{brief.text.slice(0, 145)}…</p>
                      <span>
                        {brief.engine === 'Demo'
                          ? 'Illustrative example'
                          : `${brief.engine} summary`}{' '}
                        · Generated {dateLabel(brief.createdAt)}
                      </span>
                    </div>
                    <ArrowRight size={19} />
                  </button>
                ))
              ) : (
                <EmptyState title="Your first briefing is a click away">
                  Generate a daily briefing after checking your payer sources.
                </EmptyState>
              )}
            </section>
          )}
          {(view === 'Chargemaster' || view === 'CPT explorer') && (
            <>
              <div className="catalog-overview">
                <div className="catalog-file">
                  <span>
                    <FileSpreadsheet size={28} />
                  </span>
                  <div>
                    <h2>{data.catalog?.filename ?? 'No chargemaster uploaded'}</h2>
                    <p>
                      {data.catalog
                        ? `${entries.length} service rows · ${data.catalog.isDemo ? 'Example catalog' : 'Uploaded ' + dateLabel(data.catalog.importedAt)}`
                        : 'Upload a CSV to connect your services to policy changes.'}
                    </p>
                  </div>
                </div>
                <div>
                  <strong>{affectedCodes.size}</strong>
                  <span>codes with policy matches</span>
                </div>
                <button
                  className="pp-button secondary"
                  disabled={!entries.length}
                  onClick={exportAudit}
                >
                  <ArrowDownToLine size={16} />
                  Export audit
                </button>
              </div>
              <div className="notice-strip">
                <ShieldCheck size={16} />
                <p>
                  {demo
                    ? 'You’re matching against synthetic policy examples. Switch to Live sources for captured page changes.'
                    : 'Matches indicate code mentions, not confirmed coverage changes. Verify the source, plan, and jurisdiction before editing.'}{' '}
                  {data.catalog?.isDemo && 'The chargemaster is also a sample.'}
                </p>
              </div>
              <section className="pp-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      {view === 'CPT explorer'
                        ? 'Explore your CPT & HCPCS codes'
                        : 'Chargemaster impact audit'}
                    </h2>
                    <p>
                      {view === 'CPT explorer'
                        ? 'Descriptions below come from your uploaded catalog, not an official code set.'
                        : 'Matches refresh automatically whenever a new policy update is captured.'}
                    </p>
                  </div>
                  <label className="filter-search">
                    <Search size={16} />
                    <input
                      aria-label="Search chargemaster"
                      placeholder="Search code or description..."
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                </div>
                <div className="table-scroll">
                  <table className="catalog-table">
                    <thead>
                      <tr>
                        <th>CPT / HCPCS</th>
                        <th>Service description</th>
                        <th>Department</th>
                        <th>Charge</th>
                        <th>Policy impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audited
                        .filter((entry) =>
                          `${entry.code} ${entry.description} ${entry.department}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        )
                        .map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              <span className="code-tag">{entry.code}</span>
                            </td>
                            <td>
                              <strong>{entry.description}</strong>
                            </td>
                            <td>{entry.department}</td>
                            <td>{moneyLabel(entry.charge)}</td>
                            <td>
                              {entry.updateIds.length ? (
                                <div className="table-policy-links">
                                  {entry.updateIds.map((id) => {
                                    const update = updates.find((item) => item.id === id)!;
                                    return (
                                      <button key={id} onClick={() => setSelected(id)}>
                                        {update.payer}
                                        <ArrowUpRight size={12} />
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="no-match">
                                  <Check size={13} />
                                  No detected matches
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!audited.some((entry) =>
                  `${entry.code} ${entry.description} ${entry.department}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                ) && (
                  <EmptyState title="No matching services">
                    Try another code or upload your chargemaster to get started.
                  </EmptyState>
                )}
                <div className="table-footnote">
                  No detected matches does not establish code validity or payer coverage. Code
                  additions/deletions require an authoritative, licensed code-set feed.
                </div>
              </section>
            </>
          )}
          {view === 'Payer sources' && (
            <section className="pp-panel">
              <div className="panel-heading">
                <div>
                  <h2>Your payer source library</h2>
                  <p>Each source keeps versioned snapshots. The first check creates a baseline.</p>
                </div>
                <button
                  className="pp-button primary"
                  onClick={() => {
                    setSourceError('');
                    setModal('source');
                  }}
                >
                  <Plus size={16} />
                  Add source
                </button>
              </div>
              {!sources.length ? (
                <EmptyState title="Build your payer watchlist">
                  Add an individual public policy page. Check it again later to detect content
                  changes.
                </EmptyState>
              ) : (
                <div className="source-grid">
                  {sources.map((source) => (
                    <article className="source-card" key={source.id}>
                      <div className="source-title">
                        <PayerMark payer={source.payer} />
                        <div>
                          <h3>{source.payer}</h3>
                          <p>{source.name}</p>
                        </div>
                        <span className="soft-label">
                          {source.isDemo ? 'Example' : source.enabled ? 'Enabled' : 'Paused'}
                        </span>
                      </div>
                      <SourceLink url={source.url} />
                      <div className="source-details">
                        <span>
                          Last checked
                          <strong>
                            {source.checkedAt
                              ? new Date(source.checkedAt).toLocaleString()
                              : 'Not checked'}
                          </strong>
                        </span>
                        <span>
                          Snapshots<strong>{source._count.snapshots}</strong>
                        </span>
                      </div>
                      {source.lastError && <p className="inline-error">{source.lastError}</p>}
                      {source.isDemo ? (
                        <p className="inline-hint">
                          Synthetic updates for exploring the app. Add this URL as a live source to
                          capture real snapshots.
                        </p>
                      ) : (
                        <div className="source-buttons">
                          <button
                            className="pp-button secondary"
                            disabled={Boolean(busy) || !source.enabled}
                            onClick={() => mutate({ action: 'sync', id: source.id }, source.id)}
                          >
                            {busy === source.id ? (
                              <Loader2 size={14} className="spin" />
                            ) : (
                              <RefreshCw size={14} />
                            )}
                            Check now
                          </button>
                          <button
                            className="text-link"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              mutate(
                                { action: 'toggle', id: source.id, enabled: !source.enabled },
                                'toggle',
                              )
                            }
                          >
                            {source.enabled ? 'Pause monitoring' : 'Resume monitoring'}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <div className="table-footnote">
                The generic connector checks the selected HTML/text page only. It does not crawl
                linked documents, PDFs, or sign-in portals. Automated daily checks require the
                scheduled job described in settings.
              </div>
            </section>
          )}
          {view === 'Settings' && (
            <div className="settings-grid">
              <section className="pp-panel settings-card">
                <span className="settings-icon">
                  <Sparkles size={24} />
                </span>
                <h2>AI intelligence</h2>
                <span className={`config-status ${data.aiConfigured ? 'ready' : ''}`}>
                  {data.aiConfigured ? 'API key configured' : 'Connection needed'}
                </span>
                <p>
                  Connect OpenAI to turn captured page differences into a daily narrative with
                  source links and recommended reviews.
                </p>
                <div className="config-block">
                  <code>OPENAI_API_KEY</code>
                  <small>
                    Set this in your server environment. Never upload it with your chargemaster.
                  </small>
                </div>
                <p>
                  Without a key, the app generates a clearly labeled rule-based briefing. AI
                  suggestions still require source verification.
                </p>
              </section>
              <section className="pp-panel settings-card">
                <span className="settings-icon">
                  <Clock3 size={24} />
                </span>
                <h2>Daily monitoring</h2>
                <span className="config-status">External scheduler required</span>
                <p>
                  Run the daily worker on the same server and database to check enabled live
                  sources, save changes, and generate the day’s briefing.
                </p>
                <div className="config-block">
                  <code>npm run policies:daily</code>
                  <small>
                    Schedule once per day using your hosting platform’s job scheduler. The app does
                    not claim a schedule is active.
                  </small>
                </div>
                <p>Briefings appear here in the app. Email delivery is not configured.</p>
              </section>
              <section className="pp-panel settings-card">
                <span className="settings-icon">
                  <ShieldCheck size={24} />
                </span>
                <h2>Workspace & data</h2>
                <p>
                  This is a single-workspace application backed by SQLite. Imports replace the
                  active chargemaster after validation, and data persists across restarts.
                </p>
                <p>
                  Use service catalog data only: code, description, department, charge, and optional
                  annual volume. Patient data is not needed.
                </p>
                <Link className="text-link" href="/revenue">
                  Open ClearCycle revenue tools <ArrowUpRight size={15} />
                </Link>
              </section>
              <section className="pp-panel settings-card">
                <span className="settings-icon">
                  <BookOpen size={24} />
                </span>
                <h2>Coverage & code accuracy</h2>
                <p>
                  Detected code mentions are review candidates. This app does not include an
                  official CPT code set, payer contract rates, or a reimbursement prediction model.
                </p>
                <p>
                  New and retired code validation needs a licensed code feed. Before changing
                  workflows, check payer plan, jurisdiction, effective date, and the original
                  policy.
                </p>
                <button className="text-link" onClick={() => setModal('help')}>
                  Read the getting started guide <ArrowRight size={15} />
                </button>
              </section>
            </div>
          )}
          <footer className="workspace-footer">
            <span className="footer-brand">
              <Activity size={14} />
              PolicyPulse
            </span>
            <span>Clarity in every change.</span>
            <span>Source-linked. Practice-focused.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div
          role={toast.error ? 'alert' : 'status'}
          className={`pp-toast ${toast.error ? 'toast-error' : ''}`}
        >
          {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {detail && (
        <Dialog title="Policy intelligence / Update details" wide close={() => setSelected(null)}>
          <div className="detail-content">
            <div className="detail-payer">
              <PayerMark payer={detail.payer} />
              <span>
                {detail.payer}
                <small>{detail.category}</small>
              </span>
              <Priority value={detail.priority} />
            </div>
            <h2>{detail.title}</h2>
            <div className="detail-date">
              <CalendarDays size={15} />
              Effective {dateLabel(detail.effectiveAt, true)}
              <span>·</span>Detected {dateLabel(detail.createdAt)}
            </div>
            {detail.isDemo && (
              <div className="notice-strip">
                Illustrative policy example. The linked payer page is a reference, not evidence for
                this synthetic change.
              </div>
            )}
            <section className="detail-summary">
              <h3>
                <Sparkles size={17} />
                What changed
              </h3>
              <p>{detail.summary}</p>
            </section>
            <h3 className="section-title">The policy, before and after</h3>
            <div className="comparison-grid">
              <section className="previous">
                <h4>
                  <span>−</span>Previous version
                </h4>
                <p>{detail.previousText}</p>
              </section>
              <section className="current">
                <h4>
                  <span>+</span>Updated version
                </h4>
                <p>{detail.currentText}</p>
              </section>
            </div>
            <section className="detail-section">
              <h3>
                Codes to review{' '}
                <span className="count-badge">
                  {detail.codes.split(',').filter(Boolean).length}
                </span>
              </h3>
              <div className="detail-codes">
                {detail.codes
                  .split(',')
                  .filter(Boolean)
                  .map((code) => (
                    <button
                      className={`code-pill ${entries.some((entry) => entry.code === code) ? 'matched' : ''}`}
                      key={code}
                      onClick={() => {
                        setSelected(null);
                        go('CPT explorer');
                        setQuery(code);
                      }}
                    >
                      <Code2 size={13} />
                      {code}
                      {entries.some((entry) => entry.code === code) && <Check size={12} />}
                    </button>
                  ))}
              </div>
              <p className="inline-hint">
                Highlighted codes match your catalog. Live code mentions require verification
                against an authoritative code set.
              </p>
            </section>
            <section className="detail-section">
              <h3>
                <FileSpreadsheet size={17} />
                Your chargemaster impact
              </h3>
              {matchedEntries.length ? (
                <>
                  <div className="impact-metrics">
                    <div>
                      <strong>{matchedEntries.length}</strong>
                      <span>matched service rows</span>
                    </div>
                    <div>
                      <strong>
                        {matchedEntries.some((entry) => entry.annualVolume !== null)
                          ? moneyLabel(
                              matchedEntries.reduce(
                                (sum, entry) => sum + entry.charge * (entry.annualVolume ?? 0),
                                0,
                              ),
                            )
                          : '—'}
                      </strong>
                      <span>annual gross charges associated*</span>
                    </div>
                  </div>
                  <p className="inline-hint">
                    *Charge × uploaded annual volume where available. Not predicted loss or
                    reimbursement. {data.catalog?.isDemo ? 'Based on sample catalog values.' : ''}
                  </p>
                  {matchedEntries.map((entry) => (
                    <div className="matched-service" key={entry.id}>
                      <span className="code-tag">{entry.code}</span>
                      <span>
                        {entry.description}
                        <small>{entry.department}</small>
                      </span>
                      <strong>{moneyLabel(entry.charge)}</strong>
                    </div>
                  ))}
                </>
              ) : (
                <p className="inline-hint">
                  No exact matches in your current chargemaster. Upload your catalog or review the
                  source manually.
                </p>
              )}
            </section>
            <section className="recommendation-box">
              <h3>
                <Zap size={17} />
                What to update
              </h3>
              <p>{detail.recommendation}</p>
              <h4>Why it matters</h4>
              <p>{detail.rationale}</p>
            </section>
            <SourceLink url={detail.sourceUrl} />
          </div>
          <div className="drawer-footer">
            <span>{detail.reviewed ? 'Reviewed by your workspace' : 'Ready for your review'}</span>
            <button
              className="pp-button primary"
              disabled={Boolean(busy)}
              onClick={() =>
                mutate({ action: 'review', id: detail.id, reviewed: !detail.reviewed }, 'review')
              }
            >
              <CheckCheck size={16} />
              {detail.reviewed ? 'Reopen review' : 'Mark as reviewed'}
            </button>
          </div>
        </Dialog>
      )}
      {briefing && (
        <Dialog title="Daily intelligence briefing" wide close={() => setBriefingId(null)}>
          <div className="detail-content">
            <span className="ai-badge">
              {briefing.engine === 'Demo'
                ? 'ILLUSTRATIVE EXAMPLE'
                : `${briefing.engine.toUpperCase()} SUMMARY`}
            </span>
            <h2>Your briefing for {dateLabel(briefing.day, true)}</h2>
            <p className="inline-hint">
              Generated from changes captured on this UTC date. Source failures and unchecked pages
              may leave gaps.
            </p>
            <div className="briefing-full">{briefing.text}</div>
            <button
              className="pp-button secondary"
              onClick={() =>
                download(briefing.text, `policy-briefing-${briefing.day}.txt`, 'text/plain')
              }
            >
              <ArrowDownToLine size={16} />
              Download briefing
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'upload' && (
        <Dialog title="Connect your chargemaster" close={() => setModal(null)}>
          <div className="modal-body">
            <span className="modal-hero-icon">
              <FileSpreadsheet size={27} />
            </span>
            <h2>Your services. Your impact.</h2>
            <p>
              Upload your CSV and we’ll match your CPT and HCPCS codes to policy changes
              automatically.
            </p>
            <label
              className={`upload-zone ${file ? 'has-file' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dropped = event.dataTransfer.files[0];
                if (dropped) {
                  setFile(dropped);
                  setUploadError('');
                }
              }}
            >
              <Upload size={26} />
              <strong>{file ? file.name : 'Click to upload or drag and drop'}</strong>
              <span>
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB · Ready to validate`
                  : 'CSV file · Up to 2 MB / 10,000 rows'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Choose chargemaster CSV"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setUploadError('');
                }}
              />
            </label>
            <div className="upload-format">
              <strong>Required columns</strong>
              <div>
                <code>code</code>
                <code>description</code>
                <code>charge</code>
              </div>
              <p>
                Optional: <code>department</code>, <code>annual_volume</code>. Preserve leading
                zeros in codes. Export Excel files as CSV first.
              </p>
            </div>
            <button
              className="text-link"
              onClick={() =>
                download(
                  'code,description,department,charge,annual_volume\r\n70551,Brain MRI without contrast,Radiology,620,180\r\n99213,Office visit,Primary care,150,3200\r\n',
                  'chargemaster-template.csv',
                )
              }
            >
              <ArrowDownToLine size={14} />
              Download CSV template
            </button>
            <div className="notice-strip">
              <ShieldCheck size={16} />
              <p>
                Uploading replaces the active catalog after validation. Upload service data only; no
                patient information.
              </p>
            </div>
            {uploadError && (
              <p role="alert" className="inline-error">
                {uploadError}
              </p>
            )}
            <button
              className="pp-button primary full-width"
              disabled={Boolean(busy) || !file}
              onClick={upload}
            >
              {busy === 'upload' ? <Loader2 size={17} className="spin" /> : <Upload size={17} />}
              {busy === 'upload' ? 'Validating & auditing...' : 'Upload & audit chargemaster'}
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'source' && (
        <Dialog title="Add a payer source" close={() => setModal(null)}>
          <form className="modal-body source-form" onSubmit={addSource}>
            <h2>Keep a closer watch.</h2>
            <p>
              Add a public policy page. The first check saves a baseline; later checks compare the
              page for changes.
            </p>
            <label>
              Payer name
              <input name="payer" required maxLength={80} placeholder="e.g. UnitedHealthcare" />
            </label>
            <label>
              Source name
              <input
                name="name"
                required
                maxLength={120}
                placeholder="e.g. Commercial medical policies"
              />
            </label>
            <label>
              Policy page URL
              <input name="url" type="url" required placeholder="https://www.uhcprovider.com/..." />
            </label>
            <div className="notice-strip">
              <Globe2 size={17} />
              <p>
                Supported domains: UHCprovider, Aetna, Cigna, Humana, Anthem, and CMS. Public
                HTML/text pages only; PDF documents and sign-in portals need dedicated connectors.
              </p>
            </div>
            {sourceError && (
              <p role="alert" className="inline-error">
                {sourceError}
              </p>
            )}
            <button className="pp-button primary full-width" disabled={Boolean(busy)} type="submit">
              {busy === 'source' ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}Add
              live source
            </button>
          </form>
        </Dialog>
      )}
      {modal === 'help' && (
        <Dialog title="Getting started with PolicyPulse" close={() => setModal(null)}>
          <div className="modal-body help-content">
            <h2>From policy noise to a clear next step.</h2>
            {[
              [
                '01',
                'Build your watchlist',
                'Add the specific public policy pages your practice uses. Save a baseline, then check again to capture changes.',
              ],
              [
                '02',
                'Connect your chargemaster',
                'Upload a CSV of your service codes and charges. Every captured update is automatically matched to these codes.',
              ],
              [
                '03',
                'Review the difference',
                'Open a policy to compare versions, see matched codes, and review the recommended action. Mark it reviewed when complete.',
              ],
              [
                '04',
                'Make it a daily habit',
                'Set an AI key and schedule the daily worker on your server. Read the briefing in the app each day.',
              ],
            ].map(([number, title, text]) => (
              <div className="help-step" key={number}>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
            <p className="inline-hint">
              Example policies are fictional. Live connectors detect page text changes; they do not
              validate official CPT additions or deletions, or automatically edit your billing
              system.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
