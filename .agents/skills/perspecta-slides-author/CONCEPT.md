# Perspecta Slides Author - Concept & Best Practices

## Overview

The Perspecta Slides Author skill transforms presentation briefings into beautiful, well-structured Markdown presentations. It applies proven design patterns, intelligent layout selection, and consistent visual storytelling.

**Input**: Presentation briefing (goals, duration, key points, dramaturgy)  
**Output**: Markdown file ready to present in Perspecta Slides

---

## Part 1: Presentation Patterns

Different presentations follow different structures. Identify the pattern first, then apply appropriate layout and pacing rules.

### Pattern 1: PITCH (Idea/Product Pitch)
**Duration**: 5-20 minutes  
**Goal**: Convince audience to care about an idea, product, or service

**Typical structure**:
1. Hook/Opening (why should they listen?)
2. Problem (what's wrong with status quo?)
3. Solution (your idea)
4. Why you/Why now (credibility & timing)
5. Call to action

**Slide count guidance**: ~1 slide per 1-2 minutes (shorter, punchier slides)  
**Speaker notes**: Brief, punchy. Focus on delivery energy and key talking points.  
**Content style**: Bold statements, emotional appeals, clear value propositions

### Pattern 2: ACADEMIC ARGUMENT (Research/Theory)
**Duration**: 15-45 minutes  
**Goal**: Present evidence for a thesis or research finding

**Typical structure**:
1. Thesis/Research question (what are you claiming?)
2. Background/Context (what's known?)
3. Methodology (how did you learn this?)
4. Findings (what did you discover?)
5. Implications (why does it matter?)
6. Future work (what's next?)

**Slide count guidance**: ~1 slide per 2-3 minutes (more dense, content-heavy)  
**Speaker notes**: Detailed. Include citations, nuances, limitations.  
**Content style**: Evidence-based, structured, often with data/tables

### Pattern 3: STRUCTURED COLLECTION (Framework/How-To)
**Duration**: 20-45 minutes  
**Goal**: Present a framework, methodology, or collection of ideas

**Typical structure**:
1. Overview (what's the framework?)
2. Section per element (deep dive on each piece)
3. Connections (how do pieces relate?)
4. Application (how to use it?)

**Slide count guidance**: ~1 slide per 2-3 minutes per element  
**Speaker notes**: Moderate detail. Focus on relationships and applications.  
**Content style**: Lists, comparisons, hierarchies

### Pattern 4: NARRATIVE/STORY (Case Study, Journey)
**Duration**: 10-30 minutes  
**Goal**: Take audience on a journey (before → after, discovery, transformation)

**Typical structure**:
1. Setting (where do we start?)
2. Conflict (what went wrong? what question emerged?)
3. Exploration (what did we try? what did we learn?)
4. Resolution (what changed? what's different now?)
5. Reflection (what does this mean?)

**Slide count guidance**: ~1 slide per 1-2 minutes (visual pacing)  
**Speaker notes**: Narrative flow. Build tension and resolution.  
**Content style**: Vivid descriptions, images, quotes, turning points

---

## Part 2: Layout Decision Tree

Choose layouts based on content type and narrative function.

### SECTION DIVIDERS & STRUCTURE

**`title` layout**
- **Use for**: Opening slide with presentation title + presenter name
- **Content**: Single headline, optional subtitle
- **Notes**: Speaker introduces themselves, sets context
- **Example**: "Designing for Humans: An Introduction"

**`section` layout**
- **Use for**: Major topic shifts, new chapters
- **Content**: Section title (usually H1 or H2)
- **Notes**: Brief transition to next major section
- **Example**: "Part 2: The Research Findings"

**`cover` layout**
- **Use for**: Closing slide, end of presentation
- **Content**: Minimal text (title, maybe contact)
- **Notes**: Presenter invites questions, thanks audience

---

### SINGLE-COLUMN & TEXT-HEAVY

**`1-column` layout**
- **Use for**: Text-heavy explanations that need space to breathe
- **Content**: Bullet points, paragraphs, quotes, definitions
- **When NOT to force columns**: Dense explanatory text, complex definitions
- **Notes**: Full speaker notes explaining concepts in detail
- **Example**: Defining a complex term, explaining a methodology step

---

### VISUAL PROOF & IMAGES

**`caption` layout** (image + title bar + caption)
- **Use for**: One primary image + interpretive text
- **Content**: Full-width image (cinematic), title, small caption
- **Notes**: Image commentary, what this proves, real-world context
- **Image source**: Unsplash (search relevant keywords)
- **Example**: A team photo with caption "This research team discovered..."

**`full-image` layout**
- **Use for**: Pure visual impact, establishing mood, proof points
- **Content**: Edge-to-edge image, minimal or no text overlay
- **Notes**: Let the image speak. Brief context.
- **Image source**: Unsplash (high-quality, aesthetically consistent)
- **Example**: Cinematic nature scene when pivoting to "The Future"

**`half-image` layout** (vertical split)
- **Use for**: Side-by-side visual + text explanation
- **Content**: Image on one side, text on other
- **Notes**: Explain what the image demonstrates
- **Example**: Product mockup + feature list

**`half-image-horizontal` layout** (stacked)
- **Use for**: Top image, bottom text (or vice versa)
- **Content**: Image + explanation or quote
- **Notes**: How image supports narrative
- **Example**: Quote at top, relevant image below

---

### MULTI-COLUMN LAYOUTS

**`2-columns` layout** (equal width)
- **Use for**: 
  - **Comparison**: "Then vs Now", "Pro vs Con", "Approach A vs Approach B"
  - **Dual concepts**: "Problem" + "Solution"
  - **First take vs Second take** (reframe, evolution of thinking)
- **Content**: Two independent text blocks (bullets, paragraphs)
- **Notes**: Highlight the contrast or relationship
- **Example**: 
  ```
  LEFT: Traditional Approach | RIGHT: Our Approach
  LEFT: Common misconception | RIGHT: What we learned
  ```

**`2-columns-1+2`** (narrow left, wide right)
- **Use for**: "Intro + Main content" pattern
- **Content**: 
  - LEFT: Key concept, single idea, question, or small visual
  - RIGHT: Explanation, details, list, or evidence
- **Notes**: Connects the intro on left to detailed exploration on right
- **Example**:
  ```
  LEFT: "Three challenges" | RIGHT: [Challenge 1 description, Challenge 2 description, Challenge 3 description]
  LEFT: "Key insight" | RIGHT: [Evidence and implications]
  ```

**`2-columns-2+1`** (wide left, narrow right)
- **Use for**: "List + Interpretation" or "Content + Commentary"
- **Content**:
  - LEFT: Main content (list, bullet points, narrative)
  - RIGHT: Visual aid, summary point, or interpretation
- **Notes**: Right column guides interpretation of left column
- **Example**:
  ```
  LEFT: [5-point list] | RIGHT: "Which resonates most?"
  LEFT: [Timeline of events] | RIGHT: "The turning point"
  ```

**`3-columns` layout** (equal width)
- **Use for**: Three equally important concepts or options
- **Content**: Three independent sections (bullet lists or short text)
- **Notes**: Often a natural structure ("three challenges", "three approaches", "three outcomes")
- **Philosophy**: "Often good things are three!" — Natural balance and completeness
- **Example**:
  ```
  LEFT: Clarity | CENTER: Simplicity | RIGHT: Scale
  [bullets] | [bullets] | [bullets]
  ```

---

## Part 3: Content Formatting & Markdown

Use Markdown features to structure and emphasize content:

### Emphasis
- **Bold** (`**text**`) → Key terms, important conclusions
- **Italic** (`*text*`) → Quotes, references, alternative framings
- **Blockquotes** (`> quote`) → Testimonials, key statements, external voices

### Code & Technical
- **Code blocks** (triple backticks) → Technical content, code examples, structured data
- **Inline code** (backticks) → Function names, technical terms

### Structured Content
- **Bullet lists** → Options, steps, features
- **Numbered lists** → Sequential processes, ranked items
- **Tables** → Comparisons, data summaries (use sparingly)

### Speaker Notes
- Regular paragraphs between content become **speaker notes**
- Add timing guidance: `(Takes ~2 minutes to explain)`
- Include detailed context that audience doesn't need to read

---

## Part 4: Image Selection Strategy

Images should be aesthetically consistent and serve a narrative purpose.

### Unsplash Search Strategy

**For each image layout**:
1. Identify the **emotional tone** needed
2. Search Unsplash with relevant keywords
3. Apply **aesthetic filters**: 
   - Color palette consistency (warm/cool, saturated/muted)
   - Style (minimalist, documentary, abstract)
   - Composition (rule of thirds, negative space, depth)

### Examples by Presentation Style

**PITCH presentation**:
- Energetic, dynamic images
- Keywords: "team collaboration", "innovation", "growth", "launch"
- Color: Bright, warm, forward-moving

**ACADEMIC presentation**:
- Professional, authoritative images
- Keywords: "research", "laboratory", "data", "discovery"
- Color: Neutral, sophisticated, grounded

**STRUCTURED COLLECTION**:
- Clear, organized, hierarchical images
- Keywords: "framework", "process", "organization", "connected"
- Color: Consistent palette across multiple images

**NARRATIVE presentation**:
- Emotional, evocative, cinematic images
- Keywords: Related to the story (journey, transformation, conflict)
- Color: Mood-consistent; consider seasonal, geographic, or thematic palettes

### Aesthetic Consistency

**Within a presentation**: Use images from the same photographer or collection when possible. Cross-check:
- Similar saturation levels
- Complementary color temperature
- Consistent composition style

**Search tip**: On Unsplash, check the photographer's portfolio (click name) — use multiple images from the same creator for visual coherence.

---

## Part 5: Timing & Speaker Notes

Balance content density with presentation time.

### Timing Formula

```
Presentation Time = (Slides × Average Time Per Slide) + Transitions

Average Time Per Slide:
- Title/section: 10-20 seconds
- One-sentence slide: 20-30 seconds
- Text with list (3-5 items): 1-2 minutes
- Text with image: 1.5-2.5 minutes
- Dense academic slide: 2-4 minutes
- Full-image mood slide: 10-20 seconds
```

### Speaker Notes Guidelines

**Timing cues**:
```markdown
This is the slide content.

(2 minutes)
Detailed speaker notes go here. Explain what the audience should understand. 
Add nuance, stories, or evidence that doesn't appear on the slide.
```

**Narrative cues**:
```markdown
## The Turning Point

This is where everything changed.

Pause here. Let audience absorb the shift. Then explain: [detailed narrative]
```

**Emphasis cues**:
```markdown
**Key insight**: [brief slide text]

This is the moment to emphasize. [Speaker note with passion, energy, or weight]
```

---

## Part 6: Presentation Outline Template

When generating a presentation, structure the briefing analysis like this:

```
PRESENTATION PROFILE
- Pattern: [pitch / academic / structured / narrative]
- Duration: [X minutes]
- Audience: [who?]
- Goal: [what should they believe/do/understand?]

SLIDE BREAKDOWN
Slide 1: [title] — Layout: title | Time: 30s | Content: intro + topic
Slide 2: [topic heading] — Layout: section | Time: 15s | Content: transition
Slide 3: [concept] — Layout: 1-column | Time: 2m | Content: explanation
...

VISUAL STRATEGY
- Primary aesthetic: [mood, style, color palette]
- Image searches to try: [keywords]
- Unsplash photographers/collections: [recommendations]

PACING
- Total slides: [X]
- Average per slide: [X minutes]
- Dense sections: [which slides]
- Visual breaks: [which slides with images]
```

---

## Part 7: Quality Checklist

Before outputting the markdown file:

- [ ] **Pattern clarity**: Is the presentation structure clear and matches the pattern?
- [ ] **Layout appropriateness**: Is each layout choice justified by content?
- [ ] **Timing feasibility**: Can all content be presented in the allocated time?
- [ ] **Visual consistency**: Are suggested images aesthetically coherent?
- [ ] **Narrative flow**: Do slides progress logically with smooth transitions?
- [ ] **Speaker notes**: Do notes provide valuable context without cluttering?
- [ ] **Markdown formatting**: Is content properly formatted (bold, quotes, lists)?
- [ ] **Frontmatter**: Does it include theme, fonts, colors, header/footer as needed?
- [ ] **Image alt text**: If Unsplash images are suggested, are they referenced clearly?
