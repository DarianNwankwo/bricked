/**
 * Marketing Pages Server
 *
 * Serves 5 unique coaching solution marketing pages at /1 through /5
 */
import express from 'express';
import { page1 } from './pages/1-brutalist.js';
import { page2 } from './pages/2-organic.js';
import { page3 } from './pages/3-editorial.js';
import { page4 } from './pages/4-synthwave.js';
import { page5 } from './pages/5-bauhaus.js';
const app = express();
const PORT = process.env.MARKETING_PORT || 3333;
// Serve each unique design
app.get('/1', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(page1);
});
app.get('/2', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(page2);
});
app.get('/3', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(page3);
});
app.get('/4', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(page4);
});
app.get('/5', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(page5);
});
// Index page with links to all designs
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brick for Coaches - Marketing Designs</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Space Grotesk', sans-serif;
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p { color: #888; margin-bottom: 3rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      max-width: 1200px;
      width: 100%;
    }
    a {
      display: block;
      padding: 2rem;
      background: #111;
      border: 1px solid #222;
      border-radius: 12px;
      text-decoration: none;
      color: #fff;
      transition: all 0.3s ease;
    }
    a:hover {
      border-color: #667eea;
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(102, 126, 234, 0.2);
    }
    .num {
      font-size: 4rem;
      font-weight: 700;
      opacity: 0.3;
      margin-bottom: 1rem;
    }
    .title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
    .desc { font-size: 0.875rem; color: #666; }
  </style>
</head>
<body>
  <h1>Marketing Designs</h1>
  <p>5 unique approaches for Brick for Coaches</p>
  <div class="grid">
    <a href="/1">
      <div class="num">01</div>
      <div class="title">Brutalist Black</div>
      <div class="desc">Raw power, stark contrasts, industrial typography</div>
    </a>
    <a href="/2">
      <div class="num">02</div>
      <div class="title">Organic Flow</div>
      <div class="desc">Ethereal gradients, flowing forms, nature-inspired</div>
    </a>
    <a href="/3">
      <div class="num">03</div>
      <div class="title">Editorial Luxury</div>
      <div class="desc">Magazine sophistication, refined serif typography</div>
    </a>
    <a href="/4">
      <div class="num">04</div>
      <div class="title">Neon Synthwave</div>
      <div class="desc">80s retro-futurism, neon grids, CRT aesthetics</div>
    </a>
    <a href="/5">
      <div class="num">05</div>
      <div class="title">Geometric Bauhaus</div>
      <div class="desc">Primary colors, bold shapes, modernist playfulness</div>
    </a>
  </div>
</body>
</html>
  `);
});
export function startMarketingServer() {
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🎨 Marketing Pages Server                       ║
║                                                   ║
║   Running on: http://localhost:${PORT}              ║
║                                                   ║
║   Designs:                                        ║
║   • /1 - Brutalist Black                          ║
║   • /2 - Organic Flow                             ║
║   • /3 - Editorial Luxury                         ║
║   • /4 - Neon Synthwave                           ║
║   • /5 - Geometric Bauhaus                        ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);
    });
}
// Run if executed directly
if (process.argv[1]?.includes('marketing')) {
    startMarketingServer();
}
//# sourceMappingURL=server.js.map