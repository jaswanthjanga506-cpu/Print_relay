import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import { Loader } from './common';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export default function PdfPreview({ url, page, pageCount, onPageChange }) {
  const canvasRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let pdf;
    setLoading(true);
    setError('');
    setDocument(null);
    pdfjs.getDocument(url).promise.then((loaded) => {
      pdf = loaded;
      if (!active) { loaded.destroy(); return; }
      setDocument(loaded);
      setLoading(false);
    }).catch(() => {
      if (active) { setError('PDF preview could not be loaded. You can still continue with a valid uploaded PDF.'); setLoading(false); }
    });
    return () => { active = false; pdf?.destroy(); };
  }, [url]);

  useEffect(() => {
    let active = true;
    const render = async () => {
      if (!document || !canvasRef.current) return;
      try {
        const pdfPage = await document.getPage(Math.min(page, pageCount));
        if (!active) return;
        const viewport = pdfPage.getViewport({ scale: 1.15 });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      } catch {
        if (active) setError('This page could not be rendered.');
      }
    };
    render();
    return () => { active = false; };
  }, [document, page, pageCount]);

  return <div className="pdf-preview"><div className="preview-heading"><div><span className="eyebrow">DOCUMENT PREVIEW</span><span>{page} / {pageCount}</span></div><div><button className="icon-button" aria-label="Previous PDF page" disabled={page <= 1} onClick={() => onPageChange((value) => value - 1)}>‹</button><button className="icon-button" aria-label="Next PDF page" disabled={page >= pageCount} onClick={() => onPageChange((value) => value + 1)}>›</button></div></div>{loading ? <Loader label="Preparing PDF preview" /> : error ? <p className="field-error" role="alert">{error}</p> : <canvas ref={canvasRef} />}</div>;
}
