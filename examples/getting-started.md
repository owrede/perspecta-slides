---
title: Getting Started with Perspecta Slides
author: Perspecta
theme: zurich
headerLeft: Perspecta Slides
showSlideNumbers: true
aspectRatio: "16:9"
---

##### Fast and Focused
# Instant Slides

Getting Started with Perspecta Slides

Welcome to Perspecta Slides! This presentation will show you how to create beautiful slides using Markdown.

---

### Table of Contents

	1. Write
	2. Structure
	3. Design
	4. Present

Let's walk through each step to help you create your first presentation.

---

layout: title

## 1. Write

Start With a Script

The best presentations start with a story. Write your thoughts first, then turn them into slides.

---

### Tell Your Story

The heart of a great presentation is the message. Get the script right before anything else.

Think about what you want to achieve. Then write it down naturally, like you're explaining it to a friend.

---

### Speech vs. Slide Content

	- Regular text = Speaker notes (only you see it)
	- Headings = Visible on slide
	- Tab-indented content = Visible on slide

This paragraph is a speaker note. It won't appear on the slide, but you'll see it when presenting.

	> "Blockquotes with tabs appear on slide"

---

layout: title

## 2. Structure

Separating Slides

Slides are separated by horizontal rules. Just type three dashes on their own line.

---

### Chop Chop

	Type three dashes to split your story into slides:
	
	```
	---
	```

It's that simple. Each horizontal rule creates a new slide.

---

### Comments

Use `//` for comments that are hidden from everyone:

// This is a comment - you won't see this on any slide or in notes

	```markdown
	// Hidden comment
	```

Comments are useful for notes to yourself while writing.

---

layout: title

## 3. Design

Themes and Layouts

Perspecta Slides automatically picks layouts based on your content.

---

### Available Layouts

	- **default** - Standard content slide
	- **title** - Centered title slide  
	- **section** - Section divider
	- **v-split** - Text + image side by side
	- **caption** - Image with caption
	- **full-image** - Full-bleed image

You can override the layout by adding `layout: name` at the start of a slide.

---

layout: section

### Customize Your Theme

Select from built-in themes or create your own.

---

### Theme Configuration

Set your theme in the frontmatter:

	```yaml
	---
	title: My Presentation
	theme: zurich
	titleFont: Helvetica
	accent1: "#000000"
	accent2: "#43aa8b"
	---
	```

The Zurich theme gives you clean, minimal Swiss design.

---

layout: title

## 4. Present

Show Time

When you're ready, open the presentation view or export to HTML.

---

### Keyboard Shortcuts

	- **→** or **Space** - Next slide
	- **←** - Previous slide
	- **Home** - First slide
	- **End** - Last slide
	- **Escape** - Exit presentation

Use the command palette to start presenting or export your slides.

---

### Export Options

	- **HTML** - Standalone web page
	- **Present** - Open in new window
	- **Print** - PDF export via browser

Your presentations work on any device with a web browser.

---

layout: title

## Now Go Create

Start writing your story and let Perspecta Slides handle the design.

Happy presenting!
