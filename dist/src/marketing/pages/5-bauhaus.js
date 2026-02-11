/**
 * Design 5: Refined Bauhaus
 *
 * Aesthetic: Sophisticated Bauhaus - asymmetric compositions, bold geometry, refined primaries
 * Typography: Space Grotesk (modernist geometric) + Instrument Serif (elegant contrast)
 * Colors: Deep blue, warm yellow, burnt orange + cream + charcoal (more sophisticated primaries)
 * Vibe: Confident, architectural, artful - like a gallery meets software
 */
export const page5 = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brick — Coaching Reimagined</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
    :root {
      --blue: #1a365d;
      --blue-light: #2d4a7c;
      --yellow: #f0c246;
      --orange: #d35322;
      --cream: #faf8f3;
      --charcoal: #1c1c1c;
      --gray: #6b6b6b;
      --white: #ffffff;
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
      font-family: 'Space Grotesk', sans-serif;
      background: var(--cream);
      color: var(--charcoal);
      overflow-x: hidden;
      cursor: none;
    }

    /* Custom cursor */
    .cursor {
      width: 20px;
      height: 20px;
      border: 2px solid var(--charcoal);
      border-radius: 50%;
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      transition: transform 0.15s ease, background 0.15s ease;
      mix-blend-mode: difference;
    }

    .cursor.active {
      transform: scale(2);
      background: var(--yellow);
      border-color: var(--yellow);
    }

    .cursor-dot {
      width: 5px;
      height: 5px;
      background: var(--charcoal);
      border-radius: 50%;
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      mix-blend-mode: difference;
    }

    /* Geometric background composition */
    .geo-bg {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    .geo-shape {
      position: absolute;
      transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .geo-circle-1 {
      width: 600px;
      height: 600px;
      border: 3px solid var(--blue);
      border-radius: 50%;
      top: -200px;
      right: -150px;
      opacity: 0.15;
    }

    .geo-circle-2 {
      width: 300px;
      height: 300px;
      background: var(--yellow);
      border-radius: 50%;
      bottom: 10%;
      left: -100px;
      opacity: 0.25;
    }

    .geo-rect-1 {
      width: 200px;
      height: 400px;
      background: var(--blue);
      top: 40%;
      right: 5%;
      opacity: 0.08;
      transform: rotate(-15deg);
    }

    .geo-line-1 {
      width: 1px;
      height: 100vh;
      background: var(--charcoal);
      left: 20%;
      top: 0;
      opacity: 0.1;
    }

    .geo-line-2 {
      width: 1px;
      height: 100vh;
      background: var(--charcoal);
      left: 80%;
      top: 0;
      opacity: 0.1;
    }

    /* Navigation */
    .nav {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: 2rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
      mix-blend-mode: difference;
    }

    .logo {
      font-family: 'Instrument Serif', serif;
      font-size: 1.75rem;
      color: var(--white);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-shapes {
      display: flex;
      gap: 4px;
    }

    .logo-shape {
      width: 8px;
      height: 8px;
    }

    .logo-shape:nth-child(1) { background: var(--yellow); }
    .logo-shape:nth-child(2) { background: var(--orange); border-radius: 50%; }
    .logo-shape:nth-child(3) { background: var(--blue-light); clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }

    .nav-links {
      display: flex;
      gap: 3rem;
    }

    .nav-links a {
      color: var(--white);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      position: relative;
      padding: 0.5rem 0;
    }

    .nav-links a::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--yellow);
      transition: width 0.3s ease;
    }

    .nav-links a:hover::after {
      width: 100%;
    }

    .nav-cta {
      padding: 1rem 2rem;
      background: transparent;
      border: 1px solid var(--white);
      color: var(--white);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      transition: all 0.3s ease;
    }

    .nav-cta:hover {
      background: var(--yellow);
      border-color: var(--yellow);
      color: var(--charcoal);
    }

    /* Hero */
    .hero {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      padding: 0 4rem;
      position: relative;
      z-index: 1;
    }

    .hero-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding-right: 4rem;
    }

    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .eyebrow-line {
      width: 60px;
      height: 2px;
      background: var(--orange);
    }

    .eyebrow-text {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--gray);
    }

    .hero h1 {
      font-family: 'Instrument Serif', serif;
      font-size: clamp(3.5rem, 7vw, 6rem);
      font-weight: 400;
      line-height: 1.05;
      margin-bottom: 2rem;
      letter-spacing: -0.02em;
    }

    .hero h1 em {
      font-style: italic;
      color: var(--orange);
    }

    .hero-text {
      font-size: 1.15rem;
      line-height: 1.8;
      color: var(--gray);
      max-width: 420px;
      margin-bottom: 3rem;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      gap: 2.5rem;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 2.5rem;
      background: var(--blue);
      color: var(--white);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      position: relative;
      overflow: hidden;
      transition: transform 0.3s ease;
    }

    .btn-primary::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: var(--orange);
      transition: left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: -1;
    }

    .btn-primary:hover::before {
      left: 0;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
    }

    .btn-primary .arrow {
      transition: transform 0.3s ease;
    }

    .btn-primary:hover .arrow {
      transform: translateX(4px);
    }

    .btn-ghost {
      color: var(--charcoal);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      position: relative;
    }

    .btn-ghost::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      width: 100%;
      height: 1px;
      background: var(--charcoal);
      transform: scaleX(0);
      transform-origin: right;
      transition: transform 0.3s ease;
    }

    .btn-ghost:hover::after {
      transform: scaleX(1);
      transform-origin: left;
    }

    /* Hero Visual - Asymmetric Composition */
    .hero-visual {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .composition {
      position: relative;
      width: 100%;
      max-width: 500px;
      height: 600px;
    }

    .comp-element {
      position: absolute;
      transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .comp-card {
      width: 340px;
      background: var(--white);
      border: 2px solid var(--charcoal);
      padding: 2rem;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 3;
    }

    .comp-card:hover {
      transform: translate(-50%, -50%) rotate(2deg);
    }

    .card-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 0;
      border-bottom: 1px solid #eee;
    }

    .card-row:last-child {
      border-bottom: none;
    }

    .card-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--gray);
    }

    .card-value {
      font-family: 'Instrument Serif', serif;
      font-size: 1.75rem;
    }

    .card-value.highlight {
      color: var(--orange);
    }

    .comp-circle {
      width: 200px;
      height: 200px;
      background: var(--yellow);
      border-radius: 50%;
      top: 5%;
      right: 0;
      z-index: 2;
    }

    .comp-circle:hover {
      transform: scale(1.1);
    }

    .comp-rect {
      width: 120px;
      height: 280px;
      background: var(--blue);
      bottom: 5%;
      left: 0;
      z-index: 1;
    }

    .comp-rect:hover {
      transform: translateY(-10px);
    }

    .comp-triangle {
      width: 0;
      height: 0;
      border-left: 60px solid transparent;
      border-right: 60px solid transparent;
      border-bottom: 100px solid var(--orange);
      bottom: 15%;
      right: 10%;
      z-index: 4;
    }

    .comp-triangle:hover {
      transform: rotate(15deg);
    }

    /* Features Section */
    .section {
      padding: 10rem 4rem;
      position: relative;
      z-index: 1;
    }

    .section-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      margin-bottom: 6rem;
    }

    .section-left {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .section-number {
      font-family: 'Instrument Serif', serif;
      font-size: 1rem;
      color: var(--orange);
    }

    .section-title {
      font-family: 'Instrument Serif', serif;
      font-size: clamp(2.5rem, 4vw, 3.5rem);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .section-title em {
      font-style: italic;
      color: var(--blue);
    }

    .section-right {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }

    .section-desc {
      font-size: 1.1rem;
      line-height: 1.8;
      color: var(--gray);
      max-width: 400px;
    }

    /* Feature Grid - Asymmetric */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 2rem;
    }

    .feature {
      background: var(--white);
      border: 1px solid rgba(0,0,0,0.1);
      padding: 2.5rem;
      position: relative;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .feature::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 0;
      background: var(--yellow);
      transition: height 0.4s ease;
    }

    .feature:hover::before {
      height: 100%;
    }

    .feature:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.08);
    }

    .feature:nth-child(1) { grid-column: span 7; }
    .feature:nth-child(2) { grid-column: span 5; }
    .feature:nth-child(3) { grid-column: span 4; }
    .feature:nth-child(4) { grid-column: span 4; }
    .feature:nth-child(5) { grid-column: span 4; }
    .feature:nth-child(6) { grid-column: span 6; }
    .feature:nth-child(7) { grid-column: span 6; }

    .feature-icon {
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;
      font-size: 1.5rem;
    }

    .feature:nth-child(1) .feature-icon { background: var(--yellow); }
    .feature:nth-child(2) .feature-icon { background: var(--blue); border-radius: 50%; color: white; }
    .feature:nth-child(3) .feature-icon { background: var(--orange); color: white; }
    .feature:nth-child(4) .feature-icon { background: var(--yellow); border-radius: 50%; }
    .feature:nth-child(5) .feature-icon { background: var(--blue); color: white; }
    .feature:nth-child(6) .feature-icon { background: var(--orange); border-radius: 50%; color: white; }
    .feature:nth-child(7) .feature-icon { background: var(--yellow); }

    .feature h3 {
      font-family: 'Instrument Serif', serif;
      font-size: 1.5rem;
      font-weight: 400;
      margin-bottom: 0.75rem;
    }

    .feature p {
      font-size: 0.95rem;
      color: var(--gray);
      line-height: 1.7;
    }

    /* Testimonial */
    .testimonial-section {
      background: var(--blue);
      padding: 10rem 4rem;
      position: relative;
      overflow: hidden;
    }

    .testimonial-geo {
      position: absolute;
      pointer-events: none;
    }

    .test-circle {
      width: 400px;
      height: 400px;
      border: 2px solid rgba(255,255,255,0.1);
      border-radius: 50%;
      top: -100px;
      right: -100px;
    }

    .test-rect {
      width: 150px;
      height: 300px;
      background: rgba(255,255,255,0.05);
      bottom: -50px;
      left: 10%;
      transform: rotate(-10deg);
    }

    .testimonial-content {
      max-width: 900px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    .testimonial-quote {
      font-family: 'Instrument Serif', serif;
      font-size: clamp(2rem, 3.5vw, 3rem);
      color: var(--white);
      line-height: 1.4;
      margin-bottom: 3rem;
      font-style: italic;
    }

    .testimonial-quote::before {
      content: '"';
      font-size: 6rem;
      color: var(--yellow);
      line-height: 0;
      vertical-align: top;
      margin-right: 0.25rem;
    }

    .testimonial-author {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .author-photo {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, var(--yellow), var(--orange));
      border-radius: 50%;
    }

    .author-info {
      color: var(--white);
    }

    .author-name {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 0.25rem;
    }

    .author-role {
      font-size: 0.9rem;
      opacity: 0.7;
    }

    /* Stats Section */
    .stats-section {
      padding: 8rem 4rem;
      background: var(--charcoal);
      color: var(--white);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4rem;
      max-width: 1000px;
      margin: 0 auto;
      text-align: center;
    }

    .stat {
      position: relative;
    }

    .stat-number {
      font-family: 'Instrument Serif', serif;
      font-size: 4rem;
      margin-bottom: 0.5rem;
      color: var(--yellow);
    }

    .stat-label {
      font-size: 0.85rem;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.7;
    }

    /* CTA Section */
    .cta-section {
      padding: 12rem 4rem;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .cta-composition {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      height: 800px;
      pointer-events: none;
    }

    .cta-shape {
      position: absolute;
      opacity: 0.15;
    }

    .cta-circle {
      width: 500px;
      height: 500px;
      border: 3px solid var(--blue);
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: cta-rotate 30s linear infinite;
    }

    .cta-square {
      width: 200px;
      height: 200px;
      background: var(--yellow);
      top: 10%;
      left: 20%;
      animation: cta-float 6s ease-in-out infinite;
    }

    .cta-triangle {
      width: 0;
      height: 0;
      border-left: 80px solid transparent;
      border-right: 80px solid transparent;
      border-bottom: 140px solid var(--orange);
      bottom: 15%;
      right: 20%;
      animation: cta-float 8s ease-in-out infinite reverse;
    }

    @keyframes cta-rotate {
      from { transform: translate(-50%, -50%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    @keyframes cta-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }

    .cta-content {
      position: relative;
      z-index: 1;
    }

    .cta-title {
      font-family: 'Instrument Serif', serif;
      font-size: clamp(3rem, 6vw, 5rem);
      line-height: 1.1;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }

    .cta-title em {
      font-style: italic;
      color: var(--orange);
    }

    .cta-text {
      font-size: 1.2rem;
      color: var(--gray);
      max-width: 500px;
      margin: 0 auto 3rem;
      line-height: 1.7;
    }

    /* Footer */
    .footer {
      padding: 4rem;
      border-top: 1px solid rgba(0,0,0,0.1);
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 4rem;
    }

    .footer-logo {
      font-family: 'Instrument Serif', serif;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 3rem;
    }

    .footer-links a {
      color: var(--gray);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.3s ease;
    }

    .footer-links a:hover {
      color: var(--charcoal);
    }

    .footer-copy {
      font-size: 0.85rem;
      color: var(--gray);
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .hero { grid-template-columns: 1fr; }
      .hero-content { padding-right: 0; padding-top: 8rem; }
      .hero-visual { display: none; }
      .section-header { grid-template-columns: 1fr; }
      .features-grid { grid-template-columns: 1fr; }
      .feature { grid-column: span 1 !important; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 3rem; }
    }

    @media (max-width: 768px) {
      body { cursor: auto; }
      .cursor, .cursor-dot { display: none; }
      .nav { padding: 1.5rem 2rem; }
      .nav-links { display: none; }
      .section { padding: 5rem 2rem; }
      .footer { grid-template-columns: 1fr; text-align: center; gap: 2rem; }
      .footer-links { flex-wrap: wrap; justify-content: center; gap: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="cursor"></div>
  <div class="cursor-dot"></div>

  <div class="geo-bg">
    <div class="geo-shape geo-circle-1"></div>
    <div class="geo-shape geo-circle-2"></div>
    <div class="geo-shape geo-rect-1"></div>
    <div class="geo-shape geo-line-1"></div>
    <div class="geo-shape geo-line-2"></div>
  </div>

  <nav class="nav">
    <div class="logo">
      <div class="logo-shapes">
        <div class="logo-shape"></div>
        <div class="logo-shape"></div>
        <div class="logo-shape"></div>
      </div>
      Brick
    </div>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#testimonials">Stories</a>
      <a href="#pricing">Pricing</a>
    </div>
    <a href="#start" class="nav-cta">Get Started</a>
  </nav>

  <section class="hero">
    <div class="hero-content">
      <div class="hero-eyebrow">
        <div class="eyebrow-line"></div>
        <span class="eyebrow-text">For Modern Coaches</span>
      </div>
      <h1>
        Build your<br>
        practice with<br>
        <em>intention</em>
      </h1>
      <p class="hero-text">
        A thoughtfully designed platform that elevates how you work. Simple tools, beautiful craft, meaningful results.
      </p>
      <div class="hero-actions">
        <a href="#start" class="btn-primary">
          <span>Start Free Trial</span>
          <span class="arrow">→</span>
        </a>
        <a href="#features" class="btn-ghost">Watch Demo</a>
      </div>
    </div>
    <div class="hero-visual">
      <div class="composition">
        <div class="comp-element comp-circle"></div>
        <div class="comp-element comp-rect"></div>
        <div class="comp-element comp-card">
          <div class="card-row">
            <span class="card-label">Active Clients</span>
            <span class="card-value highlight">24</span>
          </div>
          <div class="card-row">
            <span class="card-label">This Month</span>
            <span class="card-value">$8.4k</span>
          </div>
          <div class="card-row">
            <span class="card-label">Sessions</span>
            <span class="card-value highlight">47</span>
          </div>
          <div class="card-row">
            <span class="card-label">Completion</span>
            <span class="card-value">94%</span>
          </div>
        </div>
        <div class="comp-element comp-triangle"></div>
      </div>
    </div>
  </section>

  <section id="features" class="section">
    <div class="section-header">
      <div class="section-left">
        <span class="section-number">01</span>
        <h2 class="section-title">
          Everything you need,<br>
          <em>crafted with care</em>
        </h2>
      </div>
      <div class="section-right">
        <p class="section-desc">
          We stripped away the noise and built what matters. Each feature designed with intention, every interaction considered.
        </p>
      </div>
    </div>

    <div class="features-grid">
      <div class="feature">
        <div class="feature-icon">👥</div>
        <h3>Client Profiles</h3>
        <p>Beautiful profiles that tell the complete story. Track journeys, capture insights, and see growth unfold over time.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📅</div>
        <h3>Smart Scheduling</h3>
        <p>Seamless calendar integration. Your schedule, your rules, zero friction.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📝</div>
        <h3>Session Notes</h3>
        <p>Capture insights as they happen with our elegant editor.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">💰</div>
        <h3>Payments</h3>
        <p>Packages, invoices, and Stripe integration. Get paid simply.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🔗</div>
        <h3>CRM Sync</h3>
        <p>Twenty CRM integration keeps everything in harmony.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📊</div>
        <h3>Analytics Dashboard</h3>
        <p>See what's working at a glance. Track growth, identify patterns, and make better decisions with clear insights.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🎯</div>
        <h3>Goal Tracking</h3>
        <p>Help clients set and achieve meaningful milestones. Visualize progress and celebrate wins together.</p>
      </div>
    </div>
  </section>

  <section id="testimonials" class="testimonial-section">
    <div class="testimonial-geo test-circle"></div>
    <div class="testimonial-geo test-rect"></div>
    <div class="testimonial-content">
      <p class="testimonial-quote">
        Brick brought clarity to my practice. It's not just software—it's a partner in building something meaningful.
      </p>
      <div class="testimonial-author">
        <div class="author-photo"></div>
        <div class="author-info">
          <div class="author-name">Jordan Rivera</div>
          <div class="author-role">Leadership Coach</div>
        </div>
      </div>
    </div>
  </section>

  <section class="stats-section">
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-number">2,400+</div>
        <div class="stat-label">Active Coaches</div>
      </div>
      <div class="stat">
        <div class="stat-number">94%</div>
        <div class="stat-label">Retention Rate</div>
      </div>
      <div class="stat">
        <div class="stat-number">4.9</div>
        <div class="stat-label">Average Rating</div>
      </div>
      <div class="stat">
        <div class="stat-number">12M+</div>
        <div class="stat-label">Sessions Tracked</div>
      </div>
    </div>
  </section>

  <section id="start" class="cta-section">
    <div class="cta-composition">
      <div class="cta-shape cta-circle"></div>
      <div class="cta-shape cta-square"></div>
      <div class="cta-shape cta-triangle"></div>
    </div>
    <div class="cta-content">
      <h2 class="cta-title">Ready to build<br><em>something better?</em></h2>
      <p class="cta-text">
        Join thousands of coaches who've discovered that running a practice can be both beautiful and effortless.
      </p>
      <a href="#" class="btn-primary">
        <span>Start Your Free Trial</span>
        <span class="arrow">→</span>
      </a>
    </div>
  </section>

  <footer class="footer">
    <div class="footer-logo">
      <div class="logo-shapes">
        <div class="logo-shape"></div>
        <div class="logo-shape"></div>
        <div class="logo-shape"></div>
      </div>
      Brick
    </div>
    <div class="footer-links">
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
      <a href="#">Contact</a>
      <a href="#">Twitter</a>
    </div>
    <div class="footer-copy">© 2024 Brick</div>
  </footer>

  <script>
    // Custom cursor
    const cursor = document.querySelector('.cursor');
    const cursorDot = document.querySelector('.cursor-dot');

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let dotX = 0, dotY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function animateCursor() {
      cursorX += (mouseX - cursorX) * 0.15;
      cursorY += (mouseY - cursorY) * 0.15;
      dotX += (mouseX - dotX) * 0.35;
      dotY += (mouseY - dotY) * 0.35;

      cursor.style.left = cursorX - 10 + 'px';
      cursor.style.top = cursorY - 10 + 'px';
      cursorDot.style.left = dotX - 2.5 + 'px';
      cursorDot.style.top = dotY - 2.5 + 'px';

      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Cursor hover states
    document.querySelectorAll('a, button, .feature, .comp-element').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('active'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('active'));
    });

    // Parallax on geometric shapes
    const geoShapes = document.querySelectorAll('.geo-shape');
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      geoShapes.forEach((shape, i) => {
        const speed = (i + 1) * 0.05;
        shape.style.transform = \`translateY(\${scrollY * speed}px)\`;
      });
    });

    // Mouse parallax on composition elements
    const compElements = document.querySelectorAll('.comp-element');
    document.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;

      compElements.forEach((el, i) => {
        const factor = (i + 1) * 8;
        const baseTransform = el.classList.contains('comp-card')
          ? 'translate(-50%, -50%)'
          : '';
        el.style.transform = \`\${baseTransform} translate(\${x * factor}px, \${y * factor}px)\`;
      });
    });

    // Scroll reveal for features
    const features = document.querySelectorAll('.feature');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }, i * 80);
        }
      });
    }, { threshold: 0.1 });

    features.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
      observer.observe(el);
    });

    // Stats count animation
    const stats = document.querySelectorAll('.stat-number');
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const text = el.textContent;
          const number = parseFloat(text.replace(/[^0-9.]/g, ''));
          const suffix = text.replace(/[0-9.,]/g, '');
          const isDecimal = text.includes('.');

          let current = 0;
          const increment = number / 40;
          const timer = setInterval(() => {
            current += increment;
            if (current >= number) {
              el.textContent = text;
              clearInterval(timer);
            } else {
              el.textContent = (isDecimal ? current.toFixed(1) : Math.floor(current).toLocaleString()) + suffix;
            }
          }, 30);

          statsObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    stats.forEach(stat => statsObserver.observe(stat));
  </script>
</body>
</html>
`;
//# sourceMappingURL=5-bauhaus.js.map