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
