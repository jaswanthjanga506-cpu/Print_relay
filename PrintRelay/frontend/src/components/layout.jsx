import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, CircleUserRound, FilePlus2, LayoutDashboard, LogOut, Menu, PackageSearch, Printer, Settings2, ShieldCheck, Store, X } from 'lucide-react';
import { api, errorMessage, payload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Logo, Loader } from './common';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

const navs = {
  customer: [
    { to: '/customer/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/customer/shops', label: 'Find a shop', icon: Store },
    { to: '/customer/orders', label: 'My orders', icon: PackageSearch },
    { to: '/customer/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/customer/profile', label: 'Profile', icon: CircleUserRound },
  ],
  shop_owner: [
    { to: '/shop/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/shop/requests', label: 'Requests', icon: FilePlus2 },
    { to: '/shop/queue', label: 'Print queue', icon: Printer },
    { to: '/shop/ready', label: 'Ready for pickup', icon: PackageSearch },
    { to: '/shop/history', label: 'Order history', icon: PackageSearch },
    { to: '/shop/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/shop/settings', label: 'Shop settings', icon: Settings2 },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/shops', label: 'Shop approvals', icon: Store },
    { to: '/admin/users', label: 'Users', icon: CircleUserRound },
    { to: '/admin/orders', label: 'All orders', icon: PackageSearch },
  ],
};

function NotificationCount() {
  const [count, setCount] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const fetchCount = useCallback(async () => {
    try { const data = payload(await api.get('/notifications/unread-count')); setCount(data.unread); setUnavailable(false); }
    catch { setUnavailable(true); }
  }, []);
  useRealtimeRefresh(fetchCount);
  useEffect(() => {
    let active = true;
    fetchCount();
    const timer = window.setInterval(() => { if (active) fetchCount(); }, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [fetchCount]);
  return unavailable ? <span className="nav-count nav-count--error" title="Unread count unavailable">!</span>
    : count > 0 ? <span className="nav-count">{count > 9 ? '9+' : count}</span> : null;
}

export function ProtectedLayout({ role }) {
  const { user, ready, initError, refresh } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="full-loader"><Loader label="Checking your session" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname, message: initError }} />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <Workspace role={role} />;
}

function homeFor(role) {
  return role === 'admin' ? '/admin/dashboard' : role === 'shop_owner' ? '/shop/dashboard' : '/customer/dashboard';
}

function Workspace({ role }) {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navs[role] || [];

  useEffect(() => { setMobileOpen(false); }, [navigate]);
  const logout = async () => {
    try { await signOut(); navigate('/'); } catch (error) { toast(error.message, 'error'); }
  };

  return <div className="workspace">
    {mobileOpen && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar-brand"><Logo light /><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-label">{role === 'shop_owner' ? 'SHOP OPERATIONS' : role === 'admin' ? 'ADMINISTRATION' : 'YOUR WORKSPACE'}</div>
      <nav className="side-nav">
        {items.map(({ to, label, icon: Icon, badge }) => <NavLink key={to} to={to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} end={to.endsWith('dashboard')}>
          <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{badge && <NotificationCount />}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><span className="tip-mark">PR</span><div><strong>{role === 'shop_owner' ? 'Keep the queue moving.' : role === 'admin' ? 'One clear view.' : 'Good to go.'}</strong><span>{role === 'shop_owner' ? 'Every order, one place.' : role === 'admin' ? 'Manage PrintRelay.' : 'Your next print job is closer.'}</span></div></div>
        <button className="side-link side-signout" onClick={logout}><LogOut size={17} /><span>Sign out</span></button>
      </div>
    </aside>
    <div className="workspace-main">
      <header className="workspace-header">
        <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={19} /></button>
        <div className="header-context">{role === 'shop_owner' ? 'Operations' : role === 'admin' ? 'Platform' : 'Customer'}</div>
        <div className="header-actions">
          <Link className="header-bell icon-button" to={role === 'shop_owner' ? '/shop/notifications' : '/customer/notifications'} aria-label="Notifications"><Bell size={18} /></Link>
          <div className="profile-wrap">
            <button className="profile-trigger" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}><span className="avatar">{(user?.name || 'P').slice(0, 1).toUpperCase()}</span><span className="profile-name">{user?.name || 'Account'}</span><ChevronDown size={14} /></button>
            {menuOpen && <div className="profile-menu"><div className="profile-menu-user"><strong>{user?.name}</strong><span>{user?.email}</span></div><Link to={role === 'shop_owner' ? '/shop/profile' : role === 'admin' ? '/admin/dashboard' : '/customer/profile'} onClick={() => setMenuOpen(false)}><CircleUserRound size={15} /> Profile</Link><button onClick={logout}><LogOut size={15} /> Sign out</button></div>}
          </div>
        </div>
      </header>
      <main className="workspace-content"><Outlet /></main>
      <footer className="workspace-footer"><span>PrintRelay</span><span>Upload. Print. Collect.</span></footer>
    </div>
  </div>;
}

export function PublicHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const target = user ? homeFor(user.role) : '/login';
  return <header className="public-header"><div className="public-header-inner"><Logo />
    <nav className={`public-nav ${open ? 'public-nav--open' : ''}`}><a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a><a href="/#shops" onClick={() => setOpen(false)}>For printing shops</a><Link to={target} onClick={() => setOpen(false)}>{user ? 'Dashboard' : 'Log in'}</Link><Link className="button button--primary nav-cta" to="/customer/shops" onClick={() => setOpen(false)}>Find a shop <span>↗</span></Link></nav>
    <button className="icon-button public-menu-button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X size={20} /> : <Menu size={20} />}</button>
  </div></header>;
}

export function PublicFooter() {
  return <footer className="public-footer"><div><Logo light /><span>Documents ready when you are.</span></div><nav><a href="/#how-it-works">How it works</a><Link to="/register/shop-owner">For printing shops</Link><Link to="/login">Sign in</Link></nav><span className="footer-copy">© {new Date().getFullYear()} PrintRelay</span></footer>;
}

export function AppLink({ to, children, className = '', ...props }) {
  return <Link to={to} className={className} {...props}>{children}</Link>;
}
