/**
 * Design 4: Neon Synthwave
 *
 * Aesthetic: 80s retro-futurism, neon grids, CRT aesthetics
 * Typography: Orbitron (futuristic) + Share Tech Mono (terminal)
 * Colors: Hot pink, electric cyan, deep purple, chrome
 * Vibe: Energetic, futuristic, cutting-edge tech for coaches
 */
export const page4 = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BRICK // FUTURE OF COACHING</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    :root {
      --neon-pink: #ff2a6d;
      --neon-cyan: #05d9e8;
      --neon-purple: #9d4edd;
      --dark-purple: #120458;
      --darker: #0d0221;
      --chrome: #d1f7ff;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: 'Share Tech Mono', monospace;
      background: var(--darker);
      color: var(--chrome);
      overflow-x: hidden;
    }

    /* CRT scanlines */
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.1) 0px,
        rgba(0, 0, 0, 0.1) 1px,
        transparent 1px,
        transparent 2px
      );
      pointer-events: none;
      z-index: 9998;
    }

    /* Screen flicker */
    body::after {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(18, 4, 88, 0.03);
      animation: flicker 0.15s infinite;
      pointer-events: none;
      z-index: 9997;
    }

    @keyframes flicker {
      0% { opacity: 0.97; }
      50% { opacity: 1; }
      100% { opacity: 0.98; }
    }

    /* Grid background */
    .grid-bg {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 50vh;
      background:
        linear-gradient(90deg, var(--neon-pink) 1px, transparent 1px) 0 0 / 80px 80px,
        linear-gradient(var(--neon-pink) 1px, transparent 1px) 0 0 / 80px 80px;
      transform: perspective(500px) rotateX(60deg);
      transform-origin: bottom;
      opacity: 0.15;
      animation: gridScroll 20s linear infinite;
      z-index: -1;
    }

    @keyframes gridScroll {
      0% { background-position: 0 0, 0 0; }
      100% { background-position: 0 80px, 0 80px; }
    }

    /* Sun */
    .sun {
      position: fixed;
      bottom: 25vh;
      left: 50%;
      transform: translateX(-50%);
      width: 300px;
      height: 150px;
      background: linear-gradient(180deg, var(--neon-pink) 0%, var(--neon-purple) 50%, transparent 100%);
      border-radius: 150px 150px 0 0;
      z-index: -2;
      opacity: 0.4;
    }

    .sun::before {
      content: '';
      position: absolute;
      top: 20%;
      left: 10%;
      right: 10%;
      height: 5px;
      background: var(--darker);
    }

    .sun::after {
      content: '';
      position: absolute;
      top: 40%;
      left: 15%;
      right: 15%;
      height: 8px;
      background: var(--darker);
    }

    .nav {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: 1.5rem 3rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
      border-bottom: 1px solid rgba(5, 217, 232, 0.2);
      background: rgba(13, 2, 33, 0.9);
      backdrop-filter: blur(10px);
    }

    .logo {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.5rem;
      font-weight: 900;
      color: var(--neon-cyan);
      text-shadow: 0 0 10px var(--neon-cyan), 0 0 20px var(--neon-cyan);
      letter-spacing: 0.2em;
    }

    .nav-links {
      display: flex;
      gap: 2rem;
    }

    .nav-links a {
      color: var(--chrome);
      text-decoration: none;
      font-size: 0.85rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      transition: all 0.3s ease;
      position: relative;
    }

    .nav-links a:hover {
      color: var(--neon-pink);
      text-shadow: 0 0 10px var(--neon-pink);
    }

    .nav-cta {
      padding: 0.75rem 1.5rem;
      background: transparent;
      border: 2px solid var(--neon-cyan);
      color: var(--neon-cyan);
      text-decoration: none;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      transition: all 0.3s ease;
    }

    .nav-cta:hover {
      background: var(--neon-cyan);
      color: var(--darker);
      box-shadow: 0 0 30px var(--neon-cyan);
    }

    .hero {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 6rem 2rem;
      position: relative;
    }

    .hero-badge {
      display: inline-block;
      padding: 0.5rem 1.5rem;
      border: 1px solid var(--neon-pink);
      color: var(--neon-pink);
      font-size: 0.75rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-bottom: 2rem;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 5px var(--neon-pink); }
      50% { box-shadow: 0 0 20px var(--neon-pink); }
    }

    .hero h1 {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(3rem, 10vw, 8rem);
      font-weight: 900;
      line-height: 1;
      margin-bottom: 1rem;
      text-transform: uppercase;
      background: linear-gradient(180deg, var(--chrome) 0%, var(--neon-cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: none;
      filter: drop-shadow(0 0 30px rgba(5, 217, 232, 0.5));
    }

    .hero-sub {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      font-weight: 400;
      color: var(--neon-pink);
      text-shadow: 0 0 20px var(--neon-pink);
      margin-bottom: 2rem;
    }

    .hero-text {
      font-size: 1rem;
      max-width: 600px;
      color: rgba(209, 247, 255, 0.7);
      line-height: 1.8;
      margin-bottom: 3rem;
    }

    .hero-cta {
      display: flex;
      gap: 1.5rem;
    }

    .btn-primary {
      display: inline-block;
      padding: 1.25rem 3rem;
      background: linear-gradient(90deg, var(--neon-pink), var(--neon-purple));
      color: white;
      text-decoration: none;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      transition: all 0.3s ease;
      clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
    }

    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 40px rgba(255, 42, 109, 0.5);
    }

    .btn-secondary {
      display: inline-block;
      padding: 1.25rem 3rem;
      background: transparent;
      border: 2px solid var(--neon-cyan);
      color: var(--neon-cyan);
      text-decoration: none;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      transition: all 0.3s ease;
      clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
    }

    .btn-secondary:hover {
      background: rgba(5, 217, 232, 0.1);
      box-shadow: 0 0 30px rgba(5, 217, 232, 0.3);
    }

    .section {
      padding: 8rem 3rem;
      position: relative;
      z-index: 1;
    }

    .section-header {
      text-align: center;
      margin-bottom: 5rem;
    }

    .section-label {
      display: inline-block;
      padding: 0.5rem 1rem;
      border: 1px solid var(--neon-cyan);
      color: var(--neon-cyan);
      font-size: 0.7rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-bottom: 1.5rem;
    }

    .section-title {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 700;
      text-transform: uppercase;
      background: linear-gradient(90deg, var(--neon-pink), var(--neon-cyan));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .feature-card {
      background: rgba(18, 4, 88, 0.6);
      border: 1px solid rgba(5, 217, 232, 0.3);
      padding: 2.5rem;
      position: relative;
      transition: all 0.4s ease;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, var(--neon-pink), var(--neon-cyan));
      transform: scaleX(0);
      transition: transform 0.4s ease;
    }

    .feature-card:hover::before {
      transform: scaleX(1);
    }

    .feature-card:hover {
      border-color: var(--neon-cyan);
      box-shadow: 0 0 30px rgba(5, 217, 232, 0.2);
      transform: translateY(-5px);
    }

    .feature-icon {
      font-size: 2.5rem;
      margin-bottom: 1.5rem;
    }

    .feature-card h3 {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--neon-cyan);
      margin-bottom: 1rem;
      text-transform: uppercase;
    }

    .feature-card p {
      font-size: 0.9rem;
      color: rgba(209, 247, 255, 0.7);
      line-height: 1.7;
    }

    .stats-section {
      background: linear-gradient(180deg, rgba(18, 4, 88, 0.8), rgba(13, 2, 33, 0.9));
      padding: 6rem 3rem;
      position: relative;
      overflow: hidden;
    }

    .stats-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--neon-pink), transparent);
    }

    .stats-section::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3rem;
      max-width: 1000px;
      margin: 0 auto;
      text-align: center;
    }

    .stat-number {
      font-family: 'Orbitron', sans-serif;
      font-size: 3.5rem;
      font-weight: 900;
      background: linear-gradient(180deg, var(--neon-cyan), var(--neon-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }

    .stat-label {
      font-size: 0.8rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(209, 247, 255, 0.6);
    }

    .cta-section {
      padding: 10rem 3rem;
      text-align: center;
      position: relative;
    }

    .cta-section::before {
      content: 'LAUNCH';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'Orbitron', sans-serif;
      font-size: 20vw;
      font-weight: 900;
      color: rgba(5, 217, 232, 0.03);
      pointer-events: none;
      white-space: nowrap;
    }

    .cta-title {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(2rem, 5vw, 4rem);
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 1.5rem;
      color: var(--chrome);
    }

    .cta-title span {
      color: var(--neon-pink);
      text-shadow: 0 0 20px var(--neon-pink);
    }

    .cta-text {
      font-size: 1.1rem;
      color: rgba(209, 247, 255, 0.7);
      max-width: 500px;
      margin: 0 auto 3rem;
    }

    .footer {
      padding: 2rem 3rem;
      border-top: 1px solid rgba(5, 217, 232, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-logo {
      font-family: 'Orbitron', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: var(--neon-cyan);
    }

    .footer-links {
      display: flex;
      gap: 2rem;
    }

    .footer-links a {
      color: rgba(209, 247, 255, 0.5);
      text-decoration: none;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
      transition: color 0.3s ease;
    }

    .footer-links a:hover {
      color: var(--neon-pink);
    }

    @media (max-width: 768px) {
      .features-grid { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .nav-links { display: none; }
      .hero-cta { flex-direction: column; align-items: center; }
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="sun"></div>

  <nav class="nav">
    <div class="logo">BRICK</div>
    <div class="nav-links">
      <a href="#features">MODULES</a>
      <a href="#stats">METRICS</a>
      <a href="#launch">LAUNCH</a>
    </div>
    <a href="#launch" class="nav-cta">INITIALIZE</a>
  </nav>

  <section class="hero">
    <div class="hero-badge">// SYSTEM ONLINE</div>
    <h1>BRICK</h1>
    <p class="hero-sub">FOR COACHES</p>
    <p class="hero-text">
      THE NEXT GENERATION COACHING PLATFORM. BUILT FOR SPEED. DESIGNED FOR IMPACT. ENGINEERED FOR THE FUTURE.
    </p>
    <div class="hero-cta">
      <a href="#launch" class="btn-primary">INITIALIZE SYSTEM →</a>
      <a href="#features" class="btn-secondary">EXPLORE MODULES</a>
    </div>
  </section>

  <section id="features" class="section">
    <div class="section-header">
      <div class="section-label">// CORE MODULES</div>
      <h2 class="section-title">SYSTEM CAPABILITIES</h2>
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">⬡</div>
        <h3>CLIENT_MATRIX</h3>
        <p>Advanced client relationship tracking. Full profile analysis. Real-time status monitoring.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">◈</div>
        <h3>CHRONO_SYNC</h3>
        <p>Calendly & Cal.com integration. Automated scheduling. Zero conflicts.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">◇</div>
        <h3>DATA_VAULT</h3>
        <p>Encrypted session notes. Infinite storage. Instant recall.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">△</div>
        <h3>REVENUE_CORE</h3>
        <p>Transaction processing. Package management. Financial analytics.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">○</div>
        <h3>CRM_BRIDGE</h3>
        <p>Twenty CRM sync. Bidirectional data flow. Always current.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">□</div>
        <h3>INSIGHTS_AI</h3>
        <p>Pattern recognition. Progress tracking. Predictive analytics.</p>
      </div>
    </div>
  </section>

  <section id="stats" class="stats-section">
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-number">10X</div>
        <div class="stat-label">EFFICIENCY BOOST</div>
      </div>
      <div class="stat">
        <div class="stat-number">99.9%</div>
        <div class="stat-label">UPTIME</div>
      </div>
      <div class="stat">
        <div class="stat-number">&lt;50MS</div>
        <div class="stat-label">RESPONSE TIME</div>
      </div>
      <div class="stat">
        <div class="stat-number">∞</div>
        <div class="stat-label">SCALABILITY</div>
      </div>
    </div>
  </section>

  <section id="launch" class="cta-section">
    <h2 class="cta-title">READY TO <span>LAUNCH?</span></h2>
    <p class="cta-text">
      Join the coaches who've upgraded to the future. Initialize your system today.
    </p>
    <a href="#" class="btn-primary">BEGIN SEQUENCE →</a>
  </section>

  <footer class="footer">
    <div class="footer-logo">BRICK.SYS</div>
    <div class="footer-links">
      <a href="#">PROTOCOL</a>
      <a href="#">SECURITY</a>
      <a href="#">SUPPORT</a>
    </div>
  </footer>

  <script>
    // Glitch effect on hover
    document.querySelectorAll('.feature-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.animation = 'glitch 0.3s ease';
        setTimeout(() => card.style.animation = '', 300);
      });
    });

    // Parallax on mouse move
    document.addEventListener('mousemove', (e) => {
      const sun = document.querySelector('.sun');
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 15;
      sun.style.transform = \`translateX(calc(-50% + \${x}px)) translateY(\${y}px)\`;
    });

    // Intersection observer for reveals
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card, .stat').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = \`all 0.6s ease \${i * 0.1}s\`;
      observer.observe(el);
    });
  </script>
</body>
</html>
`;
//# sourceMappingURL=4-synthwave.js.map