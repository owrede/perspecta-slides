// ============================================================================
// Changelog Data - Single Source of Truth
// This file is used to generate both the settings UI changelog and CHANGELOG.md
// ============================================================================

export interface ChangelogEntry {
	version: string;
	date?: string;
	changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '0.1.5',
		date: '2026-01-03',
		changes: [
			'Improved: Presentation window now uses incremental updates - only redraws when displayed slide changes',
			'Improved: Editing a slide no longer causes presentation window to jump back to first slide',
			'Improved: Much smoother live updates while presenting - no flicker for unrelated edits',
			'Changed: Presentation window uses drag overlay for cleaner interaction',
			'New: Click+drag anywhere moves the window (default mode)',
			'New: Double-click enters text selection mode, Escape exits it',
			'New: Obsidian wiki-link image syntax (![[image.png]]) now supported',
			'New: Full-image layout fills entire slide with object-fit: cover (no letterboxing)',
			'New: Image metadata system (size, x, y positioning) for future enhancements',
			'Fix: Wiki-link images now resolve correctly using Obsidian vault paths',
			'Technical: Presentation window uses content hashing to detect changes',
		],
	},
	{
		version: '0.1.4',
		date: '2026-01-03',
		changes: [
			'New: Frameless presentation window - clean, distraction-free presenting',
			'New: macOS traffic light buttons appear on hover and auto-hide after 3 seconds',
			'New: Window draggable by clicking any non-interactive area',
			'New: Double-click thumbnail in navigator to start presentation at that slide',
			'New: Click navigation in presentation (left third = back, right third = forward)',
			'Improved: ESC key behavior - exits fullscreen first, then closes window',
			'Improved: Keyboard navigation (arrows, space, PageUp/PageDown, Home/End)',
			'Improved: Presentation window opens at optimal 16:9 size for screen',
			'Fix: Keyboard events now work reliably in presentation window',
		],
	},
	{
		version: '0.1.3',
		date: '2026-01-02',
		changes: [
			'New: Basel theme - Swiss serif typography with Noto Serif font',
			'New: Copenhagen theme - Nordic elegance with Albert Sans font',
			'New: Added 2 additional iA Presenter theme translations',
			'Fix: Fixed Berlin theme heading colors for light/dark mode',
			'Fix: Fixed Tokyo theme dark mode color contrast',
			'Fix: Fixed Zurich theme light/dark mode color definitions',
			'Improved: All built-in themes now have proper light/dark mode support',
			'Themes: Now includes 7 built-in themes',
		],
	},
	{
		version: '0.1.2',
		date: '2026-01-02',
		changes: [
			'Major Fix: Unified rendering pipeline for thumbnails and preview',
			'Major Fix: Fixed theme application inconsistencies',
			'Major Fix: Implemented proper font scaling with --slide-unit CSS variable',
			'New: Context-aware theme CSS generation',
			'New: Dynamic font scaling that adapts to container size',
			'Fix: Preview navigation now correctly updates current slide',
			'Fix: Speaker notes hidden from thumbnails and preview',
			'Improved: Thumbnail text scaling matches preview proportions',
		],
	},
	{
		version: '0.1.1',
		date: '2026-01-02',
		changes: [
			'New: Tabbed settings interface with organized sections',
			'New: Changelog tab in settings showing version history',
			'New: GitHub Actions workflow for automated releases',
			'Fix: Present/Presenter View buttons now use temp file approach for reliable browser launch',
			'Fix: Thumbnail iframes no longer cause console warnings',
			'Improved: Thumbnail Navigator redesigned with integrated SVG circle number badge',
			'Improved: Dynamic font sizing using --slide-unit CSS variable for responsive scaling',
			'Improved: PresentationView now uses iA Presenter container class pattern',
		],
	},
	{
		version: '0.1.0',
		date: '2026-01-01',
		changes: [
			'Initial release',
			'iA Presenter-compatible markdown parsing with tab-indented content',
			'Advanced Slides compatibility mode (note: marker)',
			'Thumbnail Navigator with drag-to-reorder slides',
			'Inspector Panel for slide and presentation settings',
			'Live preview within Obsidian',
			'HTML export with standalone presentations',
			'Present mode with fullscreen browser presentation',
			'Presenter View with speaker notes',
			'Built-in themes: Zurich, Tokyo, Berlin, Minimal',
			'Custom theme support from vault folder',
			'Multiple layout types: cover, title, section, columns, image layouts',
			'Keyboard navigation in presentation view',
		],
	},
];

/**
 * Render the changelog into an HTML container element (for Obsidian settings)
 */
export function renderChangelogToContainer(containerEl: HTMLElement): void {
	containerEl.createEl('h2', { text: 'Changelog' });

	for (const entry of CHANGELOG) {
		const versionDiv = containerEl.createDiv({ cls: 'perspecta-slides-changelog-version' });
		const dateStr = entry.date ? ` — ${entry.date}` : '';
		versionDiv.createEl('h3', { text: `v${entry.version}${dateStr}` });

		const list = versionDiv.createEl('ul');
		for (const change of entry.changes) {
			list.createEl('li', { text: change });
		}
	}
}

/**
 * Generate markdown changelog content (for CHANGELOG.md)
 */
export function generateChangelogMarkdown(): string {
	const lines: string[] = [
		'# Changelog',
		'',
		'All notable changes to Perspecta Slides will be documented in this file.',
		'',
	];

	for (const entry of CHANGELOG) {
		lines.push(`## [${entry.version}]${entry.date ? ` - ${entry.date}` : ''}`);
		lines.push('');
		for (const change of entry.changes) {
			lines.push(`- ${change}`);
		}
		lines.push('');
	}

	return lines.join('\n');
}
