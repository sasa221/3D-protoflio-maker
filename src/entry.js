import './index.css';

const path = window.location.pathname;

if (path === '/' || path === '/index.html') {
  const { renderLandingPage } = await import('./ui/LandingPage.js');
  await renderLandingPage(document.getElementById('app'));
} else {
  await import('./main.js');
}
