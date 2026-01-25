---
name: perspecta-slides-author
description: Transforms presentation briefings into beautifully structured Perspecta Slides Markdown files with intelligent layout selection, image suggestions, and speaker notes. Use when authoring presentations from briefings or outlines.
---

# Perspecta Slides Author

Converts presentation briefings into professional Perspecta Slides Markdown files. Applies intelligent layout selection, Unsplash image suggestions, and detailed speaker notes based on proven presentation patterns.

## Quick Start

Provide a presentation briefing with these elements:

- **Topic/Title** - What's the presentation about?
- **Goal** - What should the audience understand, believe, or do?
- **Duration** - How long is the presentation? (e.g., 15 minutes, 45 minutes)
- **Audience** - Who are they?
- **Key Points** - Main ideas, outline, or structure
- **Dramaturgy** - Narrative style (pitch, academic, how-to, journey) and any specific tone/pacing notes
- **Theme** (optional) - Which Perspecta Slides theme? (default, kyoto, zurich, berlin, minimal)

## Workflow

### 1. ANALYZE THE BRIEFING

Identify the **presentation pattern**:
- **PITCH** - Convince people of an idea/product (5-20 min, energetic)
- **ACADEMIC ARGUMENT** - Present research findings (15-45 min, evidence-based)
- **STRUCTURED COLLECTION** - Teach a framework or methodology (20-45 min, organized)
- **NARRATIVE/STORY** - Take audience on a journey (10-30 min, emotional arc)

Determine optimal **slide count** and **pacing**:
- Pitch: ~1 slide per 1-2 minutes (punchier)
- Academic: ~1 slide per 2-3 minutes (more dense)
- Structured: ~1 slide per 2-3 minutes per section
- Narrative: ~1 slide per 1-2 minutes (visual rhythm)

### 2. STRUCTURE THE PRESENTATION

Create a logical **slide sequence**:

1. **Title slide** (`title` layout) - Presentation name + presenter
2. **Section dividers** (`section` layout) - Major topic shifts
3. **Content slides** - Mix of text, columns, and images (see Layout Selection below)
4. **Closing slide** (`cover` layout) - Thank you, call to action

### 3. SELECT LAYOUTS FOR EACH SLIDE

Apply these layout rules:

**Text-heavy content** → `1-column`
- Dense explanations, methodologies, detailed definitions
- Bullet lists that need breathing room

**Comparisons & contrasts** → `2-columns`
- Then vs Now, Pro vs Con, Approach A vs B
- First take vs Second take (reframe)

**Intro + main content** → `2-columns-1+2`
- Narrow left (concept, question, key term)
- Wide right (explanation, evidence, list)

**List + interpretation** → `2-columns-2+1`
- Wide left (5-point list, timeline, narrative)
- Narrow right (visual summary, interpretation, key insight)

**Three equally important ideas** → `3-columns`
- Natural grouping of three concepts
- Philosophy: "Often good things are three!"

**Single image + context** → `caption`
- Full-width image with interpretive title and caption
- Proof points, real-world examples

**Visual only** → `full-image`
- Mood, emotional impact, establishing context
- Minimal or no text

**Image + text side-by-side** → `half-image`
- Vertical split (e.g., product mockup + features)

**Image + text stacked** → `half-image-horizontal`
- Horizontal stacking (e.g., quote on top, photo below)

### 4. SUGGEST IMAGES

For each image layout (`caption`, `full-image`, `half-image`, `half-image-horizontal`):

1. **Identify the emotional tone** needed for that slide
2. **Suggest 3-5 Unsplash search keywords** that would yield relevant images
3. **Note aesthetic preferences**: color palette, composition style, mood
4. **Recommend a photographer** if images need consistency across multiple slides

In the markdown output, use **image placeholder syntax**:
```markdown
![[IMAGE: unsplash-search-term-1 | unsplash-search-term-2]]
```

Add speaker notes with image context:
```
(Suggest searching Unsplash for "team collaboration" or "diverse group discussing ideas")
```

### 5. WRITE SPEAKER NOTES

For each slide, add speaker notes that include:

- **Timing guidance** - How long should this slide take? `(1-2 minutes)`
- **Talking points** - What should presenter emphasize?
- **Nuance** - Details that don't appear on slide
- **Stories/examples** - Anecdotes that illustrate concepts
- **Transitions** - How to bridge to the next slide

Speaker notes appear as regular paragraphs between slide content in Markdown:

```markdown
## Slide Heading

**Visible bullet points go here**

Detailed speaker notes go here. This paragraph is only visible to the presenter in speaker notes, not on the actual slide. Explain the nuance, add context, provide examples.

(1-2 minutes)
```

### 6. FORMAT WITH MARKDOWN

Use Markdown features to structure content:

- **Bold** - Key terms, important conclusions
- **Italic** - Quotes, references, alternative framings
- **Blockquotes** - Testimonials, key statements, external voices
- **Lists** - Bullet or numbered (2-5 items per slide for readability)
- **Code blocks** - Technical content, examples
- **Tables** - Comparisons (use sparingly; columns better for visual contrast)

Example:
```markdown
## Three Research Findings

- **Finding 1**: [summary]
- **Finding 2**: [summary]
- **Finding 3**: [summary]

This research validates our hypothesis. The evidence is strongest for Finding 2, which contradicts previous assumptions. Finding 3 opens new research questions.

(1.5 minutes)
```

### 7. CREATE FRONTMATTER

Add YAML frontmatter at the top with presentation metadata:

```yaml
---
title: Your Presentation Title
author: Your Name
theme: default

# Optional: Customize typography/colors
titleFont: Inter
bodyFont: Georgia
textScale: 1.0

# Optional: Add header/footer
headerLeft: Company Name
footerRight: '{{slideNumber}}'

# Optional: Presentation settings
aspectRatio: '16:9'
transition: fade
mode: light
---
```

## Content Guidelines by Presentation Pattern

### PITCH (Idea/Product)

- **Opening** (`title`): Presenter intro + hook question
- **Problem** (`1-column` or `caption`): What's broken? Use image to show pain point
- **Solution** (`2-columns` or `3-columns`): How does your idea solve it?
- **Why you** (`half-image`): Credibility + founder story
- **Social proof** (`caption`): Real-world example or user testimonial
- **Call to action** (`cover`): Clear next step

**Speaker notes**: Punchy, energetic. Build momentum. Use stories and emotion.

**Pacing**: ~1 slide per 1-2 minutes. Total: 5-10 slides for 15-minute pitch.

---

### ACADEMIC ARGUMENT (Research)

- **Thesis** (`title`): Research question + hypothesis
- **Background** (`1-column` + `2-columns`): What's known? What's the gap?
- **Methodology** (`2-columns-1+2`): How did you research this?
- **Findings** (`3-columns` or `caption` + charts): What did you discover?
- **Implications** (`2-columns`): Why does it matter? What's next?
- **Closing** (`cover`): Thank you, open questions

**Speaker notes**: Detailed. Include caveats, limitations, related work. Anticipate questions.

**Pacing**: ~1 slide per 2-3 minutes. Total: 10-20 slides for 30-minute talk.

---

### STRUCTURED COLLECTION (Framework/How-To)

- **Overview** (`title` + `1-column`): What's the framework? Why should they care?
- **Section intros** (`section`): Each major section gets a divider
- **Element deep-dive** (`2-columns`, `3-columns`, `caption`): One concept per slide/set
- **Connections** (`2-columns-1+2`): How do pieces relate?
- **Application** (`1-column` + `caption`): How to use it? Real-world examples
- **Closing** (`cover`): Summary + next steps

**Speaker notes**: Moderate detail. Focus on practical application. Answer "why should I care?"

**Pacing**: ~1 slide per 2 minutes per element. Total: 12-20 slides for 25-minute tutorial.

---

### NARRATIVE/STORY (Case Study, Journey)

- **Setting** (`title` + `caption`): Where do we start? Establish mood with image
- **Conflict** (`1-column` or `2-columns`): What went wrong? What question emerged?
- **Exploration** (`2-columns-1+2`, `caption`): What did we try? What did we discover?
- **Turning point** (`full-image` or `caption`): Visual/emotional climax
- **Resolution** (`2-columns`): What changed? What's different now?
- **Reflection** (`1-column` + `cover`): What does this mean? What did we learn?

**Speaker notes**: Narrative flow. Build tension, release, and resolution. Use vivid language.

**Pacing**: ~1 slide per 1.5 minutes (visual rhythm). Total: 10-15 slides for 20-minute story.

---

## Image Aesthetic Consistency

When suggesting images, maintain a **consistent visual language** across the presentation:

### By Presentation Style

**PITCH**:
- Bright, energetic, forward-moving
- Keywords: "team", "innovation", "startup", "growth", "launch"
- Photography style: Dynamic, action-oriented, diverse people
- Color: Warm tones, vibrant (reds, oranges, blues)

**ACADEMIC**:
- Professional, authoritative, grounded
- Keywords: "research", "laboratory", "data", "analysis", "discovery"
- Photography style: Clean, composed, scientific
- Color: Neutral, sophisticated, cool (blues, grays, blacks)

**STRUCTURED**:
- Clear, organized, hierarchical
- Keywords: "framework", "process", "blueprint", "connected", "organized"
- Photography style: Minimalist, architectural, diagrammatic
- Color: Consistent palette (monochromatic or analogous)

**NARRATIVE**:
- Emotional, evocative, cinematic
- Keywords: Related to the story's theme (journey, struggle, transformation)
- Photography style: Mood-driven, often nature or human-centered
- Color: Thematic palette (warm for hope, cool for mystery, etc.)

**Pro tip**: On Unsplash, click the photographer's name to see their portfolio. Use 2-3 images from the same photographer for maximum visual cohesion.

---

## Checklist Before Output

Before generating the final Markdown file:

- [ ] **Pattern identified**: Is the presentation structure aligned with one of the four patterns?
- [ ] **Slide count realistic**: Can all content fit in the allocated time?
- [ ] **Layout logic**: Is each layout choice justified by content type?
- [ ] **Image integration**: Are images (via Unsplash search terms) thematically consistent?
- [ ] **Speaker notes complete**: Does each slide have timing and talking points?
- [ ] **Narrative flow**: Do slides progress logically with smooth transitions?
- [ ] **Markdown clean**: Proper formatting, no orphaned bullets, clear hierarchy
- [ ] **Frontmatter present**: Title, author, theme, and key settings specified
- [ ] **Ready to present**: Could presenter pick this up and present tomorrow?

---

## Output Format

Generate a **complete Markdown file** ready for Perspecta Slides:

```markdown
---
title: [Presentation Title]
author: [Presenter Name]
theme: [default|kyoto|zurich|berlin|minimal]
---

# Opening Title

Brief subtitle or hook.

---

## Section Title

Content and speaker notes...

---

[etc.]
```

Include:
- YAML frontmatter with all relevant metadata
- Slide separators (`---`)
- Appropriate layout classes in frontmatter comments if needed
- Clear speaker notes between content sections
- Image placeholder syntax for Unsplash searches
- All content formatted and structured

The file should be **copy-paste ready** into Obsidian and immediately presentable.

---

## Example: Mini Pitch Presentation

**Briefing**: 12-minute pitch for a new app that connects people with local food sustainability projects.

**Output**:

```markdown
---
title: Harvest Local — Connecting People to Food Sustainability
author: Sarah Chen
theme: default
---

# Harvest Local

Connecting people with local food sustainability.

In 15 seconds, tell them why this matters to you.

---

## The Problem

- **1.3 billion tons** of food wasted annually
- People want to help but **don't know how**
- Local farms lack volunteers and customer awareness

Pause. Let this sink in. Then share: "I grew up watching my grandma's farm struggle..."

(1 minute)

---

## The Solution

LEFT: Our App | RIGHT: What You Can Do
[2-columns layout]

- Discover local farms
- Volunteer for harvests
- Buy surplus directly

Explain the "why" behind each feature. How do these address the problems above?

(2 minutes)

---

## Real Impact

![[IMAGE: local-farm-volunteers | community-garden | people-harvesting]]

Caption: "Last year, volunteers through apps like ours prevented 50,000 tons of food waste."

Show this impact. Let the image do the work.

(30 seconds)

---

## Why Now

- Consumer interest in sustainability is up 85% in 2 years
- Local agriculture is having a renaissance
- Technology finally makes farm-to-person connection easy

This is your moment to establish urgency and timing.

(1.5 minutes)

---

## Join Us

What's next? How can they help?

Contact: sarah@harvestlocal.com
Website: harvestlocal.com

(30 seconds)
```

---

## Tips for Great Presentations

1. **One idea per slide** - Don't overload. Visual breathing room matters.
2. **Show, don't tell** - Use images, not bullet point paragraphs.
3. **Build tension** - Presentations are stories. Setup → complication → resolution.
4. **Contrast for emphasis** - Use two-column layouts to show differences, not just information.
5. **Speaker notes are your safety net** - Detailed notes let you present naturally without reading slides.
6. **Consistent imagery** - Aesthetic unity = professional presentation.
7. **Test the timing** - Actually deliver it. Adjust pacing based on real speaking.

---

## Perspecta Slides Quick Reference

**Layouts**:
- `title` - Centered title slide
- `section` - Section divider
- `cover` - Closing slide
- `1-column` - Single column text
- `2-columns` - Two equal columns
- `2-columns-1+2` - Narrow left, wide right
- `2-columns-2+1` - Wide left, narrow right
- `3-columns` - Three equal columns
- `caption` - Image with title bar and caption
- `full-image` - Edge-to-edge image
- `half-image` - Vertical split (image + text)
- `half-image-horizontal` - Horizontal split

**Markdown syntax**:
- Slides separated by `---`
- Headings: `#` or `##` for slide title
- Speaker notes: Regular paragraphs between content
- Images: `![[image-file]]` or `![](url)`

**For more details**: See CONCEPT.md in this skill directory for comprehensive best practices, decision trees, and presentation patterns.
