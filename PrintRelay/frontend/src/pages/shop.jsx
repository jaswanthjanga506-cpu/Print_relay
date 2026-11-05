import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Camera, Check, ChevronRight, CircleAlert, FileText, MapPin, PackageCheck, Printer, RefreshCw, ScanLine, Settings2, Store, X } from 'lucide-react';
import { api, errorMessage, payload } from '../services/api';
import { dateTime, humanize, location, money } from '../utils/format';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Loader, PageTitle, Pagination, StatusBadge } from '../components/common';
import { useToast } from '../context/ToastContext';
import { NotificationsPage } from './customer';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import '../styles/shop.css';

export function ShopDashboard() {
  const [summary, setSummary] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const [s, p] = await Promise.all([api.get('/shop/orders/summary'), api.get('/shop/me')]); setSummary(payload(s)); setShop(payload(p)); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, []);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Loader label="Loading shop operations" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  const approved = shop.approvalStatus === 'APPROVED';
  return <div className="page-stack"><PageTitle eyebrow="SHOP OPERATIONS" title="Your shop, in motion." description={`${shop.name} · ${location(shop.address)}`} actions={<Link className="button button--secondary" to="/shop/settings"><Settings2 size={16} /> Shop settings</Link>} />
    {shop.approvalStatus !== 'APPROVED' && <div className={`approval-banner approval-banner--${shop.approvalStatus?.toLowerCase()}`}><BadgeCheck size={20} /><div><strong>{shop.approvalStatus === 'PENDING' ? 'Your shop is awaiting approval.' : `Shop ${humanize(shop.approvalStatus).toLowerCase()}.`}</strong><span>{shop.approvalNote || 'PrintRelay reviews new shops before listing them to customers. Order-taking controls are available after approval.'}</span></div><StatusBadge value={shop.approvalStatus} /></div>}
    <div className="metric-grid"><Metric label="New requests" value={summary.requests} icon={Store} to="/shop/requests" /><Metric label="Active queue" value={summary.queue} icon={Printer} to="/shop/queue" /><Metric label="Ready for pickup" value={summary.ready} icon={PackageCheck} to="/shop/ready" /><Metric label="Printing now" value={summary.printing?.orderNumber || '—'} icon={RefreshCw} to={summary.printing ? `/shop/orders/${summary.printing.id}` : '/shop/queue'} /></div>
    <section className="content-section"><div className="section-heading"><div><span className="eyebrow">SHOP AVAILABILITY</span><h2>Taking orders</h2></div><Link className="text-link" to="/shop/settings">Manage availability <ArrowRight size={15} /></Link></div><div className="availability-strip"><div className={`availability-indicator ${shop.isOpen ? 'on' : ''}`}><span className="status-live" />{shop.isOpen ? 'Open' : 'Closed'}</div><span className="availability-divider" /><div className={`availability-indicator ${shop.acceptingOrders ? 'on' : ''}`}><span className="status-live" />{shop.acceptingOrders ? 'Accepting orders' : 'Not accepting orders'}</div><span className="availability-note">{approved ? 'These are separate settings.' : 'Approval is needed before accepting orders.'}</span></div></section>
    <section className="content-section"><div className="section-heading"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Incoming requests</h2></div><Link className="text-link" to="/shop/requests">Open requests <ArrowRight size={15} /></Link></div><ShopOrderPreview /></section>
    <section className="pickup-shortcut"><div><span className="eyebrow">AT THE COUNTER</span><h2>Verify a pickup.</h2><p>Scan the customer’s QR code or enter the order number and pickup code.</p></div><Link className="button button--primary" to="/shop/ready#verify">Open pickup verification <ArrowRight size={16} /></Link></section>
  </div>;
}

function Metric({ label, value, icon: Icon, to }) {
  return <Link className="metric-card metric-card--link" to={to}><div className="metric-icon"><Icon size={18} /></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-arrow"><ArrowRight size={15} /></span></Link>;
}

function ShopOrderPreview() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setOrders(payload(await api.get('/shop/orders', { params: { section: 'requests', limit: 3 } })) || []); setError(''); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(load);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!orders.length) return <div className="quiet-empty">No incoming print requests.</div>;
  return <div className="order-list">{orders.map((order) => <Link className="order-row" key={order.id} to={`/shop/orders/${order.id}`}><span className="document-mark"><FileText size={18} /></span><span className="order-row-main"><strong className="mono">{order.orderNumber}</strong><span>{order.customer?.name} · {order.file?.filename}</span></span><StatusBadge value={order.status} /><span className="order-row-total">{money(order.totalPaise)}</span><ChevronRight size={17} /></Link>)}</div>;
}

export function ShopOrders() {
  const section = useLocation().pathname.split('/').pop();
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const toast = useToast();
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await api.get('/shop/orders', { params: { section, page, limit: 12, q: query } }); setOrders(payload(r) || []); setMeta(r.data.pagination || { page, totalPages: 1 }); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [section, page, query]);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  const action = async (type, id, reason = '') => {
    try { await api.patch(`/shop/orders/${id}/${type}`, ['reject','cancel'].includes(type) ? { reason } : {}); toast(type === 'accept' ? 'Order accepted and added to the queue.' : `Order ${type === 'ready' ? 'marked ready' : `${type}ed`}.`); load(); return true; }
    catch (e) { toast(errorMessage(e), 'error'); return false; }
  };
  const titles = { requests: ['INCOMING / 01', 'New requests', 'Review and respond to customer print requests.'], queue: ['ACTIVE QUEUE / 02', 'Print queue', 'Work through accepted orders in the backend’s FIFO order.'], ready: ['COLLECTION / 03', 'Ready for pickup', 'Orders marked ready and waiting at the counter.'], history: ['COMPLETED / 04', 'Order history', 'Collected, rejected and cancelled orders.'] };
  const [eyebrow, title, description] = titles[section] || titles.queue;
  return <div className="page-stack"><PageTitle eyebrow={eyebrow} title={title} description={description} actions={section === 'ready' && <Link className="button button--secondary" to="#verify"><ScanLine size={16} /> Verify pickup</Link>} />
    <div className="shop-section-tabs">{Object.entries({ requests: 'Requests', queue: 'Print queue', ready: 'Ready for pickup', history: 'History' }).map(([key,label]) => <Link key={key} className={section === key ? 'active' : ''} to={`/shop/${key}`}>{label}</Link>)}</div>
    <form className="table-toolbar" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}><label className="search-input"><input placeholder="Search order number" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search order number" /><button className="button button--secondary" type="submit">Search</button></label><span>{meta.total ?? orders.length} orders</span></form>
    {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={load} /> : orders.length ? <div className="shop-orders-list">{orders.map((order) => <ShopOrderCard key={order.id} order={order} section={section} onAction={(type) => setDialog({ type, order })} />)}</div> : <EmptyState icon={section === 'requests' ? Store : section === 'ready' ? PackageCheck : Printer} title={section === 'requests' ? 'No new requests' : `No ${section === 'queue' ? 'active print jobs' : section === 'ready' ? 'ready orders' : 'order history'}`}>{section === 'requests' ? 'New customer requests will appear here.' : 'There’s nothing to show in this section right now.'}</EmptyState>}
    {!loading && !error && orders.length > 0 && <Pagination page={meta.page || page} totalPages={meta.totalPages || 1} onChange={setPage} />}
    {section === 'ready' && <PickupVerifier />}
    {dialog && ['reject','cancel'].includes(dialog.type)
      ? <ReasonActionDialog title={dialog.type === 'reject' ? 'Reject this request?' : 'Cancel this order?'} orderNumber={dialog.order.orderNumber} onClose={() => setDialog(null)} onConfirm={async (reason) => { if (!await action(dialog.type, dialog.order.id, reason)) throw new Error('The order was not updated. Review the error message and try again.'); }} />
      : dialog && <ConfirmDialog title={`${{ accept: 'Accept this order?', start: 'Start printing?', ready: 'Mark ready for pickup?' }[dialog.type]}`} description={`${dialog.order.orderNumber} · ${dialog.type === 'accept' ? 'This adds the order to the backend-managed FIFO queue.' : dialog.type === 'start' ? 'The backend will check this order is at the head of the queue.' : 'The customer will be notified that the order is ready.'}`} confirmLabel={dialog.type === 'accept' ? 'Accept order' : dialog.type === 'start' ? 'Start printing' : 'Mark ready'} onClose={() => setDialog(null)} onConfirm={async () => { if (!await action(dialog.type, dialog.order.id)) throw new Error('The order was not updated. Review the error message and try again.'); }} />}
    {section === 'ready' && <PaymentConfirm />}
  </div>;
}

function ShopOrderCard({ order, section, onAction }) {
  const actions = section === 'requests' ? <><Button onClick={() => onAction('accept')}><Check size={15} /> Accept</Button><Button variant="secondary" onClick={() => onAction('reject')}>Reject</Button></>
    : section === 'queue' ? <><Link className="button button--secondary" to={`/shop/orders/${order.id}`}>Details</Link>{order.status === 'ACCEPTED' ? <Button onClick={() => onAction('start')}><Printer size={15} /> Start printing</Button> : <Button onClick={() => onAction('ready')}><Check size={15} /> Mark ready</Button>}{order.status === 'ACCEPTED' && <Button variant="danger" onClick={() => onAction('cancel')}>Cancel</Button>}</>
      : section === 'ready' ? <><StatusBadge value={order.paymentStatus} /><Button variant="secondary" onClick={() => document.getElementById('payment-order')?.scrollIntoView({ behavior: 'smooth' })}>Confirm payment</Button></>
        : <Link className="button button--secondary" to={`/shop/orders/${order.id}`}>View details <ArrowRight size={15} /></Link>;
  return <article className="shop-order-card"><div className="shop-order-main"><div className="shop-order-heading"><Link className="mono strong-link" to={`/shop/orders/${order.id}`}>{order.orderNumber}</Link><StatusBadge value={order.status} />{section === 'queue' && order.queue?.position && <span className="queue-chip">QUEUE {order.queue.position}</span>}</div><div className="shop-order-customer"><strong>{order.customer?.name || 'Customer'}</strong>{order.customer?.phone && <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>}<span>{dateTime(order.createdAt)}</span></div><div className="shop-order-file"><FileText size={16} /><span>{order.file.filename}</span><span>{order.file.pageCount} pages</span><span>{order.config.copies} copies</span></div><div className="shop-order-config">{humanize(order.config.printType)} · {humanize(order.config.sides)} · {humanize(order.config.binding)} · {order.config.paperSize}</div></div><div className="shop-order-side"><strong className="shop-order-total">{money(order.totalPaise)}</strong><span>{humanize(order.paymentPreference)} at counter</span><div className="shop-order-actions">{actions}</div></div></article>;
}

function ReasonActionDialog({ title, orderNumber, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return <ConfirmDialog title={title} description={`${orderNumber} · Add a reason so the customer understands what happened.`} confirmLabel="Continue" danger onClose={onClose} onConfirm={() => { if (reason.trim().length < 3) throw new Error('Enter a reason of at least 3 characters.'); return onConfirm(reason.trim()); }}>
    <Field as="textarea" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} minLength={3} maxLength={300} placeholder="Briefly explain the reason" required />
  </ConfirmDialog>;
}

function PaymentConfirm() {
  const toast = useToast();
  const [orderId, setOrderId] = useState('');
  const [reference, setReference] = useState('');
  const [orders, setOrders] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const load = useCallback(async () => {
    try { setOrders(payload(await api.get('/shop/orders', { params: { section: 'ready', limit: 50 } })) || []); setLoadError(''); }
    catch (e) { setLoadError(errorMessage(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(load);
  useEffect(() => { const match = orders.find((o) => o.id === orderId); setReference(''); if (match?.paymentStatus === 'PAID') setOrderId(''); }, [orderId, orders]);
  const submit = async (e) => {
    e.preventDefault(); if (!orderId) return;
    setConfirm(true);
  };
  const completePayment = async () => {
    setBusy(true);
    try { await api.patch(`/shop/orders/${orderId}/payment`, reference ? { upiReference: reference } : {}); toast('Payment confirmed by the shop.'); setOrderId(''); setReference(''); await load(); }
    catch (e) { toast(errorMessage(e), 'error'); throw new Error('Payment was not confirmed. Review the error and try again.'); }
    finally { setBusy(false); }
  };
  const unpaid = orders.filter((o) => o.paymentStatus === 'UNPAID');
  return <section className="panel payment-panel" id="payment-order"><div className="panel-heading"><span className="eyebrow">COUNTER PAYMENT</span><h2>Confirm payment received</h2><p>Only confirm once the customer has paid at the shop.</p></div>{loadError ? <ErrorState message={loadError} onRetry={load} /> : unpaid.length ? <form className="payment-form" onSubmit={submit}><Field as="select" label="Ready order" value={orderId} onChange={(e) => setOrderId(e.target.value)} required><option value="">Select an order</option>{unpaid.map((o) => <option key={o.id} value={o.id}>{o.orderNumber} · {o.paymentPreference} · {money(o.totalPaise)}</option>)}</Field>{unpaid.find((o) => o.id === orderId)?.paymentPreference === 'UPI' && <Field label="UPI reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} minLength={3} maxLength={60} placeholder="Transaction reference" />}<Button loading={busy} disabled={!orderId}><Check size={15} /> Confirm received</Button></form> : <p className="field-hint">No unpaid ready orders to confirm.</p>}{confirm && <ConfirmDialog title="Confirm payment at the counter?" description={`This will record payment received for ${orders.find((o) => o.id === orderId)?.orderNumber || 'the selected order'}. Confirm only after the customer has paid.`} confirmLabel="Record payment" onClose={() => setConfirm(false)} onConfirm={completePayment} />}</section>;
}

function PickupVerifier() {
  const toast = useToast();
  const [manual, setManual] = useState({ orderNumber: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [scan, setScan] = useState(false);
  const [scanError, setScanError] = useState('');
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  useEffect(() => {
    if (!scan || !videoRef.current) return undefined;
    let active = true;
    let scanned = false;
    let controls;
    import('@zxing/browser').then(({ BrowserQRCodeReader }) => {
      if (!active) return;
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;
      return reader.decodeFromVideoDevice(undefined, videoRef.current, async (decoded) => {
        if (!active || !decoded) return;
        if (scanned) return;
        scanned = true;
        const value = decoded.getText();
        const prefix = 'printrelay:pickup:';
        const token = value.startsWith(prefix) ? value.slice(prefix.length) : value;
        setScan(false);
        await verify({ token });
      }).then((result) => { controls = result; });
    }).catch((e) => { if (active) setScanError(e.message || 'Camera access is unavailable. Use manual verification below.'); });
    return () => { active = false; controls?.stop(); readerRef.current?.reset(); };
  }, [scan]);
  const verify = async (data) => {
    setBusy(true); setScanError(''); setResult(null);
    try {
      const res = payload(await api.post('/shop/orders/verify-pickup', { ...data, collect: false }));
      setCandidate({ credentials: data, order: res.order }); toast('Pickup code is valid. Confirm collection when the order is handed over.');
    } catch (e) { const message = errorMessage(e); setScanError(message); toast(message, 'error'); }
    finally { setBusy(false); }
  };
  const [candidate, setCandidate] = useState(null);
  const collect = async () => {
    setBusy(true);
    try {
      const res = payload(await api.post('/shop/orders/verify-pickup', candidate.credentials));
      setResult(res); setCandidate(null); setManual({ orderNumber: '', code: '' }); toast('Pickup verified. Order collected.');
    } catch (e) { const message = errorMessage(e); setScanError(message); toast(message, 'error'); throw new Error('Collection was not recorded. Review the error and try again.'); }
    finally { setBusy(false); }
  };
  return <section className="panel pickup-verifier" id="verify"><div className="panel-heading"><span className="eyebrow">COLLECTION COUNTER</span><h2>Verify a pickup</h2><p>Only paid, ready orders can be collected. The backend checks the code and updates the order.</p></div>
    {result && <div className={`verification-result ${result.collected ? 'success' : ''}`}><span>{result.collected ? <Check size={18} /> : <CircleAlert size={18} />}</span><div><strong>{result.collected ? 'Pickup complete' : 'Pickup verified'}</strong><p>{result.order?.orderNumber} · {humanize(result.order?.status)} · {humanize(result.order?.paymentStatus)}</p></div><button className="icon-button" onClick={() => setResult(null)} aria-label="Dismiss result"><X size={17} /></button></div>}
    <div className="pickup-verify-grid"><div className="scanner-block"><div className="scanner-preview">{scan ? <video ref={videoRef} muted playsInline /> : <div><ScanLine size={27} /><span>Camera preview</span></div>}</div><Button variant="secondary" onClick={() => { setScanError(''); setScan((s) => !s); }}><Camera size={16} />{scan ? 'Stop camera' : 'Scan customer QR'}</Button></div>
      <form className="manual-pickup" onSubmit={(e) => { e.preventDefault(); verify({ orderNumber: manual.orderNumber.trim(), code: manual.code.trim() }); }}><span className="field-label">OR ENTER MANUALLY</span><Field label="Order number" value={manual.orderNumber} onChange={(e) => setManual({ ...manual, orderNumber: e.target.value.toUpperCase() })} placeholder="PR-…" required /><Field label="6-digit pickup code" value={manual.code} onChange={(e) => setManual({ ...manual, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required /><Button loading={busy} disabled={manual.code.length !== 6 || !manual.orderNumber}>Verify pickup code <ArrowRight size={15} /></Button></form>
    </div>
    {scanError && <p className="inline-error" role="alert">{scanError}</p>}
    {candidate && <ConfirmDialog title={`Collect ${candidate.order?.orderNumber}?`} description={`${candidate.order?.customer?.name || 'Customer'} · ${money(candidate.order?.totalPaise)} · Payment ${humanize(candidate.order?.paymentStatus)}. The backend will verify the code again and mark this order collected.`} confirmLabel="Confirm collection" onClose={() => setCandidate(null)} onConfirm={collect} />}
  </section>;
}

export function ShopOrderDetails() {
  const { orderId } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setOrder(payload(await api.get(`/shop/orders/${orderId}`))); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [orderId]);
  useRealtimeRefresh(load);
  useEffect(() => { load(); }, [load]);
  const action = async (name, reason = '') => {
    try { setOrder(payload(await api.patch(`/shop/orders/${orderId}/${name}`, ['cancel','reject'].includes(name) ? { reason } : {}))); toast('Order updated.'); return true; }
    catch (e) { toast(errorMessage(e), 'error'); return false; }
  };
  const download = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/files/${order.file.id}`, { params: { download: '1' }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = order.file.filename || 'document.pdf';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (e) { toast(errorMessage(e), 'error'); }
    finally { setDownloading(false); }
  };
  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  return <div className="page-stack"><Link className="back-link" to="/shop/queue">← Print queue</Link><PageTitle eyebrow={`ORDER / ${order.orderNumber}`} title={order.customer?.name || 'Customer order'} description={`${order.file.filename} · submitted ${dateTime(order.createdAt)}`} actions={<StatusBadge value={order.status} />} />
    <div className="detail-columns"><div className="detail-main">    <section className="panel"><div className="panel-heading"><span className="eyebrow">PRINT DETAILS</span><h2>{order.orderNumber}</h2></div><QuoteLine label="Customer" value={`${order.customer?.name || 'Customer'}${order.customer?.phone ? ` · ${order.customer.phone}` : ''}`} /><QuoteLine label="Document" value={`${order.file.filename} · ${order.file.pageCount} pages`} /><QuoteLine label="Configuration" value={`${humanize(order.config.printType)} · ${order.config.copies} copies · ${humanize(order.config.sides)} · ${humanize(order.config.binding)}`} /><QuoteLine label="Page selection" value={order.config.pageSelection.ranges || 'Entire document'} /><QuoteLine label="Payment preference" value={`${order.paymentPreference} at counter`} /><QuoteLine label="Payment status" value={humanize(order.paymentStatus)} /><div className="quote-total"><span>Total</span><strong>{money(order.totalPaise)}</strong></div><Button variant="secondary" loading={downloading} onClick={download}><FileText size={15} /> Download customer PDF</Button></section>
      <section className="panel"><div className="panel-heading"><span className="eyebrow">ORDER ACTIVITY</span><h2>Timeline</h2></div><ol className="timeline">{(order.events || []).map((event) => <li className="timeline-item" key={event.id}><span className="timeline-dot" /><div><strong>{humanize(event.to || event.from)}</strong><span>{event.note || humanize(event.byRole)}</span><time>{dateTime(event.at)}</time></div></li>)}</ol></section></div>
      <aside className="order-aside"><div className="panel"><span className="eyebrow">QUEUE</span>{order.queue ? <><div className="queue-position"><strong>{String(order.queue.position).padStart(2,'0')}</strong><span>POSITION</span></div><p>{order.queue.isPrinting ? 'Printing now' : `${order.queue.ahead} orders ahead`}</p></> : <p>This order is not in the active queue.</p>}</div><div className="panel shop-contact-panel"><span className="eyebrow">ORDER ACTIONS</span>{order.status === 'PENDING' && <><Button className="button--full" onClick={() => setDialog('accept')}><Check size={15} /> Accept request</Button><Button className="button--full" variant="danger" onClick={() => setDialog('reject')}>Reject request</Button></>}{order.status === 'ACCEPTED' && <><Button className="button--full" onClick={() => setDialog('start')}><Printer size={15} /> Start printing</Button><Button className="button--full" variant="danger" onClick={() => setDialog('cancel')}>Cancel accepted order</Button></>}{order.status === 'PRINTING' && <Button className="button--full" onClick={() => setDialog('ready')}><PackageCheck size={15} /> Mark ready for pickup</Button>}{['ACCEPTED','PRINTING','READY_FOR_PICKUP'].includes(order.status) && order.paymentStatus === 'UNPAID' && <Button className="button--full" variant="secondary" onClick={() => setDialog('payment')}>Confirm payment received</Button>}</div></aside>
    </div>{dialog && ['reject','cancel'].includes(dialog)
      ? <ReasonActionDialog title={dialog === 'reject' ? 'Reject this request?' : 'Cancel this order?'} orderNumber={order.orderNumber} onClose={() => setDialog(null)} onConfirm={async (reason) => { if (!await action(dialog, reason)) throw new Error('The order was not updated. Review the error message and try again.'); }} />
      : dialog && <ConfirmDialog title={`${{ accept: 'Accept this order?', start: 'Start printing?', ready: 'Mark ready for pickup?', payment: 'Confirm payment received?' }[dialog]}`} description={`${order.orderNumber} · ${dialog === 'accept' ? 'This adds the order to the backend-managed FIFO queue.' : dialog === 'start' ? 'The backend will check this order is at the head of the queue.' : dialog === 'ready' ? 'The customer will be notified that the order is ready.' : 'Only confirm after the customer has paid at the counter.'}`} confirmLabel={dialog === 'accept' ? 'Accept order' : dialog === 'start' ? 'Start printing' : dialog === 'ready' ? 'Mark ready' : 'Confirm payment'} onClose={() => setDialog(null)} onConfirm={async () => { if (!await action(dialog)) throw new Error('The order was not updated. Review the error message and try again.'); }} />}
  </div>;
}
function QuoteLine({ label, value }) { return <div className="quote-line"><span>{label}</span><strong>{value}</strong></div>; }

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function ShopSettings() {
  const toast = useToast();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [offer, setOffer] = useState(null);
  const [formHours, setFormHours] = useState([]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = payload(await api.get('/shop/me')); setShop(data); setOpen(data.isOpen); setAccepting(data.acceptingOrders);
      setOffer({ services: data.services, pricing: { bwPerSidePaise: data.pricing.bwPerSidePaise / 100, colourPerSidePaise: data.pricing.colourPerSidePaise / 100, spiralBindingPaise: data.pricing.spiralBindingPaise / 100 } });
      setFormHours(data.hours?.length === 7 ? data.hours : Array.from({ length: 7 }, (_, day) => ({ day, closed: day === 0, open: '09:00', close: '19:00' })));
      setError('');
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  const updateAvailability = async (key, value) => {
    if (key === 'acceptingOrders' && value && shop.approvalStatus !== 'APPROVED') { toast('Your shop must be approved before accepting orders.', 'error'); return; }
    try { const d = payload(await api.patch('/shop/me/availability', { [key]: value })); setShop(d); if (key === 'isOpen') setOpen(value); else setAccepting(value); toast(`${key === 'isOpen' ? 'Shop status' : 'Order availability'} updated.`); }
    catch (e) { toast(errorMessage(e), 'error'); }
  };
  const saveShop = async (event) => {
    event.preventDefault(); setSaving(true);
    const f = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const data = payload(await api.patch('/shop/me', { name: f.name, phone: f.phone, email: f.email || undefined, address: { line: f.line, locality: f.locality, city: f.city, ...(f.state ? { state: f.state } : {}), ...(f.pincode ? { pincode: f.pincode } : {}) }, hours: formHours }));
      setShop(data); toast('Shop profile and hours saved.');
    } catch (e) { toast(errorMessage(e), 'error'); } finally { setSaving(false); }
  };
  const saveOfferings = async (event) => {
    event.preventDefault(); setSaving(true);
    const form = event.currentTarget;
    const body = { services: offer.services, pricing: { bwPerSidePaise: Math.round(Number(form.bw.value || 0) * 100), colourPerSidePaise: Math.round(Number(form.colour.value || 0) * 100), spiralBindingPaise: Math.round(Number(form.spiral.value || 0) * 100) } };
    try { const d = payload(await api.patch('/shop/me/offerings', body)); setShop(d); toast('Services and prices updated.'); }
    catch (e) { toast(errorMessage(e), 'error'); } finally { setSaving(false); }
  };
  const changeHours = (index, key, value) => setFormHours((all) => all.map((h, i) => i === index ? { ...h, [key]: value } : h));
  return <div className="page-stack"><PageTitle eyebrow="SHOP MANAGEMENT" title="Shop settings." description="Keep your listing, services, prices and availability up to date." actions={<StatusBadge value={shop.approvalStatus} />} />
    <section className="panel availability-settings"><div><span className="eyebrow">AVAILABILITY</span><h2>When customers can order</h2><p>Opening status and order acceptance are controlled separately.</p></div><div className="setting-switches"><label className="switch-row"><span><strong>Shop is open</strong><small>Reflects whether your shop is currently open.</small></span><input type="checkbox" checked={open} onChange={(e) => updateAvailability('isOpen', e.target.checked)} /><span className="switch-control" /></label><label className="switch-row"><span><strong>Accepting orders</strong><small>Customers can place new print requests.</small></span><input type="checkbox" checked={accepting} disabled={shop.approvalStatus !== 'APPROVED'} onChange={(e) => updateAvailability('acceptingOrders', e.target.checked)} /><span className="switch-control" /></label></div></section>
    <form className="panel settings-form shop-profile-form" onSubmit={saveShop}><div className="panel-heading"><span className="eyebrow">PUBLIC LISTING</span><h2>Shop profile and hours</h2></div><div className="form-grid-two"><Field label="Shop name" name="name" defaultValue={shop.name} required minLength={2} maxLength={100} /><Field label="Shop phone" name="phone" defaultValue={shop.phone} required /><Field label="Street address" name="line" defaultValue={shop.address.line} required minLength={3} /><Field label="Locality" name="locality" defaultValue={shop.address.locality} required minLength={2} /><Field label="City" name="city" defaultValue={shop.address.city} required minLength={2} /><Field label="State (optional)" name="state" defaultValue={shop.address.state || ''} /><Field label="Pincode" name="pincode" defaultValue={shop.address.pincode || ''} pattern="[0-9]{6}" /><Field label="Shop email (optional)" name="email" type="email" defaultValue={shop.email || ''} /></div><div className="hours-editor"><div className="panel-heading"><span className="eyebrow">OPERATING HOURS</span><h3>Weekly schedule</h3></div>{formHours.map((h, index) => <div className="hours-row" key={h.day}><strong>{days[h.day] || days[index]}</strong><label className="hours-closed"><input type="checkbox" checked={h.closed} onChange={(e) => changeHours(index, 'closed', e.target.checked)} /> Closed</label><input aria-label={`${days[h.day]} opens`} type="time" value={h.open} disabled={h.closed} onChange={(e) => changeHours(index, 'open', e.target.value)} /><span>to</span><input aria-label={`${days[h.day]} closes`} type="time" value={h.close} disabled={h.closed} onChange={(e) => changeHours(index, 'close', e.target.value)} /></div>)}</div><Button loading={saving}>Save shop profile</Button></form>
    <form className="panel settings-form" onSubmit={saveOfferings}><div className="panel-heading"><span className="eyebrow">SERVICES &amp; PRICING</span><h2>Your offerings</h2><p>Enter customer-facing prices in rupees. PrintRelay stores them as integer paise.</p></div><div className="offering-row"><label><input type="checkbox" checked={offer.services.bw} onChange={(e) => setOffer({ ...offer, services: { ...offer.services, bw: e.target.checked } })} /> Black &amp; white printing</label><Field label="Per printed side (₹)" name="bw" type="number" min="0" step="0.01" defaultValue={offer.pricing.bwPerSidePaise.toFixed(2)} /></div><div className="offering-row"><label><input type="checkbox" checked={offer.services.colour} onChange={(e) => setOffer({ ...offer, services: { ...offer.services, colour: e.target.checked } })} /> Colour printing</label><Field label="Per printed side (₹)" name="colour" type="number" min="0" step="0.01" defaultValue={offer.pricing.colourPerSidePaise.toFixed(2)} /></div><div className="offering-row"><label><input type="checkbox" checked={offer.services.spiralBinding} onChange={(e) => setOffer({ ...offer, services: { ...offer.services, spiralBinding: e.target.checked } })} /> Spiral binding</label><Field label="Per copy (₹)" name="spiral" type="number" min="0" step="0.01" defaultValue={offer.pricing.spiralBindingPaise.toFixed(2)} /></div><Button loading={saving}>Save services and prices</Button></form>
  </div>;
}

export function ShopProfile() {
  return <ShopSettings />;
}

export function ShopNotifications() {
  return <NotificationsPage />;
}
