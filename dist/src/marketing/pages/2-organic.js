/**
 * Design 2 v2: Japandi Zen
 *
 * Aesthetic: Japanese minimalism meets Scandinavian warmth
 * Typography: Noto Serif JP + Inter (clean, balanced)
 * Colors: Warm sand, charcoal ink, muted moss, paper white
 * Vibe: Calm, intentional, refined simplicity, mindful coaching
 */
export const page2 = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brick — Mindful Practice Management</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;500;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --sand: #e8e2d9;
      --paper: #faf9f7;
      --ink: #2c2c2c;
      --moss: #7a8b6e;
      --clay: #b8a898;
      --stone: #9a9590;
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
      font-family: 'Inter', sans-serif;
      background: var(--paper);
      color: var(--ink);
      font-weight: 400;
      line-height: 1.7;
      font-size: 16px;
    }

    ::selection {
      background: var(--moss);
      color: var(--paper);
    }

    .nav {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: 2rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
      background: rgba(250, 249, 247, 0.95);
      backdrop-filter: blur(10px);
    }

    .logo {
      font-family: 'Noto Serif JP', serif;
      font-size: 1.5rem;
      font-weight: 500;
      letter-spacing: 0.1em;
    }

    .nav-links {
      display: flex;
      gap: 3rem;
    }

    .nav-links a {
      color: var(--stone);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      transition: color 0.3s ease;
    }

    .nav-links a:hover {
      color: var(--ink);
    }

    .nav-cta {
      padding: 0.75rem 1.5rem;
      background: var(--ink);
      color: var(--paper);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      transition: all 0.3s ease;
    }

    .nav-cta:hover {
      background: var(--moss);
    }

    .hero {
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding: 8rem 4rem 4rem;
      position: relative;
    }

    .hero-content {
      max-width: 600px;
    }

    .hero-jp {
      font-family: 'Noto Serif JP', serif;
      font-size: 0.9rem;
      font-weight: 300;
      color: var(--stone);
      letter-spacing: 0.3em;
      margin-bottom: 2rem;
    }

    .hero h1 {
      font-family: 'Noto Serif JP', serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 400;
      line-height: 1.3;
      margin-bottom: 2rem;
      letter-spacing: -0.01em;
    }

    .hero-text {
      font-size: 1.1rem;
      color: var(--stone);
      max-width: 450px;
      margin-bottom: 3rem;
      font-weight: 400;
    }

    .hero-cta {
      display: flex;
      gap: 2rem;
      align-items: center;
    }

    .btn-primary {
      display: inline-block;
      padding: 1rem 2.5rem;
      background: var(--ink);
      color: var(--paper);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      transition: all 0.4s ease;
    }

    .btn-primary:hover {
      background: var(--moss);
      transform: translateY(-2px);
    }

    .btn-text {
      color: var(--ink);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: gap 0.3s ease;
    }

    .btn-text:hover {
      gap: 1.25rem;
    }

    .btn-text span:last-child {
      font-size: 1.25rem;
    }

    .hero-visual {
      position: absolute;
      right: 8%;
      top: 50%;
      transform: translateY(-50%);
      width: 45%;
      max-width: 500px;
    }

    .zen-circle {
      width: 100%;
      aspect-ratio: 1;
      position: relative;
    }

    .zen-circle svg {
      width: 100%;
      height: 100%;
    }

    .zen-circle .enso {
      fill: none;
      stroke: var(--ink);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
      animation: drawEnso 3s ease-out forwards;
    }

    @keyframes drawEnso {
      to { stroke-dashoffset: 0; }
    }

    .zen-stat {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }

    .zen-stat-number {
      font-family: 'Noto Serif JP', serif;
      font-size: 4rem;
      font-weight: 300;
      line-height: 1;
      margin-bottom: 0.5rem;
    }

    .zen-stat-label {
      font-size: 0.8rem;
      color: var(--stone);
      letter-spacing: 0.1em;
    }

    .section {
      padding: 8rem 4rem;
    }

    .section-header {
      max-width: 500px;
      margin-bottom: 5rem;
    }

    .section-jp {
      font-family: 'Noto Serif JP', serif;
      font-size: 0.85rem;
      font-weight: 300;
      color: var(--moss);
      letter-spacing: 0.2em;
      margin-bottom: 1rem;
    }

    .section-title {
      font-family: 'Noto Serif JP', serif;
      font-size: clamp(1.75rem, 3vw, 2.5rem);
      font-weight: 400;
      line-height: 1.4;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: var(--sand);
    }

    .feature {
      background: var(--paper);
      padding: 3rem;
      transition: all 0.4s ease;
    }

    .feature:hover {
      background: var(--sand);
    }

    .feature-icon {
      width: 48px;
      height: 48px;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .feature-icon svg {
      width: 100%;
      height: 100%;
      stroke: var(--moss);
      stroke-width: 1.5;
      fill: none;
    }

    .feature h3 {
      font-family: 'Noto Serif JP', serif;
      font-size: 1.25rem;
      font-weight: 500;
      margin-bottom: 1rem;
    }

    .feature p {
      font-size: 0.95rem;
      color: var(--stone);
      line-height: 1.7;
    }

    .philosophy-section {
      background: var(--sand);
      padding: 8rem 4rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6rem;
      align-items: center;
    }

    .philosophy-content .section-jp {
      margin-bottom: 1.5rem;
    }

    .philosophy-quote {
      font-family: 'Noto Serif JP', serif;
      font-size: clamp(1.5rem, 2.5vw, 2rem);
      font-weight: 300;
      line-height: 1.6;
      margin-bottom: 2rem;
      font-style: italic;
    }

    .philosophy-author {
      font-size: 0.9rem;
      color: var(--stone);
    }

    .philosophy-visual {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .stat-card {
      background: var(--paper);
      padding: 2.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stat-card-label {
      font-size: 0.9rem;
      color: var(--stone);
    }

    .stat-card-value {
      font-family: 'Noto Serif JP', serif;
      font-size: 2.5rem;
      font-weight: 300;
    }

    .testimonial-section {
      padding: 8rem 4rem;
      text-align: center;
    }

    .testimonial-content {
      max-width: 700px;
      margin: 0 auto;
    }

    .testimonial-quote {
      font-family: 'Noto Serif JP', serif;
      font-size: clamp(1.5rem, 2.5vw, 2rem);
      font-weight: 400;
      line-height: 1.6;
      margin-bottom: 3rem;
    }

    .testimonial-author {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
    }

    .author-avatar {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, var(--moss), var(--clay));
      border-radius: 50%;
    }

    .author-info {
      text-align: left;
    }

    .author-name {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    .author-role {
      font-size: 0.85rem;
      color: var(--stone);
    }

    .cta-section {
      background: var(--ink);
      color: var(--paper);
      padding: 8rem 4rem;
      text-align: center;
    }

    .cta-jp {
      font-family: 'Noto Serif JP', serif;
      font-size: 1rem;
      font-weight: 300;
      letter-spacing: 0.3em;
      opacity: 0.6;
      margin-bottom: 2rem;
    }

    .cta-title {
      font-family: 'Noto Serif JP', serif;
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 400;
      margin-bottom: 1.5rem;
      line-height: 1.3;
    }

    .cta-text {
      font-size: 1.1rem;
      opacity: 0.7;
      max-width: 450px;
      margin: 0 auto 3rem;
    }

    .cta-btn {
      display: inline-block;
      padding: 1.25rem 3rem;
      background: var(--paper);
      color: var(--ink);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      transition: all 0.4s ease;
    }

    .cta-btn:hover {
      background: var(--moss);
      color: var(--paper);
      transform: translateY(-2px);
    }

    .footer {
      padding: 3rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--sand);
    }

    .footer-logo {
      font-family: 'Noto Serif JP', serif;
      font-size: 1.25rem;
      font-weight: 500;
    }

    .footer-links {
      display: flex;
      gap: 2.5rem;
    }

    .footer-links a {
      color: var(--stone);
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.3s ease;
    }

    .footer-links a:hover {
      color: var(--ink);
    }

    .footer-copy {
      font-size: 0.8rem;
      color: var(--stone);
    }

    @media (max-width: 1024px) {
      .hero-visual { display: none; }
      .philosophy-section { grid-template-columns: 1fr; }
      .features-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      .nav { padding: 1.5rem; }
      .nav-links { display: none; }
      .hero { padding: 6rem 1.5rem 3rem; }
      .section { padding: 4rem 1.5rem; }
      .footer { flex-direction: column; gap: 2rem; text-align: center; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="logo">Brick</div>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#philosophy">Philosophy</a>
      <a href="#start">Begin</a>
    </div>
    <a href="#start" class="nav-cta">Get Started</a>
  </nav>

  <section class="hero">
    <div class="hero-content">
      <p class="hero-jp">コーチングの本質</p>
      <h1>A place for coaches who value simplicity</h1>
      <p class="hero-text">
        Strip away the noise. Focus on what matters. Brick brings calm to the chaos of running a coaching practice.
      </p>
      <div class="hero-cta">
        <a href="#start" class="btn-primary">Begin Your Journey</a>
        <a href="#features" class="btn-text">
          <span>Explore</span>
          <span>→</span>
        </a>
      </div>
    </div>
    <div class="hero-visual">
      <div class="zen-circle">
        <svg viewBox="0 0 200 200">
          <path class="enso" d="M100,20
            C145,20 175,50 180,95
            C185,140 160,175 115,185
            C70,195 30,170 20,125
            C10,80 35,40 80,25" />
        </svg>
        <div class="zen-stat">
          <div class="zen-stat-number">静</div>
          <div class="zen-stat-label">Stillness in motion</div>
        </div>
      </div>
    </div>
  </section>

  <section id="features" class="section">
    <div class="section-header">
      <p class="section-jp">機能</p>
      <h2 class="section-title">Essential tools, thoughtfully crafted</h2>
    </div>

    <div class="features-grid">
      <div class="feature">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
        </div>
        <h3>Client Relationships</h3>
        <p>Nurture each connection with care. Profiles, histories, and insights in one serene space.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <h3>Mindful Scheduling</h3>
        <p>Time flows naturally. Calendly and Cal.com integration without the friction.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
        </div>
        <h3>Session Notes</h3>
        <p>Capture moments of insight. Let wisdom accumulate like morning dew.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h3>Revenue Flow</h3>
        <p>Prosperity follows purpose. Track payments and packages with clarity.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 019-9"/></svg>
        </div>
        <h3>CRM Harmony</h3>
        <p>Twenty CRM integration. Your data flows where it needs to go.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <h3>Gentle Analytics</h3>
        <p>Understand patterns without overwhelm. Metrics that guide, not distract.</p>
      </div>
    </div>
  </section>

  <section id="philosophy" class="philosophy-section">
    <div class="philosophy-content">
      <p class="section-jp">哲学</p>
      <h2 class="section-title">Less, but better</h2>
      <blockquote class="philosophy-quote">
        "Simplicity is the ultimate sophistication. We built Brick for coaches who understand this."
      </blockquote>
      <p class="philosophy-author">— The Brick Team</p>
    </div>
    <div class="philosophy-visual">
      <div class="stat-card">
        <span class="stat-card-label">Hours saved weekly</span>
        <span class="stat-card-value">10+</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Client retention</span>
        <span class="stat-card-value">94%</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Setup time</span>
        <span class="stat-card-value">5min</span>
      </div>
    </div>
  </section>

  <section class="testimonial-section">
    <div class="testimonial-content">
      <blockquote class="testimonial-quote">
        "Brick brought peace to my practice. No more digital clutter, no more scattered tools. Just clarity."
      </blockquote>
      <div class="testimonial-author">
        <div class="author-avatar"></div>
        <div class="author-info">
          <div class="author-name">Yuki Tanaka</div>
          <div class="author-role">Mindfulness Coach</div>
        </div>
      </div>
    </div>
  </section>

  <section id="start" class="cta-section">
    <p class="cta-jp">始める</p>
    <h2 class="cta-title">Begin with intention</h2>
    <p class="cta-text">
      Join coaches who've found stillness in their practice.
    </p>
    <a href="#" class="cta-btn">Start Your Free Trial</a>
  </section>

  <footer class="footer">
    <div class="footer-logo">Brick</div>
    <div class="footer-links">
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
      <a href="#">Contact</a>
    </div>
    <div class="footer-copy">© 2024 Brick for Coaches</div>
  </footer>

  <script>
    // Smooth reveal animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature, .stat-card').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = \`all 0.8s cubic-bezier(0.4, 0, 0.2, 1) \${i * 0.1}s\`;
      observer.observe(el);
    });
  </script>
</body>
</html>
`;
//# sourceMappingURL=2-organic.js.map