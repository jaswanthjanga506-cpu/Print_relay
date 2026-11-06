import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, FileText, Printer, Store, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/layout';
import { Logo } from '../components/common';
import '../styles/public.css';

const steps = [
  { n: '01', icon: Store, title: 'Choose a nearby shop', copy: 'See real services, prices and whether a shop is taking orders.' },
  { n: '02', icon: Upload, title: 'Send your document', copy: 'Upload a PDF and choose the pages, copies and print preferences.' },
  { n: '03', icon: Printer, title: 'Collect when it’s ready', copy: 'Follow your order through the shop’s real queue and pay at the counter.' },
];

export function LandingPage() {
  return <div className="public-shell"><PublicHeader />
    <main>
      <section className="hero">
        <div className="hero-content">
          <div className="hero-kicker"><span className="live-dot" /> PRINTING, WITHOUT THE WAIT</div>
          <h1>Place your print order <em>before</em> you reach the shop.</h1>
          <p>Choose a printing shop, upload your documents, select your printing preferences and collect your order when it is ready.</p>
          <div className="hero-actions"><Link className="button button--primary button--large" to="/customer/shops">Find a Printing Shop <ArrowRight size={17} /></Link><a className="hero-secondary" href="/#shops">For Printing Shops <ArrowDown size={15} /></a></div>
          <div className="hero-caption"><span className="caption-line" /> A clearer way to get your documents printed.</div>
        </div>
        <div className="hero-visual" aria-label="Illustration of placing a print order">
          <div className="visual-top"><span className="window-dots"><i /><i /><i /></span><span className="mono">PRINTRELAY / ORDER 01</span><span className="visual-time">LIVE QUEUE</span></div>
          <div className="workflow-card">
            <div className="workflow-heading"><div><span className="eyebrow">YOUR PRINT JOB</span><strong>Economics_notes.pdf</strong><span>PDF · 24 pages · A4</span></div><div className="file-icon"><FileText size={22} /></div></div>
            <div className="workflow-rule" />
            <div className="workflow-config"><span>BLACK &amp; WHITE <b>·</b> 2 COPIES <b>·</b> SINGLE SIDED</span><span>SPIRAL BINDING</span></div>
            <div className="workflow-bottom"><div><span className="eyebrow">ORDER STATUS</span><strong><span className="status-live" /> Printing in progress</strong></div><div className="queue-number"><span>QUEUE</span><strong>#03</strong></div></div>
          </div>
          <div className="visual-note"><span className="note-check"><Check size={14} /></span><div><strong>Know when it’s ready.</strong><span>Real updates from your shop.</span></div><ArrowUpRight size={16} /></div>
          <div className="visual-side-mark">UPLOAD / PRINT / COLLECT</div>
        </div>
        <div className="hero-footnote"><span>01 — MADE FOR EVERYDAY PRINTING</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>

      <section className="how-section" id="how-it-works"><div className="section-lead"><span className="eyebrow">A BETTER WAY TO PRINT</span><h2>Three steps.<br />One less queue.</h2><p>PrintRelay connects people who need prints with the local shops that make them happen.</p></div><div className="step-list">{steps.map(({ n, icon: Icon, title, copy }) => <article className="step-row" key={n}><span className="mono step-number">{n}</span><div className="step-icon"><Icon size={20} /></div><div className="step-copy"><h3>{title}</h3><p>{copy}</p></div><ArrowUpRight className="step-arrow" size={18} /></article>)}</div></section>

      <section className="shop-section" id="shops"><div className="shop-section-copy"><span className="eyebrow">FOR PRINTING SHOPS</span><h2>Your queue,<br /><em>in better order.</em></h2><p>Receive print requests, manage a first-in-first-out queue and let customers know when an order is ready. Your shop stays in control of every print.</p><Link className="button button--light" to="/register/shop-owner">Register your shop <ArrowRight size={16} /></Link><span className="shop-note">New shops are reviewed before appearing in discovery.</span></div><div className="shop-workflow"><span className="eyebrow">THE COUNTER VIEW</span><div className="shop-workflow-head"><strong>Today’s workflow</strong><span className="shop-open">SHOP OPERATIONS</span></div><div className="ops-stage"><span className="ops-index mono">01</span><div><strong>Review requests</strong><span>Accept or reject incoming orders</span></div><span className="ops-dash" /></div><div className="ops-stage ops-stage--active"><span className="ops-index mono">02</span><div><strong>Work the print queue</strong><span>FIFO order sequence, managed by you</span></div><span className="ops-active">ACTIVE</span></div><div className="ops-stage"><span className="ops-index mono">03</span><div><strong>Verify pickup</strong><span>Scan a QR or check the pickup code</span></div><span className="ops-dash" /></div><div className="ops-footer"><Clock3 size={15} /><span>Payments are confirmed at your counter.</span></div></div></section>

      <section className="principles"><span className="eyebrow">BUILT AROUND THE REAL WORLD</span><div><article><span className="principle-num">01</span><h3>Clear before you commit.</h3><p>See shop services and the server-calculated quote before placing an order.</p></article><article><span className="principle-num">02</span><h3>Your documents stay private.</h3><p>PDFs are stored privately and accessed only through authenticated requests.</p></article><article><span className="principle-num">03</span><h3>No guesswork in the queue.</h3><p>Track actual order status and queue position. No invented wait-time estimates.</p></article></div></section>

      <section className="faq-section"><div><span className="eyebrow">GOOD TO KNOW</span><h2>A few things,<br />made clear.</h2></div><div className="faq-list">
        <details><summary>Can I pay online? <ChevronDown size={18} /></summary><p>No. PrintRelay records your preference for cash or UPI at the shop. Payment is confirmed by the shop owner at the counter.</p></details>
        <details><summary>Does PrintRelay print or deliver my documents? <ChevronDown size={18} /></summary><p>No. The printing shop handles the physical printing. PrintRelay manages the digital order and queue, not printers or delivery.</p></details>
        <details><summary>When can I collect my order? <ChevronDown size={18} /></summary><p>Your order page updates when the shop marks it ready. Pickup is verified at the shop using your QR code or manual pickup code.</p></details>
        <details><summary>What files can I upload? <ChevronDown size={18} /></summary><p>PDF documents up to 10 MB. The server validates the actual PDF and its page count before accepting it.</p></details>
      </div></section>

      <section className="closing-cta"><div><span className="eyebrow">PRINTRELAY / YOUR NEXT PRINT JOB</span><h2>Start with the shop<br />that’s right for you.</h2></div><Link className="button button--primary button--large" to="/customer/shops">Find a Printing Shop <ArrowRight size={17} /></Link></section>
    </main>
    <PublicFooter />
  </div>;
}
