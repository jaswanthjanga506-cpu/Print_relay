import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Loader } from './components/common';
import { ProtectedLayout } from './components/layout';
import { useAuth } from './context/AuthContext';
import { socketUrl } from './services/api';

const AuthPage = lazy(() => import('./pages/auth').then((module) => ({ default: module.AuthPage })));
const LandingPage = lazy(() => import('./pages/public').then((module) => ({ default: module.LandingPage })));
const customerPage = (name) => lazy(() => import('./pages/customer').then((module) => ({ default: module[name] })));
const shopPage = (name) => lazy(() => import('./pages/shop').then((module) => ({ default: module[name] })));
const adminPage = (name) => lazy(() => import('./pages/admin').then((module) => ({ default: module[name] })));
const CustomerDashboard = customerPage('CustomerDashboard');
const ShopDiscovery = customerPage('ShopDiscovery');
const ShopDetails = customerPage('ShopDetails');
const NewOrder = customerPage('NewOrder');
const CustomerOrders = customerPage('CustomerOrders');
const CustomerOrderDetails = customerPage('CustomerOrderDetails');
const CustomerProfile = customerPage('CustomerProfile');
const NotificationsPage = customerPage('NotificationsPage');
const ShopDashboard = shopPage('ShopDashboard');
const ShopOrders = shopPage('ShopOrders');
const ShopOrderDetails = shopPage('ShopOrderDetails');
const ShopSettings = shopPage('ShopSettings');
const ShopProfile = shopPage('ShopProfile');
const ShopNotifications = shopPage('ShopNotifications');
const AdminDashboard = adminPage('AdminDashboard');
const AdminShops = adminPage('AdminShops');
const AdminUsers = adminPage('AdminUsers');
const AdminOrders = adminPage('AdminOrders');

function HomeRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="full-loader"><Loader label="Starting PrintRelay" /></div>;
  if (!user) return <LandingPage />;
  return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : user.role === 'shop_owner' ? '/shop/dashboard' : '/customer/dashboard'} replace />;
}

function MissingPage() {
  return <main className="missing-page"><span className="eyebrow">404 / NOT FOUND</span><h1>This page isn’t here.</h1><p>The link may have changed, or the page may not exist.</p><a className="button button--primary" href="/">Return to PrintRelay</a></main>;
}

function RealtimeBridge() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return undefined;
    const socket = io(socketUrl, { withCredentials: true, reconnection: true, reconnectionAttempts: Infinity });
    const refresh = (event, detail) => window.dispatchEvent(new CustomEvent('printrelay:refresh', { detail: { event, payload: detail } }));
    socket.on('connect', () => refresh('connect'));
    socket.on('notification', (data) => refresh('notification', data));
    socket.on('order:updated', (data) => refresh('order:updated', data));
    return () => { socket.disconnect(); };
  }, [user?.id]);
  return null;
}

export default function App() {
  return <><RealtimeBridge /><Suspense fallback={<div className="full-loader"><Loader label="Loading PrintRelay" /></div>}><Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage />} />
    <Route path="/register/:mode" element={<AuthPage />} />
    <Route path="/customer" element={<ProtectedLayout role="customer" />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<CustomerDashboard />} />
      <Route path="shops" element={<ShopDiscovery />} />
      <Route path="shops/:shopId" element={<ShopDetails />} />
      <Route path="orders/new/:shopId" element={<NewOrder />} />
      <Route path="orders" element={<CustomerOrders />} />
      <Route path="orders/:orderId" element={<CustomerOrderDetails />} />
      <Route path="profile" element={<CustomerProfile />} />
      <Route path="notifications" element={<NotificationsPage />} />
    </Route>
    <Route path="/shop" element={<ProtectedLayout role="shop_owner" />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<ShopDashboard />} />
      <Route path="requests" element={<ShopOrders />} />
      <Route path="queue" element={<ShopOrders />} />
      <Route path="ready" element={<ShopOrders />} />
      <Route path="history" element={<ShopOrders />} />
      <Route path="orders/:orderId" element={<ShopOrderDetails />} />
      <Route path="settings" element={<ShopSettings />} />
      <Route path="profile" element={<ShopProfile />} />
      <Route path="notifications" element={<ShopNotifications />} />
    </Route>
    <Route path="/admin" element={<ProtectedLayout role="admin" />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="shops" element={<AdminShops />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="orders" element={<AdminOrders />} />
    </Route>
    <Route path="*" element={<MissingPage />} />
  </Routes></Suspense></>;
}
