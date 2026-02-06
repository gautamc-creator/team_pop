
import { useState } from 'react'
import './App.css'
import AvatarWidget from './components/AvatarWidget'

function App() {
  
  const [url,setUrl] = useState('')
  const [crawling,setCrawling] = useState(false)
  const [ready,setReady] = useState(false)

  const startCrawl = async () => {
    setCrawling(true)
    await fetch('http://localhost:8000/crawl',{
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify({url})
    })

    setTimeout(() => {
      setCrawling(false)
      setReady(true)
    },5000)
  }



  return (
    <div className="app-container">
      {!ready ? (
        <div className="setup-box">
          <h2>Enter Website to have your AI in seconds ...</h2>
          <input 
            type="text" 
            placeholder="https://example.com" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
          />
          <button onClick={startCrawl} disabled={crawling}>
            {crawling ? "Crawling..." : "Start Training"}
          </button>
        </div>
      ) : (
        // Pass the URL/Domain to the widget so it knows which index to query
        <AvatarWidget domain={url} /> 
      )}
    </div>
  )
}


export default App
