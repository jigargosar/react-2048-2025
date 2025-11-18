import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import TileSlideDemo from './TileSlideDemo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TileSlideDemo />
  </StrictMode>,
)
