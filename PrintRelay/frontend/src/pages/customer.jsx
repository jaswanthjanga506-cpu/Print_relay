import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bell, Check, ChevronRight, Clock3, FileText, MapPin, PackageCheck, Printer, Search, ShieldCheck, Store, UploadCloud, X } from 'lucide-react';
import { api, errorMessage, payload } from '../services/api';
import { bytes, dateTime, humanize, location, money } from '../utils/format';
import { BackLink, Button, ConfirmDialog, EmptyState, ErrorState, Field, Loader, PageTitle, Pagination, StatusBadge } from '../components/common';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import '../styles/customer.css';
const PdfPreview = lazy(() => import('../components/PdfPreview'));

export function CustomerDashboard() {
  const [active, setActive] = useState([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [recent, setRecent] = useState([]);
  const [shops, setShops] = useState([]);
  const [readyTotal, setReadyTotal] = useState(0);
  const [printingTotal, setPrintingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a, r, s, readyOrders, printingOrders] = await Promise.all([
        api.get('/orders', { params: { active: 'true', limit: 5 } }),
        api.get('/orders', { params: { limit: 5 } }),
        api.get('/shops', { params: { accepting: 'true', limit: 3 } }),
        api.get('/orders', { params: { status: 'READY_FOR_PICKUP', limit: 1 } }),
        api.get('/orders', { params: { status: 'PRINTING', limit: 1 } }),
      ]);
      setActive(payload(a) || []); setActiveTotal(a.data.pagination?.total ?? 0);
      setRecent(payload(r) || []); setShops(payload(s) || []);
      setReadyTotal(readyOrders.data.pagination?.total ?? 0); setPrintingTotal(printingOrders.data.pagination?.total ?? 0);
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, []);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Loader label="Loading your dashboard" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  return <div className="page-stack">
    <PageTitle eyebrow="YOUR WORKSPACE" title="Good to see you." description="Your print orders, all in one place." actions={<Link className="button button--primary" to="/customer/shops">Start a print order <ArrowRight size={16} /></Link>} />
    <div className="metric-grid customer-metrics"><Metric label="Active orders" value={activeTotal} icon={Clock3} /><Metric label="Printing now" value={printingTotal} icon={Printer} /><Metric label="Ready to collect" value={readyTotal} icon={PackageCheck} /></div>
    <section className="content-section"><div className="section-heading"><div><span className="eyebrow">KEEP THINGS MOVING</span><h2>In progress</h2></div><Link className="text-link" to="/customer/orders">All orders <ArrowRight size={15} /></Link></div>
      {active.length ? <div className="order-list">{active.slice(0, 4).map((order) => <OrderRow key={order.id} order={order} />)}</div> : <EmptyState icon={Printer} title="Nothing in the queue yet"><span>Find a shop and place your first order when you’re ready.</span><Link className="button button--secondary" to="/customer/shops">Explore printing shops <ArrowRight size={15} /></Link></EmptyState>}
    </section>
    <section className="content-section"><div className="section-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Recent orders</h2></div><Link className="text-link" to="/customer/orders">View all <ArrowRight size={15} /></Link></div>
      {recent.length ? <div className="order-list">{recent.slice(0, 3).map((order) => <OrderRow key={order.id} order={order} />)}</div> : <div className="quiet-empty">Orders you place will appear here.</div>}
    </section>
    {!!shops.length && <section className="content-section"><div className="section-heading"><div><span className="eyebrow">OPEN TO ORDERS</span><h2>Shops accepting orders</h2></div><Link className="text-link" to="/customer/shops">Browse shops <ArrowRight size={15} /></Link></div><div className="shop-grid">{shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}</div></section>}
  </div>;
}

function Metric({ label, value, icon: Icon }) {
  return <article className="metric-card"><div className="metric-icon"><Icon size={18} /></div><span className="metric-label">{label}</span><strong>{value}</strong></article>;
}

function OrderRow({ order }) {
  return <Link className="order-row" to={`/customer/orders/${order.id}`}><span className="document-mark"><FileText size={18} /></span><span className="order-row-main"><strong className="mono">{order.orderNumber}</strong><span>{order.shop?.name || 'Print shop'} · {order.file?.filename}</span></span><StatusBadge value={order.status} /><span className="order-row-total">{money(order.totalPaise)}</span><ChevronRight size={17} className="order-row-arrow" /></Link>;
}

export function ShopDiscovery() {
  const [params, setParams] = useSearchParams();
  const [shops, setShops] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('q') || '');
  const [filters, setFilters] = useState({ bw: params.get('bw') === 'true', colour: params.get('colour') === 'true', spiral: params.get('spiral') === 'true', accepting: params.get('accepting') === 'true' });
  const page = Number(params.get('page')) || 1;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const service = ['bw', 'colour', 'spiral'].filter((s) => filters[s]).join(',');
    try {
      const res = await api.get('/shops', { params: { q: params.get('q') || '', service, accepting: filters.accepting ? 'true' : '', page, limit: 9 } });
      setShops(payload(res) || []); setMeta(res.data.pagination || { page: 1, totalPages: 1 });
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [params, filters, page]);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  const apply = (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set('q', search.trim());
    Object.entries(filters).forEach(([key, value]) => { if (value) next.set(key, 'true'); });
    setParams(next);
  };
  const toggle = (key) => { setFilters((state) => ({ ...state, [key]: !state[key] })); setParams((p) => { p.delete('page'); return p; }); };
  return <div className="page-stack"><PageTitle eyebrow="SHOP DISCOVERY" title="Find your print shop." description="Compare real services and prices, then place your order ahead of time." />
    <form className="shop-searchbar" onSubmit={apply}><label className="search-input"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by shop, locality or city" aria-label="Search shops" /><button className="button button--primary" type="submit">Search</button></label>
      <div className="filter-row">{[['bw','Black & white'],['colour','Colour'],['spiral','Spiral binding'],['accepting','Accepting orders']].map(([key,label]) => <label key={key} className={`filter-check ${filters[key] ? 'checked' : ''}`}><input type="checkbox" checked={filters[key]} onChange={() => toggle(key)} /><span className="checkbox">{filters[key] && <Check size={12} />}</span>{label}</label>)}</div>
    </form>
    {loading ? <Loader label="Finding available shops" /> : error ? <ErrorState message={error} onRetry={load} /> : shops.length ? <><div className="results-caption"><span>{meta.total ?? shops.length} shop{meta.total === 1 ? '' : 's'} found</span><span>Services and prices set by each shop</span></div><div className="shop-grid">{shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}</div><Pagination page={meta.page || page} totalPages={meta.totalPages || 1} onChange={(next) => setParams((p) => { p.set('page', next); return p; })} /></> : <EmptyState icon={Store} title="No shops match those filters">Try another locality or remove a service filter.</EmptyState>}
  </div>;
}

function ShopCard({ shop }) {
  return <article className="shop-card"><div className="shop-card-top"><span className="shop-symbol"><Printer size={19} /></span><span className={`shop-open-badge ${shop.acceptingOrders ? 'on' : ''}`}><span className="status-live" />{shop.acceptingOrders ? 'Taking orders' : shop.isOpen ? 'Open · not accepting' : 'Closed'}</span></div>
    <div><h3>{shop.name}</h3><span className="shop-location"><MapPin size={14} />{location(shop.address) || shop.address?.line}</span>{shop.phone && <a className="shop-phone" href={`tel:${shop.phone}`}>{shop.phone}</a>}</div>
    <div className="shop-services">{shop.services?.bw && <span>B&amp;W</span>}{shop.services?.colour && <span>Colour</span>}{shop.services?.spiralBinding && <span>Spiral</span>}</div>
    <div className="shop-card-meta">{shop.services?.bw && <span>B&amp;W <strong>{money(shop.pricing?.bwPerSidePaise)}</strong>/side</span>}{shop.services?.colour && <span>Colour <strong>{money(shop.pricing?.colourPerSidePaise)}</strong>/side</span>}<span>Active queue <strong>{shop.activeQueue ?? 0}</strong></span></div>
    <div className="shop-card-bottom"><div><span className="muted-label">SERVICES AVAILABLE</span><strong>{[shop.services?.bw && 'B&W', shop.services?.colour && 'Colour', shop.services?.spiralBinding && 'Spiral'].filter(Boolean).join(' · ') || 'No services listed'}</strong></div><Link to={`/customer/shops/${shop.id}`} className="round-arrow" aria-label={`View ${shop.name}`}><ArrowRight size={17} /></Link></div>
  </article>;
}

export function ShopDetails() {
  const { shopId } = useParams();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setShop(payload(await api.get(`/shops/${shopId}`))); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [shopId]);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  const canOrder = shop.acceptingOrders && ((shop.services?.bw && shop.pricing?.bwPerSidePaise > 0) || (shop.services?.colour && shop.pricing?.colourPerSidePaise > 0));
  const today = shop.hours?.find((h) => h.day === new Date().getDay());
  return <div className="page-stack"><BackLink to="/customer/shops">All shops</BackLink><section className="shop-detail-hero"><span className="shop-detail-icon"><Printer size={28} /></span><div className="shop-detail-title"><span className="eyebrow">PRINTING SHOP</span><h1>{shop.name}</h1><p><MapPin size={15} />{[shop.address?.line, location(shop.address), shop.address?.pincode].filter(Boolean).join(' · ')}</p></div><span className={`shop-open-badge ${shop.acceptingOrders ? 'on' : ''}`}><span className="status-live" />{shop.acceptingOrders ? 'Taking orders' : shop.isOpen ? 'Open · not accepting' : 'Closed'}</span></section>
    <div className="detail-columns"><div className="detail-main">
      <section className="panel"><div className="panel-heading"><span className="eyebrow">SERVICES &amp; PRICES</span><h2>What this shop offers</h2></div>{shop.services?.bw && <PriceLine label="Black & white" detail="Per printed side" value={shop.pricing.bwPerSidePaise} />}{shop.services?.colour && <PriceLine label="Colour" detail="Per printed side" value={shop.pricing.colourPerSidePaise} />}{shop.services?.spiralBinding && <PriceLine label="Spiral binding" detail="Per copy" value={shop.pricing.spiralBindingPaise} />}</section>
      <section className="panel"><div className="panel-heading"><span className="eyebrow">SHOP DETAILS</span><h2>Visit or get in touch</h2></div><div className="detail-contact">{shop.phone && <p><span>Phone</span><a href={`tel:${shop.phone}`}>{shop.phone}</a></p>}{shop.email && <p><span>Email</span><a href={`mailto:${shop.email}`}>{shop.email}</a></p>}<p><span>Today</span><strong>{today?.closed ? 'Closed today' : today ? `${today.open} – ${today.close}` : shop.isOpen ? 'Open' : 'Hours not listed'}</strong></p><p><span>Active queue</span><strong>{shop.activeQueue ?? 0} orders</strong></p></div></section>
    </div><aside className="order-start-panel"><span className="eyebrow">READY WHEN YOU ARE</span><h2>Place an order with this shop.</h2><p>Upload a PDF and choose your printing preferences. The shop confirms your order and handles the printing.</p><Link className={`button button--primary button--full ${!canOrder ? 'is-disabled' : ''}`} aria-disabled={!canOrder} to={canOrder ? `/customer/orders/new/${shop.id}` : '#'} onClick={(e) => !canOrder && e.preventDefault()}>{canOrder ? 'Start an order' : 'Not accepting orders'} <ArrowRight size={16} /></Link><span className="panel-footnote">{canOrder ? `Current queue: ${shop.activeQueue ?? 0} orders. Queue position appears after the shop accepts your request.` : 'This shop is currently not taking new orders.'}</span></aside></div>
  </div>;
}

function PriceLine({ label, detail, value }) { return <div className="price-line"><div><strong>{label}</strong><span>{detail}</span></div><strong>{money(value)}</strong></div>; }

const initialConfig = { printType: 'BW', copies: 1, mode: 'ALL', ranges: '', sides: 'SINGLE', paperSize: 'A4', binding: 'NONE' };

export function NewOrder() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const fileInput = useRef(null);
  const [shop, setShop] = useState(null);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [config, setConfig] = useState(initialConfig);
  const [quote, setQuote] = useState(null);
  const [payment, setPayment] = useState('CASH');
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewPage, setPreviewPage] = useState(1);

  useEffect(() => { api.get(`/shops/${shopId}`).then((r) => { const data = payload(r); setShop(data); if (!data.services?.bw && data.services?.colour) setConfig((old) => ({ ...old, printType: 'COLOUR' })); }).catch((e) => setError(errorMessage(e))); }, [shopId]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const upload = async (selected) => {
    setError('');
    if (!selected) return;
    if (selected.type !== 'application/pdf' || !selected.name.toLowerCase().endsWith('.pdf')) { setError('Choose a PDF document.'); return; }
    if (selected.size > 10 * 1024 * 1024) { setError('This PDF is over the 10 MB limit.'); return; }
    setWorking(true); setProgress(0);
    const data = new FormData(); data.append('file', selected);
    try {
      const uploaded = payload(await api.post('/files', data, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress: (event) => setProgress(event.total ? Math.round((event.loaded * 100) / event.total) : 0) }));
      setFile(uploaded); setPreviewPage(1);
      const preview = await api.get(`/files/${uploaded.id}`, { responseType: 'blob' });
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(preview.data); });
    } catch (e) { setFile(null); setError(errorMessage(e)); }
    finally { setWorking(false); }
  };
  const fileDrop = (e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); };
  const next = async () => {
    setError('');
    if (step === 1) { if (!file) return setError('Upload and validate a PDF before continuing.'); setStep(2); return; }
    if (step === 2) {
      if (config.mode === 'RANGE') {
        const validation = validatePageRanges(config.ranges, file.pageCount);
        if (validation) return setError(validation);
      }
      setWorking(true);
      try {
        const result = payload(await api.post('/orders/quote', buildOrderPayload(shopId, file.id, config)));
        setQuote(result); setStep(3);
      } catch (e) { setError(errorMessage(e)); }
      finally { setWorking(false); }
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };
  const placeOrder = async () => {
    setWorking(true); setError('');
    try {
      const order = payload(await api.post('/orders', { ...buildOrderPayload(shopId, file.id, config), paymentPreference: payment }));
      toast(`Order ${order.orderNumber} placed.`);
      navigate(`/customer/orders/${order.id}`);
    } catch (e) { setError(errorMessage(e)); }
    finally { setWorking(false); }
  };
  const canSpiral = Boolean(shop?.services?.spiralBinding);
  const canColor = Boolean(shop?.services?.colour);
  if (!shop) return error ? <ErrorState message={error} onRetry={() => { setError(''); api.get(`/shops/${shopId}`).then((r) => setShop(payload(r))).catch((e) => setError(errorMessage(e))); }} /> : <Loader label="Loading shop details" />;

  return <div className="page-stack order-wizard-page"><BackLink to={`/customer/shops/${shopId}`}>{shop.name}</BackLink><PageTitle eyebrow="NEW PRINT ORDER" title="Let’s get this printed." description="Your document is private and accessible only to you and the shop handling your order." />
    <div className="wizard-progress">{['Upload', 'Configure', 'Quote', 'Confirm'].map((label, index) => <button key={label} className={`wizard-step ${step === index + 1 ? 'current' : ''} ${step > index + 1 ? 'complete' : ''}`} onClick={() => index + 1 < step && setStep(index + 1)} disabled={index + 1 >= step}><span>{step > index + 1 ? <Check size={14} /> : `0${index + 1}`}</span><b>{label}</b></button>)}</div>
    <section className="wizard-panel">
      {step === 1 && <div className="wizard-upload"><div className="wizard-section-head"><span className="step-count">STEP 01 / DOCUMENT</span><h2>Choose your PDF.</h2><p>One PDF, up to 10 MB. The backend checks the file and page count before it’s ready to order.</p></div>
        {!file ? <button className={`drop-zone ${working ? 'drop-zone--busy' : ''}`} onClick={() => fileInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={fileDrop} disabled={working}><span className="upload-icon"><UploadCloud size={24} /></span><strong>{working ? 'Uploading and validating…' : 'Drop your PDF here'}</strong><span>or <u>browse files</u></span><small>PDF only · maximum 10 MB</small>{working && <div className="upload-progress"><span style={{ width: `${progress}%` }} /></div>}<input ref={fileInput} hidden type="file" accept="application/pdf,.pdf" onChange={(e) => upload(e.target.files[0])} /></button>
          : <div className="uploaded-file"><span className="document-mark"><FileText size={20} /></span><div><strong>{file.filename}</strong><span>{bytes(file.size)} · {file.pageCount} pages · validated</span></div><button className="icon-button" aria-label="Remove PDF" onClick={() => { setFile(null); setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return ''; }); }}><X size={17} /></button></div>}
        {previewUrl && <Suspense fallback={<Loader label="Loading PDF preview" />}><PdfPreview url={previewUrl} page={previewPage} pageCount={file.pageCount} onPageChange={setPreviewPage} /></Suspense>}
      </div>}
      {step === 2 && <div className="wizard-config"><div className="wizard-section-head"><span className="step-count">STEP 02 / PRINT SETTINGS</span><h2>Make it yours.</h2><p>Options reflect what {shop.name} currently offers.</p></div>
        <div className="config-group"><span className="field-label">PRINT TYPE</span><div className="choice-grid"><Choice active={config.printType === 'BW'} disabled={!shop.services?.bw} label="Black & white" detail={shop.services?.bw ? `${money(shop.pricing.bwPerSidePaise)} / side` : 'Not offered'} onClick={() => setConfig({ ...config, printType: 'BW' })} /><Choice active={config.printType === 'COLOUR'} disabled={!canColor} label="Colour" detail={canColor ? `${money(shop.pricing.colourPerSidePaise)} / side` : 'Not offered'} onClick={() => setConfig({ ...config, printType: 'COLOUR' })} /></div></div>
        <div className="form-grid-two"><Field label="Copies" type="number" min="1" max="20" value={config.copies} onChange={(e) => setConfig({ ...config, copies: Math.max(1, Math.min(20, Number(e.target.value))) })} /><Field label="Paper size" value="A4 · Standard" readOnly /></div>
        <div className="config-group"><span className="field-label">PAGES</span><div className="choice-grid"><Choice active={config.mode === 'ALL'} label="Entire document" detail={`${file.pageCount} pages`} onClick={() => setConfig({ ...config, mode: 'ALL' })} /><Choice active={config.mode === 'RANGE'} label="Selected pages" detail="Choose a range" onClick={() => setConfig({ ...config, mode: 'RANGE' })} /></div>        {config.mode === 'RANGE' && <Field label="Pages to print" value={config.ranges} onChange={(e) => setConfig({ ...config, ranges: e.target.value })} placeholder="Example: 1-5, 8, 10-12" maxLength={200} hint={`Enter page numbers from 1 to ${file.pageCount}.`} />}</div>
        <div className="config-group"><span className="field-label">PRINT SIDES</span><div className="choice-grid"><Choice active={config.sides === 'SINGLE'} label="Single-sided" detail="One side per sheet" onClick={() => setConfig({ ...config, sides: 'SINGLE' })} /><Choice active={config.sides === 'DOUBLE'} label="Double-sided" detail="Both sides of the sheet" onClick={() => setConfig({ ...config, sides: 'DOUBLE' })} /></div></div>
        <div className="config-group"><span className="field-label">BINDING</span><div className="choice-grid"><Choice active={config.binding === 'NONE'} label="No binding" detail="Loose sheets" onClick={() => setConfig({ ...config, binding: 'NONE' })} /><Choice active={config.binding === 'SPIRAL'} disabled={!canSpiral} label="Spiral binding" detail={canSpiral ? `${money(shop.pricing.spiralBindingPaise)} / copy` : 'Not offered'} onClick={() => setConfig({ ...config, binding: 'SPIRAL' })} /></div></div>
      </div>}
      {step === 3 && quote && <div className="wizard-section-head quote-review"><span className="step-count">STEP 03 / SERVER QUOTE</span><h2>Here’s the quote.</h2><p>This price is calculated by the shop’s backend. It is not charged online.</p><div className="quote-summary"><div className="quote-file"><FileText size={18} /><div><strong>{file.filename}</strong><span>{quote.selectedPages} selected pages · {config.copies} {config.copies === 1 ? 'copy' : 'copies'}</span></div></div><QuoteLine label={config.printType === 'BW' ? 'Black & white' : 'Colour'} value={`${config.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided'} · A4`} /><QuoteLine label="Binding" value={config.binding === 'SPIRAL' ? 'Spiral binding' : 'None'} /><div className="quote-total"><span>Backend quote</span><strong>{money(quote.pricing.totalPaise)}</strong></div><p className="quote-note">{quote.note}</p></div></div>}
      {step === 4 && <div className="wizard-section-head quote-review"><span className="step-count">STEP 04 / CONFIRM ORDER</span><h2>Ready to send it?</h2><p>The shop will review your request before it enters the print queue.</p><div className="quote-summary"><QuoteLine label="Shop" value={shop.name} /><QuoteLine label="Document" value={`${file.filename} · ${file.pageCount} pages`} /><QuoteLine label="Print setup" value={`${config.printType === 'BW' ? 'Black & white' : 'Colour'} · ${config.copies} copies · ${config.sides.toLowerCase()}`} /><QuoteLine label="Total quote" value={money(quote?.pricing?.totalPaise)} /><div className="payment-select"><span className="field-label">PAYMENT AT THE COUNTER</span><div className="choice-grid"><Choice active={payment === 'CASH'} label="Cash" detail="Pay at the shop" onClick={() => setPayment('CASH')} /><Choice active={payment === 'UPI'} label="UPI" detail="Pay at the shop" onClick={() => setPayment('UPI')} /></div></div><p className="quote-note">Payment is not collected online. Your preference helps the shop prepare for collection.</p></div></div>}
      {error && <div className="form-error wizard-error" role="alert">{error}</div>}
      <div className="wizard-actions">{step > 1 && <Button variant="secondary" disabled={working} onClick={() => { setError(''); setStep((s) => s - 1); }}>Back</Button>}{step < 4 ? <Button loading={working} disabled={step === 1 && !file} onClick={next}>{step === 2 ? 'Get quote' : step === 3 ? 'Continue' : 'Continue'} <ArrowRight size={16} /></Button> : <Button loading={working} onClick={placeOrder}>Place order <ArrowRight size={16} /></Button>}</div>
    </section>
    <p className="wizard-privacy"><ShieldCheck size={15} /> Your document is stored privately and is not public.</p>
  </div>;
}

function Choice({ active, disabled, label, detail, onClick }) {
  return <button type="button" className={`choice-card ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`} disabled={disabled} onClick={onClick}><span className="choice-radio" /> <span><strong>{label}</strong><small>{detail}</small></span></button>;
}
function QuoteLine({ label, value }) { return <div className="quote-line"><span>{label}</span><strong>{value}</strong></div>; }
function buildOrderPayload(shopId, fileId, config) {
  return { shopId, fileId, printType: config.printType, copies: Number(config.copies), pageSelection: config.mode === 'ALL' ? { mode: 'ALL' } : { mode: 'RANGE', ranges: config.ranges.trim() }, sides: config.sides, paperSize: 'A4', binding: config.binding };
}
function validatePageRanges(value, pageCount) {
  if (!value.trim()) return 'Enter the pages to print, for example 1-5, 8.';
  if (value.length > 200) return 'The page list is too long.';
  const ranges = [];
  for (const raw of value.split(',')) {
    const token = raw.trim();
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!match) return `"${token}" is not a valid page or range. Use numbers like 3 or 5-9.`;
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1) return 'Page numbers start at 1.';
    if (end < start) return `"${token}" is backwards.`;
    if (end > pageCount) return `Page ${end} is outside this ${pageCount}-page document.`;
    const overlap = ranges.find(([from, to]) => start <= to && end >= from);
    if (overlap) return `Page ${Math.max(start, overlap[0])} is listed more than once.`;
    ranges.push([start, end]);
  }
  return '';
}

export function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await api.get('/orders', { params: { page, limit: 10, status } }); setOrders(payload(r) || []); setMeta(r.data.pagination || { page, totalPages: 1 }); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [page, status]);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  return <div className="page-stack"><PageTitle eyebrow="YOUR ORDERS" title="My orders." description="Follow your print jobs from request to collection." actions={<Link className="button button--primary" to="/customer/shops">New order <ArrowRight size={16} /></Link>} />
    <label className="filter-select"><span>Filter status</span><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All orders</option>{['PENDING','ACCEPTED','PRINTING','READY_FOR_PICKUP','COLLECTED','REJECTED','CANCELLED'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select></label>
    {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={load} /> : orders.length ? <div className="orders-table-wrap"><table className="data-table"><thead><tr><th>ORDER</th><th>SHOP</th><th>STATUS</th><th>PLACED</th><th>TOTAL</th><th /></tr></thead><tbody>{orders.map((o) => <tr key={o.id}><td><Link className="mono strong-link" to={`/customer/orders/${o.id}`}>{o.orderNumber}</Link><span className="table-sub">{o.file?.filename}</span></td><td>{o.shop?.name}</td><td><StatusBadge value={o.status} /></td><td>{dateTime(o.createdAt)}</td><td>{money(o.totalPaise)}</td><td><Link to={`/customer/orders/${o.id}`} className="icon-button" aria-label={`View ${o.orderNumber}`}><ChevronRight size={17} /></Link></td></tr>)}</tbody></table></div> : <EmptyState icon={PackageCheck} title="No orders yet">Place an order with an approved shop and it will appear here.</EmptyState>}
    {!loading && !error && orders.length > 0 && <Pagination page={meta.page || page} totalPages={meta.totalPages || 1} onChange={setPage} />}
  </div>;
}

export function CustomerOrderDetails() {
  const { orderId } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [pickupError, setPickupError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setOrder(payload(await api.get(`/orders/${orderId}`))); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [orderId]);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (order?.status !== 'READY_FOR_PICKUP') return;
    api.get(`/orders/${orderId}/pickup`).then((r) => { setPickup(payload(r)); setPickupError(''); }).catch((e) => { setPickup(null); setPickupError(errorMessage(e)); });
  }, [order?.status, orderId]);
  const loadPickup = async () => {
    try { setPickup(payload(await api.get(`/orders/${orderId}/pickup`))); setPickupError(''); }
    catch (e) { setPickupError(errorMessage(e)); }
  };
  const cancel = async () => {
    setWorking(true);
    try { setOrder(payload(await api.patch(`/orders/${orderId}/cancel`))); toast('Order cancelled.'); return true; }
    catch (e) { toast(errorMessage(e), 'error'); return false; }
    finally { setWorking(false); }
  };
  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  const queue = order.queue;
  return <div className="page-stack"><BackLink to="/customer/orders">My orders</BackLink><PageTitle eyebrow={`ORDER / ${order.orderNumber}`} title={humanize(order.status)} actions={<StatusBadge value={order.status} />} description={`${order.shop?.name || 'Print shop'} · placed ${dateTime(order.createdAt)}`} />
    <div className="order-detail-layout"><div className="detail-main"><section className="panel"><div className="panel-heading"><span className="eyebrow">ORDER PROGRESS</span><h2>Order timeline</h2></div><Timeline events={order.events || []} status={order.status} createdAt={order.createdAt} /></section>
      <section className="panel"><div className="panel-heading"><span className="eyebrow">PRINT JOB</span><h2>Order details</h2></div><QuoteLine label="Document" value={`${order.file.filename} · ${order.file.pageCount} pages`} /><QuoteLine label="Print type" value={order.config.printType === 'BW' ? 'Black & white' : 'Colour'} /><QuoteLine label="Pages & copies" value={`${order.config.pageSelection.selectedPages} pages · ${order.config.copies} copies`} /><QuoteLine label="Sides & paper" value={`${humanize(order.config.sides)} · ${order.config.paperSize}`} /><QuoteLine label="Binding" value={humanize(order.config.binding)} /><QuoteLine label="Payment preference" value={`${order.paymentPreference} at shop`} /><QuoteLine label="Payment status" value={humanize(order.paymentStatus)} /><div className="quote-total"><span>Total</span><strong>{money(order.totalPaise)}</strong></div></section>
      {order.status === 'READY_FOR_PICKUP' && <section className="panel pickup-panel"><div className="panel-heading"><span className="eyebrow">COLLECT AT THE SHOP</span><h2>Your pickup details</h2><p>Show this QR code or give the shop owner your six-digit code.</p></div>{pickup ? <div className="pickup-token"><img src={pickup.qrDataUrl} alt="Order pickup QR code" /><span className="eyebrow">MANUAL PICKUP CODE</span><strong className="mono pickup-code">{pickup.manualCode}</strong><span className="pickup-order-number">{pickup.orderNumber}</span></div> : <div className="pickup-unavailable"><p className="field-hint">{pickupError || 'Loading pickup details…'}</p>{pickupError && <Button variant="secondary" onClick={loadPickup}>Try again</Button>}</div>}</section>}
    </div><aside className="order-aside"><div className="panel queue-panel"><span className="eyebrow">LIVE QUEUE</span>{queue ? <><div className="queue-position"><strong>{String(queue.position).padStart(2, '0')}</strong><span>YOUR POSITION</span></div><p>{queue.isPrinting ? 'Your order is being printed now.' : `${queue.ahead} ${queue.ahead === 1 ? 'order' : 'orders'} ahead of you.`}</p><small>Position is supplied by the shop’s live queue. No wait-time estimate is provided.</small></> : <><div className="queue-pending"><Clock3 size={20} /><strong>{order.status === 'PENDING' ? 'Awaiting shop response' : order.status === 'READY_FOR_PICKUP' ? 'Ready to collect' : humanize(order.status)}</strong></div><p>{order.status === 'PENDING' ? 'A queue position is assigned after the shop accepts your request.' : order.status === 'READY_FOR_PICKUP' ? 'This order has left the active queue.' : 'This order is not in the active print queue.'}</p></>}</div>
      <div className="panel shop-contact-panel"><span className="eyebrow">YOUR PRINT SHOP</span><h3>{order.shop?.name}</h3><p>{[order.shop?.address?.line, location(order.shop?.address)].filter(Boolean).join(', ')}</p>{order.shop?.phone && <a className="text-link" href={`tel:${order.shop.phone}`}>{order.shop.phone}</a>}</div>
      {order.status === 'PENDING' && <Button variant="danger" loading={working} onClick={() => setConfirmCancel(true)}>Cancel order</Button>}
    </aside></div>
    {confirmCancel && <ConfirmDialog title="Cancel this print request?" description="The shop has not accepted this order yet. The backend will confirm whether it can be cancelled." confirmLabel="Cancel order" danger onClose={() => setConfirmCancel(false)} onConfirm={async () => { if (!await cancel()) throw new Error('The order was not cancelled. Refresh and try again.'); }} />}
  </div>;
}

function Timeline({ events, status, createdAt }) {
  const milestones = ['PENDING', 'ACCEPTED', 'PRINTING', 'READY_FOR_PICKUP', 'COLLECTED'];
  const latest = events[events.length - 1];
  return <ol className="timeline">{events.map((event) => <li key={event.id} className="timeline-item"><span className="timeline-dot" /><div><strong>{humanize(event.to || event.from)}</strong><span>{event.note || `${humanize(event.byRole)} updated this order`}</span><time>{dateTime(event.at)}</time></div></li>)}{status !== 'COLLECTED' && !['REJECTED','CANCELLED'].includes(status) && !milestones.slice(0, milestones.indexOf(status) + 1).includes(latest?.to) && <li className="timeline-item timeline-item--current"><span className="timeline-dot" /><div><strong>{humanize(status)}</strong><span>Order placed</span><time>{dateTime(createdAt)}</time></div></li>}</ol>;
}

export function CustomerProfile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setProfileError('');
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const result = payload(await api.patch('/auth/profile', { name: form.name, ...(form.phone ? { phone: form.phone } : {}) })); setUser(result.user); toast('Profile updated.'); }
    catch (e) { setProfileError(errorMessage(e)); } finally { setSaving(false); }
  };
  const password = async (event) => {
    event.preventDefault(); setSaving(true); setPasswordError('');
    const formElement = event.currentTarget;
    const f = Object.fromEntries(new FormData(formElement).entries());
    try { await api.patch('/auth/password', { currentPassword: f.currentPassword, newPassword: f.newPassword }); formElement.reset(); toast('Password updated.'); }
    catch (e) { setPasswordError(errorMessage(e)); } finally { setSaving(false); }
  };
  return <div className="page-stack"><PageTitle eyebrow="YOUR ACCOUNT" title="Profile." description="Manage your personal information and sign-in details." /><div className="settings-grid"><form className="panel settings-form" onSubmit={submit}><div className="panel-heading"><span className="eyebrow">PERSONAL DETAILS</span><h2>Your information</h2></div><Field label="Name" name="name" defaultValue={user.name} required minLength={2} maxLength={80} /><Field label="Email" id="profile-email" value={user.email} readOnly /><Field label="Phone" name="phone" defaultValue={user.phone || ''} placeholder="Phone number" /><Button loading={saving}>Save profile</Button>{profileError && <p className="field-error">{profileError}</p>}</form><form className="panel settings-form" onSubmit={password}><div className="panel-heading"><span className="eyebrow">SECURITY</span><h2>Change password</h2></div><Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required /><Field label="New password" name="newPassword" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters, including a letter and a number." /><Button variant="secondary" loading={saving}>Update password</Button>{passwordError && <p className="field-error">{passwordError}</p>}</form></div></div>;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/notifications', { params: { limit: 30 } }); setItems(payload(r) || []); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, []);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  const orderPath = user?.role === 'shop_owner' ? '/shop/orders/' : '/customer/orders/';
  const markRead = async (id) => {
    try { await api.patch(`/notifications/${id}/read`); setItems((all) => all.map((n) => n.id === id ? { ...n, read: true } : n)); window.dispatchEvent(new Event('printrelay:refresh')); }
    catch (e) { setError(errorMessage(e)); }
  };
  const markAll = async () => {
    try { await api.patch('/notifications/read-all'); setItems((all) => all.map((n) => ({ ...n, read: true }))); window.dispatchEvent(new Event('printrelay:refresh')); }
    catch (e) { setError(errorMessage(e)); }
  };
  return <div className="page-stack"><PageTitle eyebrow="UPDATES" title="Notifications." description="Updates from your orders and print shop." actions={items.some((n) => !n.read) && <Button variant="secondary" onClick={markAll}>Mark all read</Button>} />
    {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={load} /> : items.length ? <div className="notification-list">{items.map((n) => <article key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`}><span className="notification-mark"><Bell size={17} /></span><div><strong>{n.title}</strong><p>{n.message}</p><time>{dateTime(n.createdAt)}</time></div>{!n.read && <button className="text-link notification-read" onClick={() => markRead(n.id)}>Mark read</button>}{n.orderId && <Link className="notification-open" to={`${orderPath}${n.orderId}`} aria-label="View order"><ChevronRight size={17} /></Link>}</article>)}</div> : <EmptyState icon={Bell} title="All caught up">Order updates will show here as your shop works on them.</EmptyState>}
  </div>;
}
