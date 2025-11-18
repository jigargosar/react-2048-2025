import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import TileSlideDemo2 from './TileSlideDemo2'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TileSlideDemo2 />
  </StrictMode>,
)
