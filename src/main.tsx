import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import { TileSlideDemo3 } from './TileSlideDemo3'

const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Root element not found. Check your HTML file.')
}
createRoot(rootElement).render(
    <StrictMode>
        <TileSlideDemo3 />
    </StrictMode>,
)
