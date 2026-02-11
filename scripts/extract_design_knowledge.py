#!/usr/bin/env python3
"""
Extract software design principles and system design patterns from PDF books.
Outputs structured JSON that can be used to create Brick Studio templates.

Enhanced version with:
- Best practices and anti-patterns extraction
- Scalability recommendations
- Cost optimization tips
- Security considerations
- Technology stack recommendations
- Sophisticated pattern detection (lists, pros/cons, decision criteria)
"""

import os
import sys
import json
import re
from pathlib import Path
from dataclasses import dataclass, asdict, field
from typing import Optional

# Force unbuffered output for progress tracking
sys.stdout.reconfigure(line_buffering=True)

# PDF extraction
try:
    import pypdf
except ImportError:
    print("Installing pypdf...")
    os.system("pip install pypdf")
    import pypdf

# For better text extraction from some PDFs
try:
    import pdfplumber
except ImportError:
    print("Installing pdfplumber...")
    os.system("pip install pdfplumber")
    import pdfplumber


@dataclass
class DesignPattern:
    name: str
    category: str  # architectural, behavioral, structural, creational, system
    description: str
    use_cases: list[str]
    components: list[str]  # Infrastructure components involved
    source_book: str


@dataclass
class ArchitectureTemplate:
    name: str
    description: str
    tier: str  # single-tier, two-tier, three-tier, n-tier, microservices
    components: list[dict]  # {type, name, description}
    connections: list[dict]  # {from, to, protocol}
    scalability: str  # horizontal, vertical, both
    source_patterns: list[str]


@dataclass
class BestPractice:
    """A recommended practice or approach."""
    title: str
    description: str
    category: str  # architecture, performance, security, reliability, maintainability
    context: str  # When this applies
    source_book: str


@dataclass
class AntiPattern:
    """A common mistake or bad practice to avoid."""
    name: str
    description: str
    why_bad: str
    alternative: str
    source_book: str


@dataclass
class ScalabilityRecommendation:
    """Guidance on when to use horizontal vs vertical scaling."""
    scenario: str
    recommendation: str  # horizontal, vertical, both
    reasoning: str
    components_affected: list[str]
    source_book: str


@dataclass
class CostOptimizationTip:
    """Tips for reducing infrastructure costs."""
    title: str
    description: str
    savings_area: str  # compute, storage, network, licensing
    trade_offs: str
    source_book: str


@dataclass
class SecurityConsideration:
    """Security-related recommendations."""
    title: str
    description: str
    threat_addressed: str
    implementation_notes: str
    source_book: str


@dataclass
class TechStackRecommendation:
    """Technology choice recommendations."""
    technology: str
    use_case: str
    strengths: list[str]
    weaknesses: list[str]
    alternatives: list[str]
    source_book: str


@dataclass
class DecisionCriterion:
    """A decision guideline (use X when..., prefer Y if...)."""
    condition: str
    recommendation: str
    category: str  # database, architecture, scaling, caching, etc.
    source_book: str


@dataclass
class ProsConsList:
    """Extracted pros and cons for a technology or approach."""
    subject: str
    pros: list[str]
    cons: list[str]
    source_book: str


@dataclass
class DesignPrinciple:
    """A high-level design principle extracted from the text."""
    name: str
    description: str
    category: str
    examples: list[str]
    source_book: str


# Keywords to identify relevant sections
ARCHITECTURE_KEYWORDS = [
    "microservices", "monolith", "serverless", "event-driven", "layered architecture",
    "hexagonal", "clean architecture", "domain-driven", "cqrs", "event sourcing",
    "api gateway", "load balancer", "message queue", "cache", "database",
    "service mesh", "container", "kubernetes", "docker", "cdn",
    "three-tier", "n-tier", "client-server", "peer-to-peer", "pub-sub",
    "saga pattern", "circuit breaker", "bulkhead", "retry", "timeout",
    "sharding", "replication", "partitioning", "consistent hashing",
    "cap theorem", "acid", "base", "eventual consistency",
    "horizontal scaling", "vertical scaling", "auto-scaling",
    "stateless", "stateful", "idempotent", "distributed",
]

COMPONENT_PATTERNS = {
    "web_service": ["web server", "http server", "api server", "rest api", "graphql"],
    "database": ["postgresql", "mysql", "mongodb", "redis", "database", "data store", "sql", "nosql"],
    "cache": ["cache", "redis", "memcached", "cdn", "edge cache"],
    "queue": ["message queue", "kafka", "rabbitmq", "sqs", "pub/sub", "event bus"],
    "load_balancer": ["load balancer", "nginx", "haproxy", "reverse proxy"],
    "worker": ["worker", "background job", "async task", "cron", "scheduler"],
    "storage": ["s3", "blob storage", "object storage", "file storage"],
    "auth": ["authentication", "authorization", "oauth", "jwt", "identity"],
    "gateway": ["api gateway", "gateway", "ingress", "edge"],
    "static_site": ["static site", "spa", "frontend", "cdn", "jamstack"],
}

# Keywords for best practices extraction
BEST_PRACTICE_KEYWORDS = [
    "best practice", "recommended", "should always", "it is important to",
    "rule of thumb", "good practice", "prefer", "favor", "guideline",
    "principle", "always ensure", "make sure to", "key insight",
    "pro tip", "remember to", "don't forget", "critical to",
]

# Keywords for anti-patterns
ANTI_PATTERN_KEYWORDS = [
    "anti-pattern", "antipattern", "avoid", "don't", "do not", "never",
    "bad practice", "common mistake", "pitfall", "wrong approach",
    "should not", "shouldn't", "problematic", "danger", "warning",
    "code smell", "technical debt", "legacy", "deprecated",
]

# Keywords for scalability recommendations
SCALABILITY_KEYWORDS = [
    "horizontal scaling", "vertical scaling", "scale out", "scale up",
    "elasticity", "auto-scaling", "load distribution", "sharding",
    "partitioning", "replication", "clustering", "distributed",
    "bottleneck", "throughput", "capacity", "performance",
    "scale horizontally", "scale vertically", "add more instances",
    "bigger machine", "more servers", "traffic spike",
]

# Keywords for cost optimization
COST_KEYWORDS = [
    "cost", "expensive", "cheap", "budget", "pricing", "billing",
    "optimize", "reduce cost", "save money", "cost-effective",
    "reserved instance", "spot instance", "on-demand", "serverless",
    "pay per use", "pay as you go", "over-provisioned", "right-sizing",
    "efficiency", "resource utilization", "waste", "idle",
]

# Keywords for security
SECURITY_KEYWORDS = [
    "security", "authentication", "authorization", "encryption",
    "ssl", "tls", "https", "oauth", "jwt", "token", "api key",
    "vulnerability", "attack", "threat", "malicious", "injection",
    "xss", "csrf", "ddos", "firewall", "waf", "rate limiting",
    "access control", "rbac", "least privilege", "zero trust",
    "secure", "protect", "audit", "compliance", "gdpr", "pci",
]

# Technology stack keywords
TECH_STACK_KEYWORDS = {
    "postgresql": ["acid", "relational", "transactions", "sql", "structured data"],
    "mongodb": ["document", "flexible schema", "json", "nosql", "unstructured"],
    "redis": ["cache", "fast", "in-memory", "session", "pub/sub"],
    "elasticsearch": ["search", "full-text", "analytics", "logs"],
    "kafka": ["streaming", "event", "high throughput", "real-time"],
    "rabbitmq": ["message queue", "amqp", "reliable", "routing"],
    "kubernetes": ["container orchestration", "scaling", "deployment"],
    "docker": ["container", "packaging", "isolation", "portability"],
    "nginx": ["reverse proxy", "load balancer", "web server"],
    "graphql": ["api", "flexible queries", "single endpoint"],
    "rest": ["api", "stateless", "http", "resource-based"],
    "grpc": ["rpc", "protocol buffers", "high performance", "streaming"],
}

# Decision criteria patterns
DECISION_PATTERNS = [
    r"use\s+(\w+)\s+when\b",
    r"prefer\s+(\w+)\s+if\b",
    r"choose\s+(\w+)\s+for\b",
    r"(\w+)\s+is\s+(?:best|ideal|suitable)\s+for\b",
    r"if\s+you\s+need\s+.+?,\s+use\s+(\w+)",
    r"for\s+.+?,\s+consider\s+(\w+)",
    r"when\s+.+?,\s+(\w+)\s+is\s+(?:recommended|preferred)",
]


def extract_text_pypdf(pdf_path: str) -> str:
    """Extract text using pypdf."""
    text = []
    try:
        with open(pdf_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text.append(page_text)
    except Exception as e:
        print(f"  pypdf error: {e}")
    return "\n".join(text)


def extract_text_pdfplumber(pdf_path: str) -> str:
    """Extract text using pdfplumber (better for complex layouts)."""
    text = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text.append(page_text)
    except Exception as e:
        print(f"  pdfplumber error: {e}")
    return "\n".join(text)


def extract_text(pdf_path: str) -> str:
    """Try multiple extraction methods."""
    # Try pdfplumber first (better quality)
    text = extract_text_pdfplumber(pdf_path)
    if len(text) < 1000:
        # Fall back to pypdf
        text = extract_text_pypdf(pdf_path)
    return text


def find_relevant_sections(text: str, keywords: list[str], context_chars: int = 500) -> list[dict]:
    """Find sections containing relevant keywords."""
    sections = []
    text_lower = text.lower()

    for keyword in keywords:
        pattern = re.compile(rf'\b{re.escape(keyword)}\b', re.IGNORECASE)
        for match in pattern.finditer(text):
            start = max(0, match.start() - context_chars)
            end = min(len(text), match.end() + context_chars)

            # Try to find paragraph boundaries
            section_start = text.rfind('\n\n', start, match.start())
            if section_start == -1:
                section_start = start
            section_end = text.find('\n\n', match.end(), end)
            if section_end == -1:
                section_end = end

            section_text = text[section_start:section_end].strip()
            if len(section_text) > 50:  # Filter out tiny snippets
                sections.append({
                    "keyword": keyword,
                    "text": section_text,
                    "position": match.start()
                })

    # Deduplicate overlapping sections
    seen_positions = set()
    unique_sections = []
    for section in sorted(sections, key=lambda x: x["position"]):
        # Check if this position overlaps with a seen one
        pos_key = section["position"] // 1000  # Group by ~1000 char blocks
        if pos_key not in seen_positions:
            seen_positions.add(pos_key)
            unique_sections.append(section)

    return unique_sections


def extract_chapter_titles(text: str) -> list[str]:
    """Extract chapter/section titles."""
    titles = []
    # Common chapter patterns
    patterns = [
        r'^Chapter\s+\d+[:\s]+(.+)$',
        r'^CHAPTER\s+\d+[:\s]+(.+)$',
        r'^\d+\.\s+([A-Z][^.]+)$',
        r'^Part\s+\w+[:\s]+(.+)$',
    ]

    for line in text.split('\n'):
        line = line.strip()
        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                titles.append(match.group(1).strip())
                break

    return titles


def extract_numbered_lists(text: str) -> list[dict]:
    """Extract numbered lists which often contain key principles."""
    lists = []

    # Pattern for numbered items (1., 2., etc. or 1), 2), etc.)
    numbered_pattern = re.compile(
        r'(?:^|\n)\s*(\d+)[.)]\s*([^\n]+(?:\n(?!\s*\d+[.)])[^\n]+)*)',
        re.MULTILINE
    )

    matches = list(numbered_pattern.finditer(text))

    # Group consecutive numbered items
    current_list = []
    last_num = 0

    for match in matches:
        num = int(match.group(1))
        item_text = match.group(2).strip()

        if num == last_num + 1 or num == 1:
            current_list.append({"number": num, "text": item_text})
            last_num = num
        else:
            if len(current_list) >= 3:  # Only keep lists with 3+ items
                lists.append({"items": current_list.copy(), "position": match.start()})
            current_list = [{"number": num, "text": item_text}]
            last_num = num

    if len(current_list) >= 3:
        lists.append({"items": current_list, "position": matches[-1].start() if matches else 0})

    return lists


def extract_bullet_points(text: str) -> list[dict]:
    """Extract bullet point lists."""
    lists = []

    # Pattern for bullet points (-, *, or special characters)
    bullet_pattern = re.compile(
        r'(?:^|\n)\s*[-*\u2022\u25CF\u25CB\u2013\u2014]\s*([^\n]+)',
        re.MULTILINE
    )

    matches = list(bullet_pattern.finditer(text))

    # Group consecutive bullet items
    current_list = []
    last_pos = -1000

    for match in matches:
        item_text = match.group(1).strip()

        # If items are close together, they're likely the same list
        if match.start() - last_pos < 200:
            current_list.append(item_text)
        else:
            if len(current_list) >= 3:
                lists.append({"items": current_list.copy(), "position": last_pos})
            current_list = [item_text]

        last_pos = match.end()

    if len(current_list) >= 3:
        lists.append({"items": current_list, "position": last_pos})

    return lists


def extract_pros_cons(text: str, book_name: str) -> list[ProsConsList]:
    """Extract pros and cons sections."""
    pros_cons_list = []

    # Patterns to find pros/cons sections
    patterns = [
        (r'(?:pros|advantages|benefits|strengths)[:\s]*\n((?:[-*\u2022]\s*[^\n]+\n?)+)', 'pros'),
        (r'(?:cons|disadvantages|drawbacks|weaknesses)[:\s]*\n((?:[-*\u2022]\s*[^\n]+\n?)+)', 'cons'),
    ]

    # Also look for comparative sections
    comparison_pattern = re.compile(
        r'(\w+(?:\s+\w+)?)\s*(?:vs\.?|versus)\s*(\w+(?:\s+\w+)?)',
        re.IGNORECASE
    )

    # Extract sections with explicit pros/cons headers
    text_lower = text.lower()

    # Find subjects being compared
    subjects = set()
    for match in comparison_pattern.finditer(text):
        subjects.add(match.group(1).strip())
        subjects.add(match.group(2).strip())

    # Look for advantage/disadvantage mentions near technology names
    for tech in TECH_STACK_KEYWORDS.keys():
        if tech in text_lower:
            # Find context around the technology mention
            tech_pattern = re.compile(rf'\b{tech}\b[^.]*(?:advantage|benefit|strength)[^.]*\.', re.IGNORECASE)
            pros = [m.group(0) for m in tech_pattern.finditer(text)]

            tech_pattern_cons = re.compile(rf'\b{tech}\b[^.]*(?:disadvantage|drawback|weakness|limitation)[^.]*\.', re.IGNORECASE)
            cons = [m.group(0) for m in tech_pattern_cons.finditer(text)]

            if pros or cons:
                pros_cons_list.append(ProsConsList(
                    subject=tech.title(),
                    pros=pros[:5],
                    cons=cons[:5],
                    source_book=book_name
                ))

    return pros_cons_list


def extract_decision_criteria(text: str, book_name: str) -> list[DecisionCriterion]:
    """Extract decision criteria (use X when..., prefer Y if...)."""
    criteria = []

    # Extended patterns for decision criteria
    decision_patterns = [
        (r'use\s+(\w+(?:\s+\w+)?)\s+when\s+([^.]+)\.', 'general'),
        (r'prefer\s+(\w+(?:\s+\w+)?)\s+(?:if|when)\s+([^.]+)\.', 'general'),
        (r'choose\s+(\w+(?:\s+\w+)?)\s+for\s+([^.]+)\.', 'general'),
        (r'(\w+(?:\s+\w+)?)\s+is\s+(?:best|ideal|suitable|recommended)\s+for\s+([^.]+)\.', 'general'),
        (r'if\s+you\s+need\s+([^,]+),\s*(?:use|consider|prefer)\s+(\w+(?:\s+\w+)?)', 'conditional'),
        (r'for\s+([^,]+),\s*(?:use|consider|prefer)\s+(\w+(?:\s+\w+)?)', 'use_case'),
        (r'when\s+([^,]+),\s*(\w+(?:\s+\w+)?)\s+is\s+(?:recommended|preferred|better)', 'conditional'),
    ]

    for pattern, category in decision_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            groups = match.groups()
            if len(groups) >= 2:
                if category == 'conditional' or category == 'use_case':
                    condition, recommendation = groups[0], groups[1]
                else:
                    recommendation, condition = groups[0], groups[1]

                # Filter out very short or generic matches
                if len(condition) > 10 and len(recommendation) > 2:
                    criteria.append(DecisionCriterion(
                        condition=condition.strip()[:200],
                        recommendation=recommendation.strip()[:100],
                        category=category,
                        source_book=book_name
                    ))

    # Deduplicate by condition similarity
    seen_conditions = set()
    unique_criteria = []
    for c in criteria:
        key = c.condition[:50].lower()
        if key not in seen_conditions:
            seen_conditions.add(key)
            unique_criteria.append(c)

    return unique_criteria[:50]  # Limit to top 50


def extract_best_practices(text: str, book_name: str) -> list[BestPractice]:
    """Extract best practices from the text."""
    practices = []

    for keyword in BEST_PRACTICE_KEYWORDS:
        pattern = re.compile(
            rf'[^.]*\b{re.escape(keyword)}\b[^.]*\.',
            re.IGNORECASE
        )

        for match in pattern.finditer(text):
            sentence = match.group(0).strip()
            if 30 < len(sentence) < 500:  # Filter reasonable length sentences
                # Determine category based on content
                category = "general"
                sentence_lower = sentence.lower()
                if any(w in sentence_lower for w in ["scale", "performance", "throughput"]):
                    category = "performance"
                elif any(w in sentence_lower for w in ["secure", "auth", "encrypt"]):
                    category = "security"
                elif any(w in sentence_lower for w in ["reliable", "fault", "recover"]):
                    category = "reliability"
                elif any(w in sentence_lower for w in ["maintain", "test", "deploy"]):
                    category = "maintainability"
                elif any(w in sentence_lower for w in ["architect", "design", "pattern"]):
                    category = "architecture"

                practices.append(BestPractice(
                    title=sentence[:100] + "..." if len(sentence) > 100 else sentence,
                    description=sentence,
                    category=category,
                    context=keyword,
                    source_book=book_name
                ))

    # Deduplicate
    seen = set()
    unique_practices = []
    for p in practices:
        key = p.description[:50].lower()
        if key not in seen:
            seen.add(key)
            unique_practices.append(p)

    return unique_practices[:30]


def extract_anti_patterns(text: str, book_name: str) -> list[AntiPattern]:
    """Extract anti-patterns and things to avoid."""
    anti_patterns = []

    for keyword in ANTI_PATTERN_KEYWORDS:
        pattern = re.compile(
            rf'[^.]*\b{re.escape(keyword)}\b[^.]*\.',
            re.IGNORECASE
        )

        for match in pattern.finditer(text):
            sentence = match.group(0).strip()
            if 30 < len(sentence) < 500:
                # Try to extract what to do instead
                alternative = ""
                alt_patterns = [
                    r'instead[,\s]+([^.]+)',
                    r'rather[,\s]+([^.]+)',
                    r'better to\s+([^.]+)',
                    r'should\s+([^.]+)',
                ]
                for alt_pattern in alt_patterns:
                    alt_match = re.search(alt_pattern, text[match.end():match.end()+200], re.IGNORECASE)
                    if alt_match:
                        alternative = alt_match.group(1).strip()[:150]
                        break

                anti_patterns.append(AntiPattern(
                    name=keyword.title(),
                    description=sentence,
                    why_bad=f"Identified via '{keyword}' keyword",
                    alternative=alternative or "See source for recommended approach",
                    source_book=book_name
                ))

    # Deduplicate
    seen = set()
    unique_patterns = []
    for ap in anti_patterns:
        key = ap.description[:50].lower()
        if key not in seen:
            seen.add(key)
            unique_patterns.append(ap)

    return unique_patterns[:20]


def extract_scalability_recommendations(text: str, book_name: str) -> list[ScalabilityRecommendation]:
    """Extract scalability recommendations."""
    recommendations = []

    # Look for horizontal vs vertical scaling discussions
    h_patterns = [
        (r'horizontal\s+scal(?:e|ing)[^.]*\.', 'horizontal'),
        (r'scale\s+out[^.]*\.', 'horizontal'),
        (r'add(?:ing)?\s+more\s+(?:instances|servers|nodes)[^.]*\.', 'horizontal'),
    ]

    v_patterns = [
        (r'vertical\s+scal(?:e|ing)[^.]*\.', 'vertical'),
        (r'scale\s+up[^.]*\.', 'vertical'),
        (r'(?:bigger|larger)\s+(?:machine|server|instance)[^.]*\.', 'vertical'),
    ]

    for pattern, rec_type in h_patterns + v_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            sentence = match.group(0).strip()
            if 20 < len(sentence) < 400:
                # Find context (previous sentence or nearby text)
                start = max(0, match.start() - 200)
                context = text[start:match.start()].strip()

                # Identify components mentioned
                components = []
                for comp, keywords in COMPONENT_PATTERNS.items():
                    if any(kw in sentence.lower() for kw in keywords):
                        components.append(comp)

                recommendations.append(ScalabilityRecommendation(
                    scenario=context[-150:] if len(context) > 150 else context,
                    recommendation=rec_type,
                    reasoning=sentence,
                    components_affected=components or ["general"],
                    source_book=book_name
                ))

    # Deduplicate
    seen = set()
    unique_recs = []
    for r in recommendations:
        key = r.reasoning[:50].lower()
        if key not in seen:
            seen.add(key)
            unique_recs.append(r)

    return unique_recs[:20]


def extract_cost_optimization_tips(text: str, book_name: str) -> list[CostOptimizationTip]:
    """Extract cost optimization tips."""
    tips = []

    for keyword in COST_KEYWORDS:
        pattern = re.compile(
            rf'[^.]*\b{re.escape(keyword)}\b[^.]*\.',
            re.IGNORECASE
        )

        for match in pattern.finditer(text):
            sentence = match.group(0).strip()
            if 30 < len(sentence) < 500:
                # Determine savings area
                savings_area = "general"
                sentence_lower = sentence.lower()
                if any(w in sentence_lower for w in ["compute", "cpu", "instance", "server"]):
                    savings_area = "compute"
                elif any(w in sentence_lower for w in ["storage", "disk", "s3", "blob"]):
                    savings_area = "storage"
                elif any(w in sentence_lower for w in ["network", "bandwidth", "transfer"]):
                    savings_area = "network"
                elif any(w in sentence_lower for w in ["license", "subscription"]):
                    savings_area = "licensing"

                tips.append(CostOptimizationTip(
                    title=sentence[:80] + "..." if len(sentence) > 80 else sentence,
                    description=sentence,
                    savings_area=savings_area,
                    trade_offs="See source for detailed trade-off analysis",
                    source_book=book_name
                ))

    # Deduplicate
    seen = set()
    unique_tips = []
    for t in tips:
        key = t.description[:50].lower()
        if key not in seen:
            seen.add(key)
            unique_tips.append(t)

    return unique_tips[:20]


def extract_security_considerations(text: str, book_name: str) -> list[SecurityConsideration]:
    """Extract security considerations."""
    considerations = []

    for keyword in SECURITY_KEYWORDS:
        pattern = re.compile(
            rf'[^.]*\b{re.escape(keyword)}\b[^.]*\.',
            re.IGNORECASE
        )

        for match in pattern.finditer(text):
            sentence = match.group(0).strip()
            if 30 < len(sentence) < 500:
                # Determine threat addressed
                threat = "general security"
                sentence_lower = sentence.lower()
                if any(w in sentence_lower for w in ["injection", "xss", "csrf"]):
                    threat = "input validation attacks"
                elif any(w in sentence_lower for w in ["auth", "login", "password"]):
                    threat = "authentication/authorization"
                elif any(w in sentence_lower for w in ["encrypt", "tls", "ssl"]):
                    threat = "data protection"
                elif any(w in sentence_lower for w in ["ddos", "rate limit"]):
                    threat = "denial of service"
                elif any(w in sentence_lower for w in ["access", "privilege"]):
                    threat = "access control"

                considerations.append(SecurityConsideration(
                    title=sentence[:80] + "..." if len(sentence) > 80 else sentence,
                    description=sentence,
                    threat_addressed=threat,
                    implementation_notes="See source for implementation details",
                    source_book=book_name
                ))

    # Deduplicate
    seen = set()
    unique_considerations = []
    for c in considerations:
        key = c.description[:50].lower()
        if key not in seen:
            seen.add(key)
            unique_considerations.append(c)

    return unique_considerations[:25]


def extract_tech_stack_recommendations(text: str, book_name: str) -> list[TechStackRecommendation]:
    """Extract technology stack recommendations."""
    recommendations = []

    for tech, related_keywords in TECH_STACK_KEYWORDS.items():
        if tech in text.lower():
            # Find sentences mentioning this technology
            pattern = re.compile(rf'\b{tech}\b[^.]*\.', re.IGNORECASE)
            sentences = [m.group(0) for m in pattern.finditer(text)]

            if sentences:
                # Extract strengths (positive mentions)
                strengths = []
                for kw in related_keywords:
                    if any(kw in s.lower() for s in sentences):
                        strengths.append(kw)

                # Look for alternatives mentioned nearby
                alternatives = []
                for other_tech in TECH_STACK_KEYWORDS.keys():
                    if other_tech != tech:
                        for sentence in sentences:
                            if other_tech in sentence.lower():
                                alternatives.append(other_tech)

                # Find use case from context
                use_case_patterns = [
                    rf'{tech}\s+(?:is\s+)?(?:good|great|ideal|suitable)\s+for\s+([^.]+)',
                    rf'use\s+{tech}\s+(?:for|when)\s+([^.]+)',
                ]
                use_case = ""
                for uc_pattern in use_case_patterns:
                    uc_match = re.search(uc_pattern, text, re.IGNORECASE)
                    if uc_match:
                        use_case = uc_match.group(1).strip()[:100]
                        break

                if not use_case:
                    use_case = f"General {tech} usage"

                recommendations.append(TechStackRecommendation(
                    technology=tech.title(),
                    use_case=use_case,
                    strengths=strengths[:5] if strengths else related_keywords[:3],
                    weaknesses=[],  # Would need more sophisticated NLP
                    alternatives=list(set(alternatives))[:3],
                    source_book=book_name
                ))

    return recommendations


def extract_design_principles(text: str, book_name: str) -> list[DesignPrinciple]:
    """Extract high-level design principles."""
    principles = []

    # Common design principle patterns
    principle_patterns = [
        r'principle\s+(?:of\s+)?(\w+(?:\s+\w+)?)[:\s]+([^.]+\.)',
        r'the\s+(\w+)\s+principle\s+(?:states|suggests|means)[^.]*([^.]+\.)',
        r'(?:single|open|liskov|interface|dependency)\s+\w*\s*principle[^.]*\.',
        r'(?:dry|kiss|yagni|solid)[^.]*\.',
        r'separation\s+of\s+concerns[^.]*\.',
        r'loose\s+coupling[^.]*\.',
        r'high\s+cohesion[^.]*\.',
        r'don\'t\s+repeat\s+yourself[^.]*\.',
        r'keep\s+it\s+simple[^.]*\.',
    ]

    known_principles = {
        "DRY": "Don't Repeat Yourself - avoid code duplication",
        "KISS": "Keep It Simple, Stupid - favor simplicity over complexity",
        "YAGNI": "You Aren't Gonna Need It - don't add functionality until needed",
        "SOLID": "Single responsibility, Open-closed, Liskov substitution, Interface segregation, Dependency inversion",
        "Separation of Concerns": "Divide program into distinct sections with minimal overlap",
        "Loose Coupling": "Minimize dependencies between components",
        "High Cohesion": "Keep related functionality together",
        "Single Responsibility": "A class/module should have only one reason to change",
        "Open-Closed": "Open for extension, closed for modification",
        "Dependency Inversion": "Depend on abstractions, not concretions",
    }

    text_lower = text.lower()
    for name, description in known_principles.items():
        if name.lower() in text_lower or any(w in text_lower for w in name.lower().split()):
            # Find examples in the text
            examples = []
            pattern = re.compile(rf'{name}[^.]*\.\s*([^.]+\.)', re.IGNORECASE)
            for match in pattern.finditer(text):
                examples.append(match.group(1).strip()[:150])

            principles.append(DesignPrinciple(
                name=name,
                description=description,
                category="software design",
                examples=examples[:3],
                source_book=book_name
            ))

    return principles


def identify_patterns_in_text(text: str, book_name: str) -> list[DesignPattern]:
    """Identify design patterns mentioned in the text."""
    patterns = []

    # Known design patterns to look for
    known_patterns = {
        # Architectural patterns
        "Microservices": ("architectural", ["distributed systems", "independent deployment", "scalability"]),
        "Monolithic": ("architectural", ["simple deployment", "single codebase", "vertical scaling"]),
        "Layered Architecture": ("architectural", ["separation of concerns", "maintainability"]),
        "Hexagonal Architecture": ("architectural", ["ports and adapters", "testability", "flexibility"]),
        "Event-Driven": ("architectural", ["loose coupling", "async processing", "real-time"]),
        "CQRS": ("architectural", ["read/write separation", "scalability", "complex domains"]),
        "Saga Pattern": ("architectural", ["distributed transactions", "microservices", "compensation"]),

        # System design patterns
        "Load Balancer": ("system", ["high availability", "traffic distribution", "scaling"]),
        "API Gateway": ("system", ["routing", "authentication", "rate limiting"]),
        "Circuit Breaker": ("system", ["fault tolerance", "resilience", "cascading failures"]),
        "Cache": ("system", ["performance", "reduced latency", "database offload"]),
        "Message Queue": ("system", ["async communication", "decoupling", "buffering"]),
        "Database Sharding": ("system", ["horizontal scaling", "large datasets", "performance"]),
        "Replication": ("system", ["high availability", "fault tolerance", "read scaling"]),

        # Data patterns
        "Event Sourcing": ("data", ["audit trail", "temporal queries", "rebuilding state"]),
        "Data Lake": ("data", ["big data", "analytics", "raw storage"]),
        "Data Warehouse": ("data", ["analytics", "reporting", "aggregations"]),
    }

    text_lower = text.lower()
    for pattern_name, (category, use_cases) in known_patterns.items():
        if pattern_name.lower() in text_lower:
            # Find a description near the pattern mention
            pattern_re = re.compile(rf'{re.escape(pattern_name)}[^.]*\.', re.IGNORECASE)
            match = pattern_re.search(text)
            description = match.group(0) if match else f"The {pattern_name} pattern"

            # Identify related components
            components = []
            for comp_type, comp_keywords in COMPONENT_PATTERNS.items():
                for kw in comp_keywords:
                    if kw in text_lower:
                        components.append(comp_type)
                        break

            patterns.append(DesignPattern(
                name=pattern_name,
                category=category,
                description=description[:500],
                use_cases=use_cases,
                components=list(set(components))[:5],
                source_book=book_name
            ))

    return patterns


def generate_templates(patterns: list[DesignPattern]) -> list[ArchitectureTemplate]:
    """Generate architecture templates from extracted patterns."""
    templates = []

    # Template definitions based on common architectures
    template_configs = [
        {
            "name": "Simple Web App",
            "description": "Basic web application with database",
            "tier": "two-tier",
            "patterns": ["Layered Architecture"],
            "components": [
                {"type": "static_site", "name": "Frontend", "description": "React/Vue SPA"},
                {"type": "service", "name": "API Server", "description": "REST API backend"},
                {"type": "database", "name": "Database", "description": "PostgreSQL database"},
            ],
            "connections": [
                {"from": "Frontend", "to": "API Server", "protocol": "HTTPS"},
                {"from": "API Server", "to": "Database", "protocol": "TCP"},
            ],
            "scalability": "vertical",
        },
        {
            "name": "Scalable Web App",
            "description": "Load-balanced web application with caching",
            "tier": "three-tier",
            "patterns": ["Load Balancer", "Cache"],
            "components": [
                {"type": "static_site", "name": "CDN/Frontend", "description": "Static assets via CDN"},
                {"type": "service", "name": "Load Balancer", "description": "Distributes traffic"},
                {"type": "service", "name": "API Server", "description": "Stateless API instances"},
                {"type": "database", "name": "Cache", "description": "Redis cache layer"},
                {"type": "database", "name": "Primary DB", "description": "PostgreSQL with replicas"},
            ],
            "connections": [
                {"from": "CDN/Frontend", "to": "Load Balancer", "protocol": "HTTPS"},
                {"from": "Load Balancer", "to": "API Server", "protocol": "HTTP"},
                {"from": "API Server", "to": "Cache", "protocol": "TCP"},
                {"from": "API Server", "to": "Primary DB", "protocol": "TCP"},
            ],
            "scalability": "horizontal",
        },
        {
            "name": "Microservices Platform",
            "description": "Distributed microservices with event-driven communication",
            "tier": "microservices",
            "patterns": ["Microservices", "API Gateway", "Message Queue", "Event-Driven"],
            "components": [
                {"type": "service", "name": "API Gateway", "description": "Entry point for all requests"},
                {"type": "service", "name": "Auth Service", "description": "Authentication & authorization"},
                {"type": "service", "name": "User Service", "description": "User management"},
                {"type": "service", "name": "Order Service", "description": "Order processing"},
                {"type": "worker", "name": "Event Bus", "description": "Kafka/RabbitMQ message broker"},
                {"type": "database", "name": "User DB", "description": "User service database"},
                {"type": "database", "name": "Order DB", "description": "Order service database"},
            ],
            "connections": [
                {"from": "API Gateway", "to": "Auth Service", "protocol": "gRPC"},
                {"from": "API Gateway", "to": "User Service", "protocol": "gRPC"},
                {"from": "API Gateway", "to": "Order Service", "protocol": "gRPC"},
                {"from": "User Service", "to": "User DB", "protocol": "TCP"},
                {"from": "Order Service", "to": "Order DB", "protocol": "TCP"},
                {"from": "Order Service", "to": "Event Bus", "protocol": "AMQP"},
                {"from": "User Service", "to": "Event Bus", "protocol": "AMQP"},
            ],
            "scalability": "horizontal",
        },
        {
            "name": "Event Sourcing System",
            "description": "CQRS with event sourcing for complex domains",
            "tier": "microservices",
            "patterns": ["CQRS", "Event Sourcing", "Message Queue"],
            "components": [
                {"type": "service", "name": "Command API", "description": "Handles write operations"},
                {"type": "service", "name": "Query API", "description": "Handles read operations"},
                {"type": "worker", "name": "Event Store", "description": "Immutable event log"},
                {"type": "worker", "name": "Projector", "description": "Builds read models from events"},
                {"type": "database", "name": "Read DB", "description": "Optimized read replicas"},
            ],
            "connections": [
                {"from": "Command API", "to": "Event Store", "protocol": "TCP"},
                {"from": "Event Store", "to": "Projector", "protocol": "Streaming"},
                {"from": "Projector", "to": "Read DB", "protocol": "TCP"},
                {"from": "Query API", "to": "Read DB", "protocol": "TCP"},
            ],
            "scalability": "horizontal",
        },
        {
            "name": "Real-time Application",
            "description": "WebSocket-based real-time features",
            "tier": "three-tier",
            "patterns": ["Event-Driven", "Cache"],
            "components": [
                {"type": "static_site", "name": "Web Client", "description": "Real-time web app"},
                {"type": "service", "name": "WebSocket Server", "description": "Handles persistent connections"},
                {"type": "service", "name": "API Server", "description": "REST API for CRUD"},
                {"type": "database", "name": "Redis Pub/Sub", "description": "Real-time message distribution"},
                {"type": "database", "name": "Database", "description": "Persistent storage"},
            ],
            "connections": [
                {"from": "Web Client", "to": "WebSocket Server", "protocol": "WSS"},
                {"from": "Web Client", "to": "API Server", "protocol": "HTTPS"},
                {"from": "WebSocket Server", "to": "Redis Pub/Sub", "protocol": "TCP"},
                {"from": "API Server", "to": "Database", "protocol": "TCP"},
            ],
            "scalability": "horizontal",
        },
    ]

    # Match templates to found patterns
    found_pattern_names = {p.name for p in patterns}
    for config in template_configs:
        matching_patterns = [p for p in config["patterns"] if p in found_pattern_names]
        if matching_patterns:
            templates.append(ArchitectureTemplate(
                name=config["name"],
                description=config["description"],
                tier=config["tier"],
                components=config["components"],
                connections=config["connections"],
                scalability=config["scalability"],
                source_patterns=matching_patterns,
            ))

    return templates


def process_book(pdf_path: str) -> dict:
    """Process a single PDF book."""
    book_name = Path(pdf_path).stem.replace("_", " ").title()
    print(f"\nProcessing: {book_name}")

    # Extract text
    print("  Extracting text...")
    text = extract_text(pdf_path)
    print(f"  Extracted {len(text):,} characters")

    if len(text) < 100:
        print("  Warning: Very little text extracted, may be a scanned PDF")
        return {"book": book_name, "error": "Could not extract text"}

    # Find relevant sections
    print("  Finding relevant sections...")
    sections = find_relevant_sections(text, ARCHITECTURE_KEYWORDS)
    print(f"  Found {len(sections)} relevant sections")

    # Extract chapter titles
    chapters = extract_chapter_titles(text)

    # Identify design patterns
    print("  Identifying design patterns...")
    patterns = identify_patterns_in_text(text, book_name)
    print(f"  Found {len(patterns)} patterns")

    # Extract numbered lists and bullet points
    print("  Extracting lists...")
    numbered_lists = extract_numbered_lists(text)
    bullet_lists = extract_bullet_points(text)
    print(f"  Found {len(numbered_lists)} numbered lists, {len(bullet_lists)} bullet lists")

    # Extract best practices
    print("  Extracting best practices...")
    best_practices = extract_best_practices(text, book_name)
    print(f"  Found {len(best_practices)} best practices")

    # Extract anti-patterns
    print("  Extracting anti-patterns...")
    anti_patterns = extract_anti_patterns(text, book_name)
    print(f"  Found {len(anti_patterns)} anti-patterns")

    # Extract scalability recommendations
    print("  Extracting scalability recommendations...")
    scalability_recs = extract_scalability_recommendations(text, book_name)
    print(f"  Found {len(scalability_recs)} scalability recommendations")

    # Extract cost optimization tips
    print("  Extracting cost optimization tips...")
    cost_tips = extract_cost_optimization_tips(text, book_name)
    print(f"  Found {len(cost_tips)} cost tips")

    # Extract security considerations
    print("  Extracting security considerations...")
    security_considerations = extract_security_considerations(text, book_name)
    print(f"  Found {len(security_considerations)} security considerations")

    # Extract tech stack recommendations
    print("  Extracting tech stack recommendations...")
    tech_recs = extract_tech_stack_recommendations(text, book_name)
    print(f"  Found {len(tech_recs)} tech recommendations")

    # Extract pros and cons
    print("  Extracting pros/cons...")
    pros_cons = extract_pros_cons(text, book_name)
    print(f"  Found {len(pros_cons)} pros/cons sections")

    # Extract decision criteria
    print("  Extracting decision criteria...")
    decision_criteria = extract_decision_criteria(text, book_name)
    print(f"  Found {len(decision_criteria)} decision criteria")

    # Extract design principles
    print("  Extracting design principles...")
    design_principles = extract_design_principles(text, book_name)
    print(f"  Found {len(design_principles)} design principles")

    return {
        "book": book_name,
        "total_chars": len(text),
        "chapters": chapters[:20],
        "relevant_sections": len(sections),
        "patterns": [asdict(p) for p in patterns],
        "best_practices": [asdict(bp) for bp in best_practices],
        "anti_patterns": [asdict(ap) for ap in anti_patterns],
        "scalability_recommendations": [asdict(sr) for sr in scalability_recs],
        "cost_optimization_tips": [asdict(ct) for ct in cost_tips],
        "security_considerations": [asdict(sc) for sc in security_considerations],
        "tech_stack_recommendations": [asdict(tr) for tr in tech_recs],
        "pros_cons": [asdict(pc) for pc in pros_cons],
        "decision_criteria": [asdict(dc) for dc in decision_criteria],
        "design_principles": [asdict(dp) for dp in design_principles],
        "numbered_lists": numbered_lists[:10],
        "bullet_lists": [{"items": bl["items"][:10]} for bl in bullet_lists[:5]],
        "sample_excerpts": [s["text"][:300] for s in sections[:10]],
    }


def main():
    books_dir = Path("/Users/jamosa/Downloads/relevant-books")
    output_dir = Path("/Users/jamosa/Development/brick-by-brick/data")
    output_dir.mkdir(exist_ok=True)

    print("=" * 60)
    print("Brick Studio - Enhanced Design Knowledge Extractor")
    print("=" * 60)

    # Process all PDFs
    all_results = []
    all_patterns = []
    all_best_practices = []
    all_anti_patterns = []
    all_scalability_recs = []
    all_cost_tips = []
    all_security_considerations = []
    all_tech_recs = []
    all_pros_cons = []
    all_decision_criteria = []
    all_design_principles = []

    pdf_files = sorted(books_dir.glob("*.pdf"))
    print(f"\nFound {len(pdf_files)} PDF files to process")

    for pdf_path in pdf_files:
        result = process_book(str(pdf_path))
        all_results.append(result)

        if "patterns" in result:
            all_patterns.extend([
                DesignPattern(**p) for p in result["patterns"]
            ])

        if "best_practices" in result:
            all_best_practices.extend([
                BestPractice(**bp) for bp in result["best_practices"]
            ])

        if "anti_patterns" in result:
            all_anti_patterns.extend([
                AntiPattern(**ap) for ap in result["anti_patterns"]
            ])

        if "scalability_recommendations" in result:
            all_scalability_recs.extend([
                ScalabilityRecommendation(**sr) for sr in result["scalability_recommendations"]
            ])

        if "cost_optimization_tips" in result:
            all_cost_tips.extend([
                CostOptimizationTip(**ct) for ct in result["cost_optimization_tips"]
            ])

        if "security_considerations" in result:
            all_security_considerations.extend([
                SecurityConsideration(**sc) for sc in result["security_considerations"]
            ])

        if "tech_stack_recommendations" in result:
            all_tech_recs.extend([
                TechStackRecommendation(**tr) for tr in result["tech_stack_recommendations"]
            ])

        if "pros_cons" in result:
            all_pros_cons.extend([
                ProsConsList(**pc) for pc in result["pros_cons"]
            ])

        if "decision_criteria" in result:
            all_decision_criteria.extend([
                DecisionCriterion(**dc) for dc in result["decision_criteria"]
            ])

        if "design_principles" in result:
            all_design_principles.extend([
                DesignPrinciple(**dp) for dp in result["design_principles"]
            ])

    # Deduplicate patterns
    unique_patterns = {}
    for p in all_patterns:
        if p.name not in unique_patterns:
            unique_patterns[p.name] = p
        else:
            # Merge use cases and components
            existing = unique_patterns[p.name]
            existing.use_cases = list(set(existing.use_cases + p.use_cases))
            existing.components = list(set(existing.components + p.components))

    # Deduplicate design principles
    unique_principles = {}
    for dp in all_design_principles:
        if dp.name not in unique_principles:
            unique_principles[dp.name] = dp
        else:
            # Merge examples
            existing = unique_principles[dp.name]
            existing.examples = list(set(existing.examples + dp.examples))[:5]

    # Deduplicate tech recommendations by technology
    unique_tech_recs = {}
    for tr in all_tech_recs:
        if tr.technology not in unique_tech_recs:
            unique_tech_recs[tr.technology] = tr
        else:
            # Merge strengths and alternatives
            existing = unique_tech_recs[tr.technology]
            existing.strengths = list(set(existing.strengths + tr.strengths))[:7]
            existing.alternatives = list(set(existing.alternatives + tr.alternatives))[:5]

    # Generate templates
    print("\n" + "=" * 60)
    print("Generating architecture templates...")
    templates = generate_templates(list(unique_patterns.values()))
    print(f"Generated {len(templates)} templates")

    # Save main results
    output = {
        "extraction_summary": {
            "total_books": len(all_results),
            "total_patterns": len(unique_patterns),
            "total_templates": len(templates),
            "total_best_practices": len(all_best_practices),
            "total_anti_patterns": len(all_anti_patterns),
            "total_scalability_recs": len(all_scalability_recs),
            "total_cost_tips": len(all_cost_tips),
            "total_security_considerations": len(all_security_considerations),
            "total_tech_recommendations": len(unique_tech_recs),
            "total_decision_criteria": len(all_decision_criteria),
            "total_design_principles": len(unique_principles),
        },
        "books": all_results,
        "patterns": [asdict(p) for p in unique_patterns.values()],
        "templates": [asdict(t) for t in templates],
        "best_practices": [asdict(bp) for bp in all_best_practices],
        "anti_patterns": [asdict(ap) for ap in all_anti_patterns],
        "scalability_recommendations": [asdict(sr) for sr in all_scalability_recs],
        "cost_optimization_tips": [asdict(ct) for ct in all_cost_tips],
        "security_considerations": [asdict(sc) for sc in all_security_considerations],
        "tech_stack_recommendations": [asdict(tr) for tr in unique_tech_recs.values()],
        "decision_criteria": [asdict(dc) for dc in all_decision_criteria],
        "design_principles": [asdict(dp) for dp in unique_principles.values()],
    }

    output_file = output_dir / "design_knowledge.json"
    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nResults saved to: {output_file}")

    # Save templates in a format ready for Brick Studio
    templates_file = output_dir / "architecture_templates.json"
    with open(templates_file, "w") as f:
        json.dump({
            "version": "1.0",
            "templates": [asdict(t) for t in templates],
        }, f, indent=2)

    print(f"Templates saved to: {templates_file}")

    # Save structured design principles file
    principles_output = {
        "version": "1.0",
        "summary": {
            "total_principles": len(unique_principles),
            "total_best_practices": len(all_best_practices),
            "total_anti_patterns": len(all_anti_patterns),
            "total_decision_criteria": len(all_decision_criteria),
            "total_tech_recommendations": len(unique_tech_recs),
            "sources": list(set(r["book"] for r in all_results if "book" in r)),
        },
        "design_principles": [asdict(dp) for dp in unique_principles.values()],
        "best_practices": {
            "architecture": [asdict(bp) for bp in all_best_practices if bp.category == "architecture"],
            "performance": [asdict(bp) for bp in all_best_practices if bp.category == "performance"],
            "security": [asdict(bp) for bp in all_best_practices if bp.category == "security"],
            "reliability": [asdict(bp) for bp in all_best_practices if bp.category == "reliability"],
            "maintainability": [asdict(bp) for bp in all_best_practices if bp.category == "maintainability"],
            "general": [asdict(bp) for bp in all_best_practices if bp.category == "general"],
        },
        "anti_patterns": [asdict(ap) for ap in all_anti_patterns],
        "decision_criteria": {
            "categorized": {},
        },
        "technology_recommendations": {
            tech: {
                "use_case": tr.use_case,
                "strengths": tr.strengths,
                "weaknesses": tr.weaknesses,
                "alternatives": tr.alternatives,
                "sources": [tr.source_book],
            }
            for tech, tr in unique_tech_recs.items()
        },
        "scalability_guidance": {
            "horizontal": [asdict(sr) for sr in all_scalability_recs if sr.recommendation == "horizontal"],
            "vertical": [asdict(sr) for sr in all_scalability_recs if sr.recommendation == "vertical"],
        },
        "cost_optimization": [asdict(ct) for ct in all_cost_tips],
        "security_considerations": [asdict(sc) for sc in all_security_considerations],
        "pros_cons_comparisons": [asdict(pc) for pc in all_pros_cons],
    }

    # Categorize decision criteria
    for dc in all_decision_criteria:
        if dc.category not in principles_output["decision_criteria"]["categorized"]:
            principles_output["decision_criteria"]["categorized"][dc.category] = []
        principles_output["decision_criteria"]["categorized"][dc.category].append(asdict(dc))

    principles_file = output_dir / "design_principles.json"
    with open(principles_file, "w") as f:
        json.dump(principles_output, f, indent=2)

    print(f"Design principles saved to: {principles_file}")

    # Print summary
    print("\n" + "=" * 60)
    print("EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"\nBooks processed: {len(all_results)}")
    print(f"Unique patterns found: {len(unique_patterns)}")
    print(f"Templates generated: {len(templates)}")
    print(f"Best practices: {len(all_best_practices)}")
    print(f"Anti-patterns: {len(all_anti_patterns)}")
    print(f"Scalability recommendations: {len(all_scalability_recs)}")
    print(f"Cost optimization tips: {len(all_cost_tips)}")
    print(f"Security considerations: {len(all_security_considerations)}")
    print(f"Tech stack recommendations: {len(unique_tech_recs)}")
    print(f"Decision criteria: {len(all_decision_criteria)}")
    print(f"Design principles: {len(unique_principles)}")

    print("\nPatterns by category:")
    categories = {}
    for p in unique_patterns.values():
        categories.setdefault(p.category, []).append(p.name)
    for cat, names in categories.items():
        print(f"  {cat}: {', '.join(names)}")

    print("\nBest practices by category:")
    bp_categories = {}
    for bp in all_best_practices:
        bp_categories.setdefault(bp.category, 0)
        bp_categories[bp.category] += 1
    for cat, count in sorted(bp_categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    print("\nTechnology recommendations:")
    for tech in sorted(unique_tech_recs.keys()):
        tr = unique_tech_recs[tech]
        print(f"  {tech}: {tr.use_case[:60]}...")

    print("\nDesign principles found:")
    for dp in unique_principles.values():
        print(f"  - {dp.name}")

    print("\nTemplates:")
    for t in templates:
        print(f"  - {t.name} ({t.tier}): {len(t.components)} components")

    print("\n" + "=" * 60)
    print("Output files:")
    print(f"  - {output_file}")
    print(f"  - {templates_file}")
    print(f"  - {principles_file}")
    print("=" * 60)


if __name__ == "__main__":
    main()
