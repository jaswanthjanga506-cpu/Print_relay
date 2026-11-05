import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Ban, Check, ClipboardList, Search, ShieldCheck, Store, Users } from 'lucide-react';
import { api, errorMessage, payload } from '../services/api';
import { dateTime, humanize, location, money } from '../utils/format';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Loader, PageTitle, Pagination, StatusBadge } from '../components/common';
import { useToast } from '../context/ToastContext';
import '../styles/admin.css';

export function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(payload(await api.get('/admin/dashboard'))); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Loader label="Loading platform summary" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  return <div className="page-stack"><PageTitle eyebrow="PLATFORM OVERVIEW" title="The whole picture." description="A clear view of shops, users and order activity." />
    <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">SHOP NETWORK</span><h2>Shop approvals</h2></div><Link className="text-link" to="/admin/shops">Manage shops <ArrowRight size={15} /></Link></div><div className="metric-grid admin-metrics">{Object.entries(data.shops || {}).map(([status,count]) => <div className="metric-card" key={status}><span className="metric-label">{humanize(status)} shops</span><strong>{count}</strong></div>)}</div></div>
    <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">COMMUNITY</span><h2>Users</h2></div><Link className="text-link" to="/admin/users">Manage users <ArrowRight size={15} /></Link></div><div className="metric-grid"><div className="metric-card"><div className="metric-icon"><Users size={18} /></div><span className="metric-label">Customers</span><strong>{data.users.customers}</strong></div><div className="metric-card"><div className="metric-icon"><Store size={18} /></div><span className="metric-label">Shop owners</span><strong>{data.users.shopOwners}</strong></div></div></div>
    <div className="admin-section"><div className="section-heading"><div><span className="eyebrow">ORDER FLOW</span><h2>Orders by status</h2></div><Link className="text-link" to="/admin/orders">Monitor orders <ArrowRight size={15} /></Link></div><div className="metric-grid admin-metrics">{Object.entries(data.orders || {}).map(([status,count]) => <div className="metric-card" key={status}><span className="metric-label">{humanize(status)}</span><strong>{count}</strong></div>)}</div></div>
  </div>;
}

function SearchFilter({ query, setQuery, status, setStatus, statuses, role, setRole, roles, onSearch }) {
  return <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); onSearch(); }}><label className="search-input"><Search size={17} /><input placeholder="Search by name, locality or email" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="button button--secondary" type="submit">Search</button></label>{statuses && <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); onSearch(e.target.value); }}><option value="">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select>}{roles && <select aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); onSearch(e.target.value); }}><option value="">All roles</option>{roles.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</select>}</form>;
}

export function AdminShops() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const toast = useToast();
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/shops', { params: { q: search, status, page, limit: 15 } }); setItems(payload(r) || []); setMeta(r.data.pagination || { page, totalPages: 1 }); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [search,status,page]);
  useEffect(() => { load(); }, [load]);
  const update = async (item, action, note) => {
    try { await api.patch(`/admin/shops/${item.id}/status`, { status: action, ...(note ? { note } : {}) }); toast(`${item.name} marked ${humanize(action).toLowerCase()}.`); load(); }
    catch (e) { toast(errorMessage(e), 'error'); throw e; }
  };
  return <div className="page-stack"><PageTitle eyebrow="SHOP NETWORK" title="Shop approvals." description="Review registrations and manage the status of approved shops." /><SearchFilter query={query} setQuery={setQuery} status={status} setStatus={(v) => { setStatus(v); setPage(1); }} statuses={['PENDING','APPROVED','REJECTED','SUSPENDED']} onSearch={(value) => { if (typeof value === 'string') setStatus(value); else setSearch(query.trim()); setPage(1); }} />
    {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={load} /> : items.length ? <div className="admin-shop-list">{items.map((shop) => <article className="admin-shop-row" key={shop.id}><span className="shop-symbol"><Store size={19} /></span><div className="admin-shop-info"><strong>{shop.name}</strong><span>{location(shop.address)} · {shop.address?.line}</span><small>{shop.owner?.name} · {shop.owner?.email}</small></div><span className="admin-shop-date">{dateTime(shop.createdAt)}</span><StatusBadge value={shop.approvalStatus} /><div className="admin-row-actions">{shop.approvalStatus !== 'APPROVED' && <Button onClick={() => update(shop,'APPROVED')}><Check size={14} /> Approve</Button>}{shop.approvalStatus === 'PENDING' && <Button variant="secondary" onClick={() => setDialog({ shop, status: 'REJECTED' })}>Reject</Button>}{shop.approvalStatus === 'APPROVED' && <Button variant="danger" onClick={() => setDialog({ shop, status: 'SUSPENDED' })}><Ban size={14} /> Suspend</Button>}</div></article>)}</div> : <EmptyState icon={Store} title="No shops found">Try a different search or approval filter.</EmptyState>}
    {!loading && items.length > 0 && <Pagination page={meta.page || page} totalPages={meta.totalPages || 1} onChange={setPage} />}
    {dialog && <ShopStatusDialog shop={dialog.shop} status={dialog.status} onClose={() => setDialog(null)} onConfirm={(note) => update(dialog.shop,dialog.status,note)} />}
  </div>;
}

function ShopStatusDialog({ shop, status, onClose, onConfirm }) {
  const [note, setNote] = useState('');
  return <ConfirmDialog title={`${humanize(status)} ${shop.name}?`} description={status === 'REJECTED' ? 'Provide a note explaining why this shop registration was rejected.' : 'Provide a note explaining why this shop is being suspended.'} confirmLabel={humanize(status)} danger onClose={onClose} onConfirm={() => { if (note.trim().length < 3) throw new Error('Please provide a note of at least 3 characters.'); return onConfirm(note.trim()); }}><Field as="textarea" label="Approval note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} required /></ConfirmDialog>;
}

export function AdminUsers() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const toast = useToast();
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/users', { params: { q: search, role, page, limit: 15 } }); setItems(payload(r) || []); setMeta(r.data.pagination || { page, totalPages: 1 }); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [search,role,page]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (user) => {
    const status = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try { await api.patch(`/admin/users/${user.id}/status`, { status }); toast(`${user.name} marked ${status.toLowerCase()}.`); load(); return true; }
    catch (e) { toast(errorMessage(e), 'error'); return false; }
  };
  const onSearch = (value) => { if (typeof value === 'string') setRole(value); else setSearch(query.trim()); setPage(1); };
  return <div className="page-stack"><PageTitle eyebrow="PEOPLE" title="Users." description="Search customer and shop-owner accounts and manage access." /><SearchFilter query={query} setQuery={setQuery} role={role} setRole={(v) => { setRole(v); setPage(1); }} roles={['customer','shop_owner','admin']} onSearch={onSearch} />
    {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={load} /> : items.length ? <div className="orders-table-wrap"><table className="data-table"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>REGISTERED</th><th>ACTION</th></tr></thead><tbody>{items.map((u) => <tr key={u.id}><td><strong>{u.name}</strong><span className="table-sub">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span></td><td>{humanize(u.role)}</td><td><StatusBadge value={u.status} /></td><td>{dateTime(u.createdAt)}</td><td>{u.role === 'admin' ? <span className="table-sub">Admin accounts are protected</span> : <Button variant={u.status === 'ACTIVE' ? 'secondary' : 'primary'} onClick={() => setPending(u)}>{u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</Button>}</td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No users found">Try a different search or role filter.</EmptyState>}
    {!loading && items.length > 0 && <Pagination page={meta.page || page} totalPages={meta.totalPages || 1} onChange={setPage} />}
    {pending && <ConfirmDialog title={`${pending.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'} ${pending.name}?`} description="This updates account access on the backend. The user’s existing data is not deleted." confirmLabel={pending.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'} danger={pending.status === 'ACTIVE'} onClose={() => setPending(null)} onConfirm={async () => { if (!await toggle(pending)) throw new Error('The account status was not updated. Review the error message and try again.'); }} />}
  </div>;
}

export function AdminOrders() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/orders', { params: { q: query, status, page, limit: 15 } }); setItems(payload(r) || []); setMeta(r.data.pagination || { page, totalPages: 1 }); setError(''); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [query,status,page]);
  useEffect(() => { load(); }, [load]);
  return <div className="page-stack"><PageTitle eyebrow="ORDER MONITORING" title="All orders." description="Platform-wide view of order and payment status. Documents remain private." /><form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}><label className="search-input"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order number" /><button className="button button--secondary">Search</button></label><select aria-label="Filter order status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All order statuses</option>{['PENDING','ACCEPTED','PRINTING','READY_FOR_PICKUP','COLLECTED','REJECTED','CANCELLED'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select></form>
    {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={load} /> : items.length ? <div className="orders-table-wrap"><table className="data-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>SHOP</th><th>ORDER STATUS</th><th>PAYMENT</th><th>TOTAL</th><th>PLACED</th></tr></thead><tbody>{items.map((o) => <tr key={o.id}><td><strong className="mono">{o.orderNumber}</strong></td><td>{o.customer?.name || '—'}</td><td>{o.shop?.name || '—'}</td><td><StatusBadge value={o.status} /></td><td><StatusBadge value={o.paymentStatus} /></td><td>{money(o.totalPaise)}</td><td>{dateTime(o.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState icon={ClipboardList} title="No orders found">Try another order status or search.</EmptyState>}
    {!loading && items.length > 0 && <Pagination page={meta.page || page} totalPages={meta.totalPages || 1} onChange={setPage} />}
  </div>;
}
