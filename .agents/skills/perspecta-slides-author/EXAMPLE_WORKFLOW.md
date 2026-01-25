# Example Workflow: Using the Perspecta Slides Author Skill

## Scenario: Tech Startup Pitch

### 📋 User Provides Briefing

```
PRESENTATION BRIEFING

Topic: ClimateTrace — Real-time emissions tracking platform
Goal: Secure Series A funding from climate tech VCs
Duration: 15 minutes
Audience: 5 investors, tech-savvy, climate-conscious
Key Points:
  - Climate data is fragmented and slow (companies don't know their emissions)
  - Our AI aggregates emissions from 50+ data sources in real-time
  - 3 pilot customers saved $2M in a year by optimizing emissions
  - We're expanding to tier 1 companies (Ford, Walmart, etc.)
Dramaturgy: Pitch style. Open with a stark problem statement, show our insight, 
prove it with customer stories, close with ambitious vision.
Desired Theme: default
```

---

### 🤖 Skill Analyzes & Asks Questions

**Skill Recognition**:
- ✅ Pattern: **PITCH** (15 min, investor audience, funding goal)
- ✅ Optimal slide count: 6-8 slides (~2 min per slide)
- ✅ Style: Bold openings, emotional proof, forward momentum

**Clarifying Questions**:
1. Should we emphasize "first-mover advantage" or "technical superiority"? → Investors like both, suggest weaving both.
2. Do you have logos of pilot customers? → Skill will design slide to use them; if not, will suggest generic icons.
3. Any specific visuals you want (e.g., your co-founders)? → Recommend co-founder photo on "Why us" slide.
4. Tone: Optimistic/ambitious or realistic/grounded? → For climate tech VCs, suggest "ambitious yet evidence-based"

---

### 📐 Skill Structures Presentation

**Slide Breakdown**:

| # | Slide | Layout | Duration | Purpose |
|---|-------|--------|----------|---------|
| 1 | ClimateTrace: Real-time Emissions Tracking | `title` | 30s | Hook + intro |
| 2 | The Problem | `caption` | 90s | Stark visualization of fragmented data problem |
| 3 | Our Insight | `2-columns` | 90s | Traditional approach vs. our approach |
| 4 | How It Works | `2-columns-1+2` | 90s | Concept (real-time) + tech stack overview |
| 5 | Pilot Success | `3-columns` | 120s | Three customer case studies (names, results) |
| 6 | Market Opportunity | `full-image` | 60s | Cinematic image of sustainable future |
| 7 | Why ClimateTrace | `half-image` | 120s | Team photo + credentials/track record |
| 8 | The Ask | `cover` | 30s | Funding round, use of capital, contact |

**Total**: 8 slides, ~11 minutes of content + 4 minutes Q&A = 15 minutes ✅

---

### 🖼️ Skill Suggests Images

**Slide 2 (Problem)**
- Unsplash searches: "fragmented data", "confusing charts", "corporate office chaos"
- Tone: Chaotic, overwhelming, urgent
- Photographer: Avoid cheerful; seek realistic, business chaos
- Image idea: Messy desk with too many papers/screens

**Slide 6 (Market Opportunity)**
- Unsplash searches: "renewable energy sunset", "solar panels landscape", "wind farm"
- Tone: Hopeful, ambitious, cinematic
- Photographer: Consistent with pitch energy; beautiful but grounded
- Image idea: Wind turbines at golden hour (aspirational, not naive)

**Slide 7 (Why ClimateTrace)**
- Type: Personal photo of co-founders (will user provide?) OR suggest: "diverse tech team", "climate scientists", "startup founders"
- Tone: Credible, approachable, accomplished
- Image idea: Professional headshots or team in action

---

### ✍️ Skill Writes Complete Markdown

```markdown
---
title: ClimateTrace — Real-time Emissions Tracking
author: [Your Name], ClimateTrace Co-founder
theme: default

# Typography
titleFont: Inter
bodyFont: Georgia
textScale: 1.0

# Header/Footer
headerRight: ClimateTrace Series A Pitch
footerRight: '{{slideNumber}} / 8'

# Presentation Settings
aspectRatio: '16:9'
transition: fade
mode: light
---

# ClimateTrace

Real-time emissions tracking for enterprise climate action.

Every company wants to reduce emissions. None of them know how.

(30 seconds)

---

## The Problem

**Companies are flying blind on emissions**

- Climate data is fragmented across 50+ sources
- Updates take months, not hours
- Manual tracking = missed optimization opportunities
- Regulatory reporting is painful and incomplete

(Unsplash: "fragmented data", "confusing analytics", "overwhelmed corporate")

Most companies have no visibility into where emissions come from. They can't act on what they don't measure. This is where we come in.

(1.5 minutes)

---

## Our Insight

LEFT: Traditional Approach | RIGHT: ClimateTrace

**Traditional**
- Consultant audit (6 months)
- Spreadsheets (manual updates)
- Blind spots (80% of emissions missed)
- $200k+ cost

**ClimateTrace**
- AI ingests all data streams
- Real-time dashboards
- Complete visibility (all scope 1, 2, 3)
- $50k/year SaaS

Real-time changes everything. You can't optimize emissions you can't see in real-time.

(1.5 minutes)

---

## How It Works

LEFT: Real-Time Data Aggregation | RIGHT: The Tech

LEFT concept: We pull data from supply chain records, energy grids, travel platforms, employee reporting. Everything feeds into our engine.

RIGHT detail:
- Machine learning (data normalization)
- NLP (document parsing)
- Computer vision (meter readings)
- Real-time dashboard API

The magic is in the integration. Every data source speaks a different language; we translate them all.

(1.5 minutes)

---

## Pilot Results

**Piloted with 3 Fortune 500 companies**

LEFT: GreenCorp | CENTER: MakeStuff Inc. | RIGHT: DeliveryNow

**GreenCorp**
- Reduced emissions 15% in 6 months
- Saved $2.1M in energy costs
- Identified hidden supply chain waste

**MakeStuff Inc.**
- Discovered scope 3 emissions (90% of total)
- Redirected procurement to cleaner suppliers
- ROI: 8 months

**DeliveryNow**
- Cut fleet emissions 22%
- Real-time route optimization
- Improved delivery speed + reduced carbon

Our pilots aren't just proof of concept—they're proof of economics. These companies didn't adopt ClimateTrace for ESG; they adopted it because it saves money.

(2 minutes)

---

## The Market Opportunity

(Full-screen image: Wind farm at sunset, Unsplash "renewable energy landscape" or "solar panels aerial view")

The global market for enterprise carbon management: $25B by 2030.

We're not selling carbon tracking; we're selling carbon *action*. The market is accelerating.

(1 minute)

---

## Why ClimateTrace

LEFT: [Team photo: co-founders in lab/office setting] | RIGHT: Why We Win

**The Team**
- CEO Sarah Chen: Former McKinsey carbon practice lead (10 years climate consulting)
- CTO Rajesh Patel: Ex-Google BigQuery engineer (leading climate data infrastructure)
- COO Maria González: Sustainability director at Shell (insider knowledge)

**Why we're different**
- Deep domain expertise meets silicon valley execution
- We know the problems because we've lived them
- First-mover advantage in AI-powered emissions: patent-pending approach
- Advisor board: [names of 3-4 respected climate/tech leaders]

We're not climate enthusiasts coding on nights/weekends. We're climate experts who've committed to solving this at scale.

(2 minutes)

---

## The Ask

ClimateTrace is raising **$8M Series A** to:
- Expand sales & customer success (SMB → Enterprise)
- Build out platform features (automated interventions, industry benchmarking)
- Develop vertical-specific solutions (manufacturing, logistics, finance)

**With your help**, we'll capture 5% of the $25B market and make carbon action the default for every enterprise.

Contact: sarah@climatetrace.io
Website: climatetrace.io

(30 seconds)

---
```

---

### 📊 Skill Includes Timing Guide

```
Slide 1: 30 seconds (crisp opening, let it breathe)
Slide 2: 90 seconds (set the problem emotionally, not just intellectually)
Slide 3: 90 seconds (make the comparison visceral)
Slide 4: 90 seconds (tech depth without overwhelming)
Slide 5: 120 seconds (three stories = three proof points, pace them)
Slide 6: 60 seconds (let the image do the work, you fill silence with vision)
Slide 7: 120 seconds (credibility + why you matter, personal + credentials)
Slide 8: 30 seconds (clear ask, no ambiguity)

Total: ~11 minutes speaking → leaves 4 minutes for questions
```

---

### ✅ Skill's Output Checklist

- ✅ **Pattern identified**: PITCH (investor pitch, 15 min)
- ✅ **Slide count realistic**: 8 slides for 15 min = ~1.5 min average ✓
- ✅ **Layout logic**: Problem (caption) → Comparison (2-col) → Tech (1+2) → Proof (3-col) → Vision (full-image) → Team (half-image) → Ask (cover) ✓
- ✅ **Image integration**: Thematic consistency (problem = chaos, market = hope, team = credibility) ✓
- ✅ **Speaker notes complete**: Timing guidance, talking points, emotional cues ✓
- ✅ **Narrative flow**: Hook problem → Show we're different → Prove it works → Paint vision → Prove credibility → Ask for money ✓
- ✅ **Markdown clean**: Proper structure, no orphaned bullets, clear hierarchy ✓
- ✅ **Frontmatter complete**: Title, author, theme, typography, header/footer ✓
- ✅ **Ready to present**: Copy into Obsidian, open in Perspecta Slides, present tomorrow ✓

---

### 🎯 What the User Does Next

1. **Open the Markdown file in Obsidian**
2. **Add/refine images**: Download from Unsplash based on skill's suggestions, replace placeholders
3. **Optional**: Adjust speaker notes to match your delivery style
4. **Open in Perspecta Slides**: Use the thumbnail navigator to review slide flow
5. **Practice**: Deliver once, refine timing as needed
6. **Present**: Connect to projector, open presentation window, use presenter view for notes

**Result**: Professional, investor-ready pitch deck created in ~30 minutes instead of 3-4 hours.

---

## Why This Workflow Works

✨ **Patterns guide structure** → No blank-page syndrome  
✨ **Layouts carry meaning** → Every layout teaches something  
✨ **Timing is baked in** → Realistic, achievable pacing  
✨ **Images are strategic** → Cohesive, professional aesthetic  
✨ **Notes are detailed** → Presenter can be natural and confident  
✨ **Markdown is clean** → Easy to tweak and refine  
✨ **Output is immediate** → Ready to use, not a starting point  

---

## Comparing Without the Skill

**Traditional PowerPoint approach** (3-4 hours):
1. Blank canvas paralysis
2. Manual layout trying different arrangements
3. Generic stock images / irrelevant images
4. Minimal speaker notes
5. Last-minute timing surprises during rehearsal
6. Repeated refinements

**With Perspecta Slides Author skill** (~30 minutes):
1. Skill asks structure → pattern identified
2. Skill suggests layouts → informed choices
3. Skill recommends images → cohesive aesthetics
4. Skill writes notes → detailed and natural
5. Timing built in → rehearsal confirms pacing
6. Output refined and ready

---

## Next: Your Briefing

Ready to try it? Provide:
- Presentation topic & goal
- Duration and audience
- Key points / outline
- Desired dramaturgy (style, tone, narrative pattern)
- Optional: theme preference, any specific visuals

The skill will deliver a complete Markdown file ready to present.
