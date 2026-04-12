import {useState, useEffect} from 'react'


function App() {
  const [apiStatus, setAPIStatus] = useState()

  useEffect(() => {
    fetch('http://localhost:3000/up')
    .then(res => res.json())
    .then(result => {
      console.log(result.status)
      setAPIStatus(result)
  })
  }, [])

  
  return (
    <div>
    <h1>To get started, begin editing SRC/App.js</h1>
    {apiStatus ? <h2>Testing app end point: <div style={{color: apiStatus.status === 'up' ? 'green':'red'}}>{apiStatus.status}</div></h2>:null }
    </div>
  )
   
}

export default App;
