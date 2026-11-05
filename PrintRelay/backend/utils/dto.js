const id = (v) => (v ? String(v._id ?? v) : undefined);

export const userDTO = (u) => ({
  id: id(u), name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, createdAt: u.createdAt,
});

const shopBase = (s) => ({
  id: id(s),
  name: s.name,
  address: s.address,
  phone: s.phone,
  email: s.email,
  hours: s.hours,
  isOpen: s.isOpen,
  acceptingOrders: s.acceptingOrders,
  services: s.services,
  pricing: s.pricing,
});

export const publicShopDTO = (s, activeQueue) => ({
  ...shopBase(s),
  ...(activeQueue !== undefined ? { activeQueue } : {}),
});

export const ownerShopDTO = (s) => ({
  ...shopBase(s),
  approvalStatus: s.approvalStatus,
  approvalNote: s.approvalNote,
  reviewedAt: s.reviewedAt,
  createdAt: s.createdAt,
});

export const adminShopDTO = (s) => ({
  ...ownerShopDTO(s),
  owner: s.owner && s.owner.name ? { id: id(s.owner), name: s.owner.name, email: s.owner.email, phone: s.owner.phone } : id(s.owner),
});

export function orderDTO(o, viewerRole = 'customer') {
  const shop = o.shop && o.shop.name ? { id: id(o.shop), name: o.shop.name, address: o.shop.address, phone: o.shop.phone } : { id: id(o.shop) };
  const dto = {
    id: id(o),
    orderNumber: o.orderNumber,
    status: o.status,
    shop,
    file: { id: id(o.file.fileId), filename: o.file.filename, size: o.file.size, pageCount: o.file.pageCount },
    config: o.config,
    pricing: o.pricing,
    totalPaise: o.totalPaise,
    paymentPreference: o.paymentPreference,
    paymentStatus: o.paymentStatus,
    payment: o.payment ? { confirmedAt: o.payment.confirmedAt, upiReference: o.payment.upiReference } : undefined,
    acceptedAt: o.acceptedAt,
    queueSequence: o.queueSequence,
    printingStartedAt: o.printingStartedAt,
    readyAt: o.readyAt,
    collectedAt: o.collectedAt,
    rejectionReason: o.rejectionReason,
    cancellationReason: o.cancellationReason,
    cancelledByRole: o.cancelledByRole,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
  if (viewerRole !== 'customer' && o.customer) {
    dto.customer = o.customer.name ? { id: id(o.customer), name: o.customer.name, phone: o.customer.phone } : { id: id(o.customer) };
  }
  return dto;
}

export const eventDTO = (e) => ({
  id: id(e), from: e.previousStatus, to: e.newStatus, note: e.note, byRole: e.updatedByRole, at: e.createdAt,
});

export const notificationDTO = (n) => ({
  id: id(n), type: n.type, title: n.title, message: n.message, read: n.read,
  orderId: id(n.order), shopId: id(n.shop), createdAt: n.createdAt,
});
