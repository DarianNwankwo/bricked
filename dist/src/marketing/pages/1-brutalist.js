/**
 * Design 1 v2: Neo-Brutalist Warmth
 *
 * Aesthetic: Raw brutalist energy meets unexpected warmth
 * Typography: Clash Display (bold geometric) + Space Mono
 * Colors: Terracotta, warm cream, charcoal, electric accents
 * Vibe: Confident, human, unapologetically bold but approachable
 */
export const page1 = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brick — Coaching Without Compromise</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --terracotta: #c45d3a;
      --cream: #f5f0e6;
      --charcoal: #1c1c1c;
      --warm-white: #faf8f5;
      --electric: #4361ee;
      --sage: #7d8471;
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
      font-family: 'Space Mono', monospace;
      background: var(--warm-white);
      color: var(--charcoal);
      overflow-x: hidden;
    }

    ::selection {
      background: var(--terracotta);
      color: var(--warm-white);
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
      background: var(--warm-white);
      border-bottom: 2px solid var(--charcoal);
    }

    .logo {
      font-family: 'Syne', sans-serif;
      font-size: 1.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: -0.02em;
    }

    .logo span {
      color: var(--terracotta);
    }

    .nav-links {
      display: flex;
      gap: 2.5rem;
    }

    .nav-links a {
      color: var(--charcoal);
      text-decoration: none;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.5rem 0;
      position: relative;
    }

    .nav-links a::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--terracotta);
      transition: width 0.3s ease;
    }

    .nav-links a:hover::after {
      width: 100%;
    }

    .nav-cta {
      padding: 0.875rem 1.75rem;
      background: var(--charcoal);
      color: var(--warm-white);
      text-decoration: none;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 2px solid var(--charcoal);
      transition: all 0.2s ease;
    }

    .nav-cta:hover {
      background: var(--terracotta);
      border-color: var(--terracotta);
    }

    .hero {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      border-bottom: 2px solid var(--charcoal);
    }

    .hero-content {
      padding: 10rem 4rem 4rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-right: 2px solid var(--charcoal);
    }

    .hero-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--sage);
      margin-bottom: 2rem;
    }

    .hero-tag::before {
      content: '';
      width: 40px;
      height: 2px;
      background: var(--sage);
    }

    .hero h1 {
      font-family: 'Syne', sans-serif;
      font-size: clamp(3.5rem, 7vw, 6rem);
      font-weight: 800;
      line-height: 0.95;
      text-transform: uppercase;
      letter-spacing: -0.03em;
      margin-bottom: 2rem;
    }

    .hero h1 .accent {
      color: var(--terracotta);
      font-style: italic;
      text-transform: none;
    }

    .hero-text {
      font-size: 1rem;
      line-height: 1.8;
      max-width: 480px;
      margin-bottom: 3rem;
      color: #555;
    }

    .hero-cta {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 2rem;
      background: var(--terracotta);
      color: var(--warm-white);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 2px solid var(--terracotta);
      transition: all 0.2s ease;
    }

    .btn-primary:hover {
      background: var(--charcoal);
      border-color: var(--charcoal);
    }

    .btn-secondary {
      color: var(--charcoal);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1.25rem 0;
      border-bottom: 2px solid transparent;
      transition: border-color 0.2s ease;
    }

    .btn-secondary:hover {
      border-color: var(--charcoal);
    }

    .hero-visual {
      background: var(--cream);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      position: relative;
      overflow: hidden;
    }

    .hero-graphic {
      width: 100%;
      max-width: 400px;
      aspect-ratio: 1;
      position: relative;
    }

    .graphic-circle {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 3px solid var(--charcoal);
      border-radius: 50%;
      animation: spin 30s linear infinite;
    }

    .graphic-circle::before {
      content: '';
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 16px;
      height: 16px;
      background: var(--terracotta);
      border-radius: 50%;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .graphic-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'Syne', sans-serif;
      font-size: 5rem;
      font-weight: 800;
      color: var(--terracotta);
      opacity: 0.15;
    }

    .graphic-stats {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }

    .stat-big {
      font-family: 'Syne', sans-serif;
      font-size: 4rem;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 0.5rem;
    }

    .stat-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--sage);
    }

    .section {
      padding: 6rem 3rem;
      border-bottom: 2px solid var(--charcoal);
    }

    .section-grid {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 4rem;
    }

    .section-header {
      position: sticky;
      top: 8rem;
      align-self: start;
    }

    .section-number {
      font-family: 'Syne', sans-serif;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--sage);
      margin-bottom: 1rem;
    }

    .section-title {
      font-family: 'Syne', sans-serif;
      font-size: 2.5rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .section-title .accent {
      color: var(--terracotta);
    }

    .features-list {
      display: flex;
      flex-direction: column;
    }

    .feature-item {
      display: grid;
      grid-template-columns: 80px 1fr;
      gap: 2rem;
      padding: 2.5rem 0;
      border-top: 1px solid #ddd;
      transition: all 0.3s ease;
    }

    .feature-item:hover {
      padding-left: 1rem;
      background: var(--cream);
      margin: 0 -1rem;
      padding-right: 1rem;
    }

    .feature-number {
      font-family: 'Syne', sans-serif;
      font-size: 2rem;
      font-weight: 800;
      color: var(--terracotta);
    }

    .feature-content h3 {
      font-family: 'Syne', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }

    .feature-content p {
      font-size: 0.9rem;
      line-height: 1.7;
      color: #555;
    }

    .marquee-section {
      padding: 2rem 0;
      background: var(--charcoal);
      color: var(--warm-white);
      overflow: hidden;
      border-bottom: 2px solid var(--charcoal);
    }

    .marquee {
      display: flex;
      animation: marquee 20s linear infinite;
    }

    .marquee-content {
      display: flex;
      gap: 4rem;
      padding-right: 4rem;
      flex-shrink: 0;
    }

    .marquee-item {
      font-family: 'Syne', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      text-transform: uppercase;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .marquee-item .dot {
      width: 8px;
      height: 8px;
      background: var(--terracotta);
      border-radius: 50%;
    }

    @keyframes marquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .testimonial-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 2px solid var(--charcoal);
    }

    .testimonial-content {
      padding: 6rem 4rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-right: 2px solid var(--charcoal);
    }

    .testimonial-quote {
      font-family: 'Syne', sans-serif;
      font-size: clamp(1.5rem, 3vw, 2.25rem);
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 2rem;
    }

    .testimonial-author {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .author-avatar {
      width: 56px;
      height: 56px;
      background: var(--terracotta);
      border-radius: 50%;
    }

    .author-name {
      font-weight: 700;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .author-role {
      font-size: 0.8rem;
      color: var(--sage);
    }

    .testimonial-visual {
      background: var(--terracotta);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem;
    }

    .visual-stat {
      text-align: center;
      color: var(--warm-white);
    }

    .visual-stat-number {
      font-family: 'Syne', sans-serif;
      font-size: 8rem;
      font-weight: 800;
      line-height: 1;
    }

    .visual-stat-label {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      opacity: 0.8;
    }

    .cta-section {
      padding: 8rem 3rem;
      text-align: center;
      background: var(--cream);
    }

    .cta-title {
      font-family: 'Syne', sans-serif;
      font-size: clamp(2.5rem, 6vw, 5rem);
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      margin-bottom: 1.5rem;
    }

    .cta-title .accent {
      color: var(--terracotta);
    }

    .cta-text {
      font-size: 1.1rem;
      max-width: 500px;
      margin: 0 auto 2.5rem;
      color: #555;
    }

    .footer {
      padding: 2rem 3rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 2px solid var(--charcoal);
      font-size: 0.8rem;
    }

    .footer-links {
      display: flex;
      gap: 2rem;
    }

    .footer-links a {
      color: var(--charcoal);
      text-decoration: none;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .footer-copy {
      color: var(--sage);
    }

    @media (max-width: 1024px) {
      .hero { grid-template-columns: 1fr; }
      .hero-content { border-right: none; border-bottom: 2px solid var(--charcoal); }
      .hero-visual { min-height: 50vh; }
      .section-grid { grid-template-columns: 1fr; }
      .section-header { position: static; margin-bottom: 2rem; }
      .testimonial-section { grid-template-columns: 1fr; }
      .testimonial-content { border-right: none; border-bottom: 2px solid var(--charcoal); }
    }

    @media (max-width: 768px) {
      .nav { padding: 1rem 1.5rem; }
      .nav-links { display: none; }
      .hero-content { padding: 8rem 1.5rem 3rem; }
      .section { padding: 4rem 1.5rem; }
      .feature-item { grid-template-columns: 1fr; gap: 1rem; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="logo">Brick<span>.</span></div>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#proof">Proof</a>
      <a href="#start">Start</a>
    </div>
    <a href="#start" class="nav-cta">Get Started</a>
  </nav>

  <section class="hero">
    <div class="hero-content">
      <div class="hero-tag">Built for coaches</div>
      <h1>
        Stop<br>
        managing.<br>
        Start <span class="accent">coaching.</span>
      </h1>
      <p class="hero-text">
        The no-nonsense platform that handles the business side so you can focus on what actually matters—transforming lives.
      </p>
      <div class="hero-cta">
        <a href="#start" class="btn-primary">
          <span>Start Free</span>
          <span>→</span>
        </a>
        <a href="#features" class="btn-secondary">See Features</a>
      </div>
    </div>
    <div class="hero-visual">
      <div class="hero-graphic">
        <div class="graphic-circle"></div>
        <div class="graphic-text">B</div>
        <div class="graphic-stats">
          <div class="stat-big">10x</div>
          <div class="stat-label">Less busywork</div>
        </div>
      </div>
    </div>
  </section>

  <section class="marquee-section">
    <div class="marquee">
      <div class="marquee-content">
        <span class="marquee-item"><span class="dot"></span>Client Management</span>
        <span class="marquee-item"><span class="dot"></span>Smart Scheduling</span>
        <span class="marquee-item"><span class="dot"></span>Session Notes</span>
        <span class="marquee-item"><span class="dot"></span>Payment Tracking</span>
        <span class="marquee-item"><span class="dot"></span>CRM Sync</span>
        <span class="marquee-item"><span class="dot"></span>Analytics</span>
      </div>
      <div class="marquee-content">
        <span class="marquee-item"><span class="dot"></span>Client Management</span>
        <span class="marquee-item"><span class="dot"></span>Smart Scheduling</span>
        <span class="marquee-item"><span class="dot"></span>Session Notes</span>
        <span class="marquee-item"><span class="dot"></span>Payment Tracking</span>
        <span class="marquee-item"><span class="dot"></span>CRM Sync</span>
        <span class="marquee-item"><span class="dot"></span>Analytics</span>
      </div>
    </div>
  </section>

  <section id="features" class="section">
    <div class="section-grid">
      <div class="section-header">
        <div class="section-number">01 / Features</div>
        <h2 class="section-title">Everything you need.<br><span class="accent">Nothing</span> you don't.</h2>
      </div>
      <div class="features-list">
        <div class="feature-item">
          <div class="feature-number">01</div>
          <div class="feature-content">
            <h3>Client Hub</h3>
            <p>Every client, every session, every note—organized and searchable. Stop drowning in spreadsheets.</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-number">02</div>
          <div class="feature-content">
            <h3>Smart Scheduling</h3>
            <p>Calendly & Cal.com integration that just works. No more back-and-forth emails.</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-number">03</div>
          <div class="feature-content">
            <h3>Session Notes</h3>
            <p>Capture insights in real-time. Reference past breakthroughs instantly. Never lose a thought.</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-number">04</div>
          <div class="feature-content">
            <h3>Revenue Tracking</h3>
            <p>Packages, payments, projections. Know exactly where your business stands.</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-number">05</div>
          <div class="feature-content">
            <h3>Twenty CRM Sync</h3>
            <p>Open-source CRM integration keeps everything in sync. Your data stays yours.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="proof" class="testimonial-section">
    <div class="testimonial-content">
      <blockquote class="testimonial-quote">
        "Brick gave me 10 hours back every week. That's 10 more hours actually coaching instead of shuffling papers."
      </blockquote>
      <div class="testimonial-author">
        <div class="author-avatar"></div>
        <div>
          <div class="author-name">Sarah Chen</div>
          <div class="author-role">Executive Coach</div>
        </div>
      </div>
    </div>
    <div class="testimonial-visual">
      <div class="visual-stat">
        <div class="visual-stat-number">94%</div>
        <div class="visual-stat-label">Client Retention</div>
      </div>
    </div>
  </section>

  <section id="start" class="cta-section">
    <h2 class="cta-title">Ready to<br><span class="accent">actually coach?</span></h2>
    <p class="cta-text">Join coaches who've ditched the admin nightmare.</p>
    <a href="#" class="btn-primary">Start Your Free Trial →</a>
  </section>

  <footer class="footer">
    <div class="footer-links">
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
      <a href="#">Contact</a>
    </div>
    <div class="footer-copy">© 2024 Brick for Coaches</div>
  </footer>

  <script>
    // Feature hover effect
    document.querySelectorAll('.feature-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.querySelector('.feature-number').style.transform = 'translateX(10px)';
      });
      item.addEventListener('mouseleave', () => {
        item.querySelector('.feature-number').style.transform = 'translateX(0)';
      });
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

    document.querySelectorAll('.feature-item').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = \`all 0.6s ease \${i * 0.1}s\`;
      observer.observe(el);
    });
  </script>
</body>
</html>
`;
//# sourceMappingURL=1-brutalist.js.map