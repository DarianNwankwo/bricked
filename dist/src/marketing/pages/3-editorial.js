/**
 * Design 3 v2: Modern Editorial
 *
 * Aesthetic: Contemporary magazine, Kinfolk-meets-tech
 * Typography: Playfair Display (dramatic serif) + Karla (friendly sans)
 * Colors: Soft black, warm white, muted copper, gentle blue-gray
 * Vibe: Sophisticated but approachable, curated lifestyle brand
 */
export const page3 = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brick — A Coaching Practice, Curated</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Karla:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --soft-black: #1a1a1a;
      --warm-white: #fdfcfa;
      --cream: #f7f5f2;
      --copper: #b8856c;
      --copper-light: #d4a88c;
      --blue-gray: #8a9a9e;
      --light-gray: #e8e6e3;
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
      font-family: 'Karla', sans-serif;
      background: var(--warm-white);
      color: var(--soft-black);
      font-size: 16px;
      line-height: 1.6;
    }

    ::selection {
      background: var(--copper);
      color: var(--warm-white);
    }

    .nav {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: 1.5rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
      background: rgba(253, 252, 250, 0.98);
      backdrop-filter: blur(10px);
    }

    .logo {
      font-family: 'Playfair Display', serif;
      font-size: 1.75rem;
      font-weight: 500;
      font-style: italic;
    }

    .nav-center {
      display: flex;
      gap: 3rem;
    }

    .nav-center a {
      color: var(--soft-black);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      opacity: 0.7;
      transition: opacity 0.3s ease;
    }

    .nav-center a:hover {
      opacity: 1;
    }

    .nav-cta {
      padding: 0.75rem 1.75rem;
      background: var(--soft-black);
      color: var(--warm-white);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 2px;
      transition: all 0.3s ease;
    }

    .nav-cta:hover {
      background: var(--copper);
    }

    .hero {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding-top: 5rem;
    }

    .hero-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 4rem 6rem 4rem 4rem;
    }

    .hero-issue {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--copper);
      margin-bottom: 2rem;
    }

    .hero h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 400;
      line-height: 1.2;
      margin-bottom: 2rem;
    }

    .hero h1 em {
      font-style: italic;
    }

    .hero-text {
      font-size: 1.1rem;
      color: var(--blue-gray);
      max-width: 400px;
      margin-bottom: 3rem;
      line-height: 1.8;
    }

    .hero-cta {
      display: flex;
      gap: 2rem;
      align-items: center;
    }

    .btn-primary {
      display: inline-block;
      padding: 1rem 2.5rem;
      background: var(--soft-black);
      color: var(--warm-white);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      border-radius: 2px;
      transition: all 0.3s ease;
    }

    .btn-primary:hover {
      background: var(--copper);
      transform: translateY(-2px);
    }

    .btn-text {
      color: var(--soft-black);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      opacity: 0.7;
      transition: all 0.3s ease;
    }

    .btn-text:hover {
      opacity: 1;
      gap: 1rem;
    }

    .hero-visual {
      background: var(--cream);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      position: relative;
    }

    .hero-card {
      width: 100%;
      max-width: 380px;
      background: var(--warm-white);
      box-shadow: 0 30px 60px rgba(0,0,0,0.08);
      border-radius: 4px;
      overflow: hidden;
    }

    .card-image {
      height: 200px;
      background: linear-gradient(135deg, var(--copper-light) 0%, var(--copper) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-image-text {
      font-family: 'Playfair Display', serif;
      font-size: 3rem;
      font-style: italic;
      color: var(--warm-white);
      opacity: 0.9;
    }

    .card-content {
      padding: 2rem;
    }

    .card-tag {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--copper);
      margin-bottom: 0.75rem;
    }

    .card-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }

    .card-desc {
      font-size: 0.9rem;
      color: var(--blue-gray);
      line-height: 1.6;
    }

    .section {
      padding: 8rem 4rem;
    }

    .section-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      margin-bottom: 5rem;
      align-items: end;
    }

    .section-issue {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--copper);
      margin-bottom: 1rem;
    }

    .section-title {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 400;
      line-height: 1.2;
    }

    .section-title em {
      font-style: italic;
    }

    .section-desc {
      font-size: 1.1rem;
      color: var(--blue-gray);
      line-height: 1.8;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3rem;
    }

    .feature {
      padding: 2.5rem;
      background: var(--cream);
      border-radius: 4px;
      transition: all 0.4s ease;
    }

    .feature:hover {
      background: var(--warm-white);
      box-shadow: 0 20px 40px rgba(0,0,0,0.06);
      transform: translateY(-5px);
    }

    .feature-number {
      font-family: 'Playfair Display', serif;
      font-size: 2.5rem;
      font-style: italic;
      color: var(--copper-light);
      margin-bottom: 1.5rem;
    }

    .feature h3 {
      font-family: 'Playfair Display', serif;
      font-size: 1.25rem;
      font-weight: 500;
      margin-bottom: 1rem;
    }

    .feature p {
      font-size: 0.95rem;
      color: var(--blue-gray);
      line-height: 1.7;
    }

    .story-section {
      background: var(--soft-black);
      color: var(--warm-white);
      padding: 8rem 4rem;
    }

    .story-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6rem;
      align-items: center;
    }

    .story-content .section-issue {
      color: var(--copper-light);
    }

    .story-content .section-title {
      margin-bottom: 2rem;
    }

    .story-quote {
      font-family: 'Playfair Display', serif;
      font-size: 1.5rem;
      font-style: italic;
      line-height: 1.6;
      margin-bottom: 2rem;
      color: rgba(255,255,255,0.85);
    }

    .story-author {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .story-avatar {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--copper), var(--copper-light));
      border-radius: 50%;
    }

    .story-name {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .story-role {
      font-size: 0.85rem;
      opacity: 0.6;
    }

    .story-visual {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .story-stat {
      background: rgba(255,255,255,0.05);
      padding: 2rem;
      border-radius: 4px;
      text-align: center;
    }

    .story-stat:nth-child(2) {
      transform: translateY(2rem);
    }

    .story-stat:nth-child(4) {
      transform: translateY(2rem);
    }

    .stat-value {
      font-family: 'Playfair Display', serif;
      font-size: 3rem;
      font-weight: 400;
      color: var(--copper-light);
      margin-bottom: 0.5rem;
    }

    .stat-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.6;
    }

    .cta-section {
      padding: 10rem 4rem;
      text-align: center;
      background: var(--cream);
    }

    .cta-issue {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--copper);
      margin-bottom: 2rem;
    }

    .cta-title {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 400;
      margin-bottom: 1.5rem;
      line-height: 1.2;
    }

    .cta-title em {
      font-style: italic;
    }

    .cta-text {
      font-size: 1.15rem;
      color: var(--blue-gray);
      max-width: 450px;
      margin: 0 auto 3rem;
      line-height: 1.8;
    }

    .footer {
      padding: 3rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--light-gray);
    }

    .footer-logo {
      font-family: 'Playfair Display', serif;
      font-size: 1.5rem;
      font-style: italic;
    }

    .footer-links {
      display: flex;
      gap: 2.5rem;
    }

    .footer-links a {
      color: var(--blue-gray);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.3s ease;
    }

    .footer-links a:hover {
      color: var(--soft-black);
    }

    .footer-copy {
      font-size: 0.85rem;
      color: var(--blue-gray);
    }

    @media (max-width: 1024px) {
      .hero { grid-template-columns: 1fr; }
      .hero-visual { min-height: 400px; }
      .section-header { grid-template-columns: 1fr; }
      .features-grid { grid-template-columns: 1fr; }
      .story-grid { grid-template-columns: 1fr; }
      .story-visual { margin-top: 3rem; }
    }

    @media (max-width: 768px) {
      .nav { padding: 1rem 1.5rem; }
      .nav-center { display: none; }
      .hero-content { padding: 6rem 1.5rem 3rem; }
      .section { padding: 4rem 1.5rem; }
      .footer { flex-direction: column; gap: 2rem; text-align: center; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="logo">Brick</div>
    <div class="nav-center">
      <a href="#features">Features</a>
      <a href="#story">Stories</a>
      <a href="#start">Subscribe</a>
    </div>
    <a href="#start" class="nav-cta">Get Started</a>
  </nav>

  <section class="hero">
    <div class="hero-content">
      <div class="hero-issue">The Coaching Issue</div>
      <h1>
        Your practice,<br>
        <em>thoughtfully curated</em>
      </h1>
      <p class="hero-text">
        We believe coaching is an art. Brick is where modern coaches manage their craft with intention and elegance.
      </p>
      <div class="hero-cta">
        <a href="#start" class="btn-primary">Start Your Story</a>
        <a href="#features" class="btn-text">
          <span>Read More</span>
          <span>→</span>
        </a>
      </div>
    </div>
    <div class="hero-visual">
      <div class="hero-card">
        <div class="card-image">
          <span class="card-image-text">B</span>
        </div>
        <div class="card-content">
          <div class="card-tag">Dashboard Preview</div>
          <h3 class="card-title">A sanctuary for your practice</h3>
          <p class="card-desc">Where every client relationship is nurtured, every session is captured, and every insight is preserved.</p>
        </div>
      </div>
    </div>
  </section>

  <section id="features" class="section">
    <div class="section-header">
      <div>
        <div class="section-issue">Chapter One</div>
        <h2 class="section-title">The essential <em>collection</em></h2>
      </div>
      <p class="section-desc">
        Six carefully selected tools that transform the way you manage your coaching practice. Nothing more, nothing less.
      </p>
    </div>

    <div class="features-grid">
      <div class="feature">
        <div class="feature-number">01</div>
        <h3>Client Portraits</h3>
        <p>Rich, detailed profiles that tell the story of each coaching relationship from first meeting to transformation.</p>
      </div>
      <div class="feature">
        <div class="feature-number">02</div>
        <h3>Calendar Stories</h3>
        <p>Seamless scheduling that respects your time and your clients'. Calendly and Cal.com, unified.</p>
      </div>
      <div class="feature">
        <div class="feature-number">03</div>
        <h3>Session Archives</h3>
        <p>A living library of coaching insights. Every breakthrough captured, every pattern revealed.</p>
      </div>
      <div class="feature">
        <div class="feature-number">04</div>
        <h3>Revenue Chronicles</h3>
        <p>Financial clarity without the complexity. Packages, payments, and projections at a glance.</p>
      </div>
      <div class="feature">
        <div class="feature-number">05</div>
        <h3>CRM Connection</h3>
        <p>Twenty CRM integration that keeps your relationships in perfect sync across platforms.</p>
      </div>
      <div class="feature">
        <div class="feature-number">06</div>
        <h3>Practice Insights</h3>
        <p>Analytics that inform without overwhelming. See the story your data is telling.</p>
      </div>
    </div>
  </section>

  <section id="story" class="story-section">
    <div class="story-grid">
      <div class="story-content">
        <div class="section-issue">Featured Story</div>
        <h2 class="section-title">From scattered to <em>serene</em></h2>
        <blockquote class="story-quote">
          "Brick transformed how I see my practice. It's not just software—it's like having a beautifully organized studio for my coaching work."
        </blockquote>
        <div class="story-author">
          <div class="story-avatar"></div>
          <div>
            <div class="story-name">Elena Martinez</div>
            <div class="story-role">Leadership Coach, NYC</div>
          </div>
        </div>
      </div>
      <div class="story-visual">
        <div class="story-stat">
          <div class="stat-value">10+</div>
          <div class="stat-label">Hours Saved</div>
        </div>
        <div class="story-stat">
          <div class="stat-value">94%</div>
          <div class="stat-label">Retention</div>
        </div>
        <div class="story-stat">
          <div class="stat-value">3x</div>
          <div class="stat-label">Growth</div>
        </div>
        <div class="story-stat">
          <div class="stat-value">500+</div>
          <div class="stat-label">Coaches</div>
        </div>
      </div>
    </div>
  </section>

  <section id="start" class="cta-section">
    <div class="cta-issue">Join the Collection</div>
    <h2 class="cta-title">Write your <em>next chapter</em></h2>
    <p class="cta-text">
      Become part of a community of coaches who value craft, intention, and beautiful tools.
    </p>
    <a href="#" class="btn-primary">Begin Your Free Trial</a>
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

    document.querySelectorAll('.feature, .story-stat').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = \`all 0.7s cubic-bezier(0.4, 0, 0.2, 1) \${i * 0.1}s\`;
      observer.observe(el);
    });

    // Parallax on hero card
    const heroCard = document.querySelector('.hero-card');
    document.addEventListener('mousemove', (e) => {
      if (window.innerWidth > 1024 && heroCard) {
        const x = (e.clientX / window.innerWidth - 0.5) * 10;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;
        heroCard.style.transform = \`perspective(1000px) rotateY(\${x}deg) rotateX(\${-y}deg)\`;
      }
    });
  </script>
</body>
</html>
`;
//# sourceMappingURL=3-editorial.js.map