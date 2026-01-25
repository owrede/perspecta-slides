# Perspecta Slides Author Skill — Creation Summary

## ✅ Skill Created Successfully

**Location**: `.agents/skills/perspecta-slides-author/`

**Files**:
- ✅ `SKILL.md` — Executable skill with workflow, layout decision tree, content guidelines
- ✅ `CONCEPT.md` — Deep-dive reference with 7 comprehensive sections
- ✅ `README.md` — Quick reference and file navigation
- ✅ `CREATION_SUMMARY.md` — This file

---

## What This Skill Does

Transforms **presentation briefings** into **publication-ready Perspecta Slides Markdown files**.

**Input**: 
- Presentation topic, goal, duration
- Key points, outline, or bullet structure  
- Dramaturgy notes (presentation style, tone, narrative flow)
- Optional: theme preference

**Output**:
- Complete Markdown file with YAML frontmatter
- Intelligently selected layouts for each slide
- Unsplash image search suggestions
- Detailed speaker notes with timing guidance
- Ready to open in Obsidian and present

---

## How It Works

### 1️⃣ **Analyze the Briefing**
Identifies presentation pattern:
- **PITCH** (5-20 min) — Convince of idea/product → energetic, fast-paced
- **ACADEMIC** (15-45 min) — Present research → detailed, evidence-based
- **STRUCTURED** (20-45 min) — Teach framework → organized, step-by-step
- **NARRATIVE** (10-30 min) — Tell a story → emotional journey, turning points

### 2️⃣ **Structure the Presentation**
- Calculates optimal slide count based on duration and pattern
- Maps presentation flow: opening → sections → closing
- Assigns layouts based on content type and narrative function

### 3️⃣ **Select Layouts Intelligently**
Decision tree for layout selection:
- **1-column** → Dense text explanations
- **2-columns** → Comparisons, pro/con, before/after
- **2-columns-1+2** → Intro concept + main content
- **2-columns-2+1** → List + interpretation or commentary
- **3-columns** → Three equally important ideas ("three's a charm!")
- **caption** → Image + contextual title
- **full-image** → Pure visual impact
- **half-image** / **half-image-horizontal** → Image + text side-by-side
- **title** / **section** / **cover** → Structural dividers

### 4️⃣ **Suggest Images**
For each image layout, provides:
- 3-5 Unsplash search keywords
- Aesthetic tone (bright/energetic, professional/grounded, minimalist, emotional)
- Photographer recommendations for visual consistency
- Thematic palette guidance

### 5️⃣ **Write Speaker Notes**
For each slide:
- Timing guidance (e.g., "1-2 minutes")
- Talking points and emphasis areas
- Nuance and context not on the slide
- Stories, anecdotes, transitions
- Cues for delivery (pause, build tension, emphasize)

### 6️⃣ **Apply Markdown Formatting**
Structures content with:
- **Bold** for key terms and conclusions
- **Italic** for quotes and references
- **Blockquotes** for testimonials and key statements
- **Lists** for options, steps, features
- **Code blocks** for technical content
- **Tables** for comparisons (used sparingly)

### 7️⃣ **Output Complete File**
Generates Markdown with:
- YAML frontmatter (title, author, theme, typography)
- Proper slide separators (`---`)
- Clear hierarchy and structure
- All content formatted and ready to present
- **Copy-paste ready** into Obsidian

---

## Reference Architecture

### CONCEPT.md — 7-Part Deep Dive

1. **Presentation Patterns** (Part 1)
   - PITCH pattern: Hook → Problem → Solution → Why You → CTA
   - ACADEMIC pattern: Thesis → Background → Methodology → Findings → Implications
   - STRUCTURED pattern: Overview → Elements → Connections → Application
   - NARRATIVE pattern: Setting → Conflict → Exploration → Resolution → Reflection

2. **Layout Decision Tree** (Part 2)
   - Detailed rules for each layout with examples
   - When to use each, what content fits, typical speaker notes
   - Visual vs. textual content guidance

3. **Content Formatting** (Part 3)
   - Markdown features and when to use them
   - Typography choices (bold, italic, blockquotes)
   - Code and tables

4. **Image Selection Strategy** (Part 4)
   - Unsplash search approach
   - Aesthetic consistency by presentation style
   - Photographer portfolio tips

5. **Timing & Speaker Notes** (Part 5)
   - Timing formulas for different slide types
   - How to write effective speaker notes
   - Narrative cues and emphasis markers

6. **Presentation Outline Template** (Part 6)
   - How to profile a presentation (pattern, duration, goal)
   - Slide breakdown format
   - Visual strategy planning
   - Pacing checklist

7. **Quality Checklist** (Part 7)
   - Pre-output verification
   - 10-point checklist before finalizing

### SKILL.md — Executable Workflow

- **Quick Start**: Input requirements
- **7-Step Workflow**: Analyze → Structure → Select Layouts → Suggest Images → Write Notes → Format → Output
- **Content Guidelines by Pattern**: Specific slide sequences and speaker notes for PITCH, ACADEMIC, STRUCTURED, NARRATIVE
- **Image Aesthetic Consistency**: By-style guidance
- **Checklist**: Before-output verification
- **Example**: Mini pitch presentation (12-minute app pitch with output)
- **Quick Reference**: Layouts, Markdown syntax, Perspecta Slides features

---

## Key Design Decisions Captured

### 1. **Presentation Patterns First**
Different presentations have fundamentally different structures. Identifying the pattern (PITCH vs. ACADEMIC vs. STRUCTURED vs. NARRATIVE) determines everything downstream: slide count, pacing, image strategy, even font choices.

### 2. **Layout as Content Type**
Layouts aren't decorative. Each layout serves a narrative function:
- `2-columns` = "Here are two concepts in dialogue"
- `2-columns-1+2` = "Here's a small idea; here's the big implication"
- `3-columns` = "These three things are equally important"

Choosing the right layout teaches the audience the relationship between ideas.

### 3. **Timing is Sacred**
Speaker pacing varies, but content density doesn't lie. Dense academic slides need 2-4 minutes. Pitch slides need 1-2 minutes. The skill calculates optimal slide count based on duration and pattern.

### 4. **Images Drive Consistency**
Visual cohesion (color palette, photography style, composition) signals professionalism and helps audiences follow the narrative. The skill provides aesthetic guidance by presentation type and photographer recommendations for multi-image consistency.

### 5. **Speaker Notes ≠ Slides**
Speaker notes are detailed, personal, and full of context. Slides are minimal, visual, and space-aware. The skill reinforces this separation.

### 6. **Frontmatter is Configuration**
YAML frontmatter centralizes presentation-wide settings (theme, fonts, header/footer, aspect ratio). Keeps slides clean and reusable.

---

## How to Use This Skill

### For Users
1. Load the skill when starting a new presentation
2. Provide briefing details
3. Skill asks clarifying questions if needed (presentation style, audience tone, specific layout preferences)
4. Skill outputs complete Markdown file
5. User optionally refines, then opens in Perspecta Slides

### For Developers
1. Reference `CONCEPT.md` for layout decision logic
2. Reference `SKILL.md` for workflow and content guidelines
3. Reference `README.md` for quick lookups

### For Customization
- Extend presentation patterns (add new pattern types)
- Add more layout combinations
- Customize Unsplash search term libraries by industry
- Integrate with Obsidian API for direct file creation

---

## Quality Assurance Checklist

The skill includes a **7-point checklist** (SKILL.md) and **10-point quality checklist** (CONCEPT.md Part 7):

✅ Pattern clarity  
✅ Slide count realistic  
✅ Layout logic sound  
✅ Image integration cohesive  
✅ Speaker notes complete with timing  
✅ Narrative flow logical  
✅ Markdown clean and structured  
✅ Frontmatter complete  
✅ Ready to present  

---

## Next Steps

1. **Try it**: Provide a presentation briefing and test the workflow
2. **Refine**: Adjust layout guidelines based on your presentation aesthetic
3. **Extend**: Add industry-specific language, image libraries, or layout patterns
4. **Document**: Keep a "lessons learned" log of what works well

---

## Files to Review

- 📄 **`SKILL.md`** — Start here for immediate use
- 📚 **`CONCEPT.md`** — Read for deep understanding of layout logic and patterns
- 🎯 **`README.md`** — Quick reference and navigation
- ✅ **`CREATION_SUMMARY.md`** — This file; overview of what was created

---

## Version

**Status**: ✅ Complete and ready  
**Version**: 1.0  
**Created**: January 2025  
**Based on**: Perspecta Slides v0.2.21

---

## About the Skill

This skill encapsulates **proven presentation design patterns** and **layout decision logic** from professional presentation design, adapted specifically for Perspecta Slides. It's designed to let creators focus on content while the skill handles structure and visual consistency.

The skill respects the Perspecta Slides philosophy: *"Rapid presentations once a theme is adjusted. Design decisions moved into theme, not into individual slides."*
