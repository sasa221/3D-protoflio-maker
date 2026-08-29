import './index.css';
import { applyRouteSEO } from './services/SEOService.js';

const path = window.location.pathname;
applyRouteSEO(path);

if (path === '/' || path === '/index.html') {
  const { renderLandingPage } = await import('./ui/LandingPage.js');
  await renderLandingPage(document.getElementById('app'));
} else {
  await import('./main.js');
}
