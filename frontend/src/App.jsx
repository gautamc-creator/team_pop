import { useEffect, useMemo, useState } from 'react'
import './App.css'
import AvatarWidget from './components/AvatarWidget'
import { api } from './services/api'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'



function App() {
  const [step, setStep] = useState('input')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [count, setCount] = useState(0)
  const [crawlError, setCrawlError] = useState('')
  const [showDocs, setShowDocs] = useState(false)

  const normalizedDomain = useMemo(() => {
    try {
      const parsed = new URL(url)
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/^www\./, '')
    }
  }, [url])

  const widgetScript = useMemo(() => {
    const scriptSrc = 'http://localhost:5173/widget.js'
    return `<script src="${scriptSrc}" data-domain="${normalizedDomain}" data-api="${API_BASE_URL}"></script>`
  }, [normalizedDomain])

  const isUrlValid = useMemo(() => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }, [url])

  const startCrawl = async () => {
    setCrawlError('')
    setStatus('running')
    try {
      await api.startCrawl(url)
      setStep('crawl')
    } catch {
      setStatus('failed')
      setCrawlError('Failed to start crawl')
    }
  }

  useEffect(() => {
    if (step !== 'crawl') return

    const pollStatus = async () => {
      try {
        const nextStatus = await api.getCrawlStatus(url)
        if (nextStatus.status) {
          setStatus(nextStatus.status)
          if (nextStatus.status === 'failed') {
            setCrawlError(nextStatus.error || 'Crawl failed')
          } else if (nextStatus.status === 'completed') {
            setStep('success')
          }
        }
      } catch {
        // ignore poll errors
      }
    }
  
    const pollCount = async () => {
      try {
        const data = await api.getCrawlCount(url)
        if (typeof data.count === 'number') setCount(data.count)
      } catch {
        // ignore count errors
      }
    }

    const interval = setInterval(() => {
      pollStatus()
      pollCount()
    }, 2000)
    return () => clearInterval(interval)
  }, [step, url])



  return (
    <div className="app-container">
      {step === 'input' && (
        <div className="card">
          <div className="stepper">
            <div className="step active"><span className="step-dot"></span>Step 1</div>
            <div className="step"><span className="step-dot"></span>Step 2</div>
            <div className="step"><span className="step-dot"></span>Step 3</div>
          </div>
          <h2>Train your AI on any website</h2>
          <div className="card-subtitle">Paste a URL and we will build a private index for your assistant.</div>
          <div className="input-row">
            <input
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className="btn" onClick={startCrawl} disabled={!isUrlValid}>
              Continue
            </button>
          </div>
          {!isUrlValid && url ? <p className="error-text">Please enter a valid URL.</p> : null}
        </div>
      )}

      {step === 'crawl' && (
        <div className="card">
          <div className="stepper">
            <div className="step"><span className="step-dot"></span>Step 1</div>
            <div className="step active"><span className="step-dot"></span>Step 2</div>
            <div className="step"><span className="step-dot"></span>Step 3</div>
          </div>
          <h2>Indexing your website</h2>
          <div className="card-subtitle">We are crawling your domain and preparing your assistant.</div>
          <div className="info-grid">
            <div className="info-tile">
              <div className="info-label">Domain</div>
              <div className="info-value">{normalizedDomain || '—'}</div>
            </div>
            <div className="info-tile">
              <div className="info-label">Pages indexed</div>
              <div className="info-value">{count}</div>
            </div>
            <div className="info-tile">
              <div className="info-label">Status</div>
              <div className={`status-chip ${status}`}>{status}</div>
            </div>
          </div>
          {crawlError ? <p className="error-text">{crawlError}</p> : null}
          <div className="button-row">
            <button className="btn btn-secondary" onClick={startCrawl}>
              Crawl Again
            </button>
            <button className="btn" onClick={() => setStep('success')} disabled={status !== 'completed'}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="card">
          <div className="stepper">
            <div className="step"><span className="step-dot"></span>Step 1</div>
            <div className="step"><span className="step-dot"></span>Step 2</div>
            <div className="step active"><span className="step-dot"></span>Step 3</div>
          </div>
          <h2>Your assistant is live</h2>
          <div className="card-subtitle">Embed it on your site with this one-line script.</div>
          <div className="success-layout">
            <div>
              <AvatarWidget domain={url} preview />
            </div>
            <div className="embed-box">
              <div className="info-label">Embed snippet</div>
              <div className="code-snippet">
                {widgetScript}
              </div>
              <div className="button-row">
                <button className="btn" onClick={() => navigator.clipboard.writeText(widgetScript)}>
                  Copy snippet
                </button>
                <button className="btn btn-secondary" onClick={() => setShowDocs(true)}>
                  View documentation
                </button>
              </div>
              <div className="card-subtitle">Paste this in &lt;head&gt; or just before &lt;/body&gt;.</div>
            </div>
          </div>
        </div>
      )}

      {showDocs && (
        <div className="doc-modal" onClick={() => setShowDocs(false)}>
          <div className="doc-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Configuration Guide</h3>
            <p>1. Add the script tag to your website HTML.</p>
            <p>2. Ensure the domain and API URL are correct.</p>
            <p>3. If you use HTTPS, your API must also be HTTPS.</p>
            <ul>
              <li>Common issue: CORS misconfiguration on your API.</li>
              <li>Common issue: Mixed content (HTTPS site calling HTTP API).</li>
            </ul>
            <div className="code-snippet">{widgetScript}</div>
            <div className="button-row">
              <button className="btn" onClick={() => setShowDocs(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
