import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { ThirdwebProvider } from "thirdweb/react";
import { client } from "./client";
import { somniaTestnet } from 'thirdweb/chains'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
  <StrictMode>
   <ThirdwebProvider client={client} chain={somniaTestnet}>
        <App />
      </ThirdwebProvider>
  </StrictMode>
  </BrowserRouter>,
)
