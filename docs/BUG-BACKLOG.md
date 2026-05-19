# Bug Backlog

Sammlung offener Bugs, die in einem Rutsch behoben werden sollen. Jeder Eintrag enthält genug Spur, um direkt einzusteigen — kein Re-Investigation nötig.

Status-Werte: `open` (noch zu fixen), `fixed` (behoben), `wontfix` (bewusst nicht).

---

## B1. `2-columns`-Layout rendert einspaltig, wenn Spalten-Headlines H2 statt H3 sind

**Status:** fixed (2026-05-19; mitgelöst durch B3+B5)
**Schwere:** mittel — Layout-Intent wird ignoriert, kein Crash. User bekommt falsches Visual ohne Hinweis.
**Reproduzieren:**
- Datei: `/Users/wrede/Documents/Obsidian Vaults/Perspecta-Dev/Perspecta Slides Demo/Skill Demo — Perspecta in 5 Minuten.md`, Slide #8.
- Markdown:
  ```
  layout: 2-columns

  ## Zwei Spalten ohne Aufwand

  ## Was Perspecta automatisch erkennt
      - …
      - …

  ## Was du steuern kannst
      - …
      - …
  ```
- Erwartung: zwei Spalten nebeneinander.
- Tatsächlich: alles untereinander wie `1-column`.

**Ursache (recherchiert):**
- `src/parser/SlideParser.ts`, `parseSlideIAPresenterMode`, Lookahead-Block ca. Z.724–746.
- `detectColumnBlocks` findet korrekt zwei Tab-Blöcke → `hasTabColumns = true`.
- Aber der `currentColumnIndex++`-Trigger feuert nur, wenn die **nächste nicht-leere Zeile nach einer Leerzeile tab-indentiert** ist. Eine dazwischenliegende `##`-Headline ist nicht tab-indentiert → Lookahead schlägt fehl → `currentColumnIndex` bleibt 0.
- Zusätzlich: Z.795–797 weist eine Headline der „aktuellen" Spalte zu — das ist hier 0, also Spalte 0 für beide Headlines.

**Fix-Skizze:**
- In der `isTrulyEmpty`-Branch (Z.724–746) den Lookahead erweitern: Wenn das nächste nicht-leere Element eine **Headline** ist *und* nach dieser Headline (ggf. weitere Leerzeilen) ein **Tab-Block** folgt, gilt das ebenfalls als Spaltenwechsel.
- Alternativ: jede Headline, die einem Tab-Block vorausgeht, *und* es gibt schon einen vorherigen Tab-Block in dieser Slide, zählt als Spaltenwechsel.
- Tests: Slide-Demo #8 muss zwei-spaltig rendern; bestehende H3-basierte Spalten-Slides dürfen sich nicht verändern.

**Workarounds für User bis zum Fix:**
- H3 statt H2 für Spalten-Headlines (entspricht der dokumentierten Konvention in `LAYOUT-BLUEPRINT.md` §5.4).
- Expliziten Spaltentrenner `--` auf eigener Zeile setzen.

**Doku-Folge-Arbeit (nach Fix):**
- Im Skill (`~/.claude/skills/perspecta-slides/SKILL.md`) klar markieren, dass H3 die Spalten-Headline-Konvention ist; H2 = Slide-Headline. Pattern-Bibliothek-Beispiele entsprechend prüfen.

---

## B2. Navigator-Thumbnails sind blau statt dunkel, wenn `mode: dark` in der Frontmatter steht

**Status:** fixed (2026-05-19; iframe body bekommt jetzt Mode-Klasse + mode-aware background in `renderSingleSlideHTML`/`getBaseStyles`)
**Schwere:** mittel — visuell offensichtlich falsch, betrifft jeden Dark-Mode-User des Navigators.
**Reproduzieren:**
- Datei: `/Users/wrede/Documents/Obsidian Vaults/Perspecta-Dev/Perspecta-vs-PowerPoint-Agentification.md`
- Frontmatter:
  ```yaml
  mode: dark
  ```
  Kein eigenes Theme → Plugin-Default-Theme.
- Erwartung: Navigator-Thumbnails (Sidebar links) zeigen dunkelgraue Slides — gleicher Background wie Preview/Presentation.
- Tatsächlich: Thumbnails sind **blau** im Navigator. Preview und Präsentationsmodus sind korrekt dunkelgrau.
- Light Mode ist unauffällig.

**Erste Spuren (nicht voll-recherchiert):**
- `src/ui/ThumbnailNavigator.ts` Z.91–92: setzt `renderer.setSystemColorScheme(getObsidianColorScheme())`. Das ist korrekt für `mode: system`, betrifft aber nicht den Fall, wo `mode: dark` explizit in Frontmatter steht — der sollte unabhängig vom System-Modus dunkel rendern.
- Wahrscheinliche Ursache-Kandidaten (zu verifizieren):
  1. Navigator-Renderer bekommt die Theme-CSS nicht (oder nur teilweise) ins iframe injiziert → CSS-Variablen für `--dark-background` greifen nicht → Browser-Default oder Obsidian-UI-Akzent (Blau) schlägt durch.
  2. `dark-background` aus dem Default-Theme wird im Navigator-Pfad nicht resolved (Drift-Issue ähnlich D5/D9, aber spezifisch für den Navigator-Pfad).
  3. Iframe-Background ist `transparent`, und dahinter liegt ein blauer Obsidian-UI-Container.
- Erste Forensik: in den DevTools die Navigator-Iframes inspizieren — `computed background-color` der Slide-Wurzel und `:root`-CSS-Variablen vergleichen mit dem Preview-Iframe.

**Fix-Skizze (vor Beginn nochmal verifizieren):**
- Den Navigator-Renderer-Pfad denselben Theme-CSS-Injection-Path geben wie Preview/Presentation.
- Vermutlich `generateDefaultCSS()`-Fallback (siehe D9 im Blueprint) im Navigator-Pfad nicht aktiv. Diesen Fallback aktivieren oder den Theme-Resolution-Code zwischen den drei Views in eine gemeinsame Funktion ziehen.
- Verifikations-Test: `capture-slide.mjs` für dieselbe Slide → Preview-iframe vergleichen → identische background-color erwarten.

**Verwandter Kontext:**
- `LAYOUT-BLUEPRINT.md` §8 hatte D5/D9 (Background-Fallback, generateDefaultCSS) bereits als gelöst markiert — wahrscheinlich nur für Preview/Presentation, nicht für Navigator.

---

---

## B3. Tab-Indent als Slide-Content-Marker abschaffen (Architektur-Bruch)

**Status:** fixed (2026-05-19; `parseSlideIAPresenterMode` delegiert jetzt an `parseSlideAdvancedMode` — kein Tab-Visibility-Marker mehr, nur noch `note:`/`notes:`)
**Schwere:** hoch — betrifft das Mental Model der gesamten Markdown-Konvention. Blockiert legitime Markdown-Einrückungen (verschachtelte Listen).
**Reproduzieren:**
- Datei mit `contentMode: perspecta`, Slide:
  ```
  ### Was Perspecta automatisch erkennt

  - Mehrere H3 nebeneinander
  - Tab-indentierte Blöcke
  ```
- Erwartung (neues Modell): Bullets sind slide-visible.
- Tatsächlich heute: Bullets sind nicht tab-indentiert → landen in Speaker-Notes → leere Slide.

**Hintergrund:**
- Tab-Indent war ein Erbe aus dem ehemaligen iA-Presenter-Modus. Damals hieß die Regel „Tab vorn = Slide-Content, alles andere = Notes".
- Diese Konvention kollidiert frontal mit normaler Markdown-Erwartung. Verschachtelte Listen (`    - subitem`) sind unschreibbar, weil der Tab vorne anders interpretiert wird.

**Neue Regel (entschieden):**
- **Alles ist standardmäßig slide-visible.**
- Speaker-Notes beginnen ausschließlich nach einem expliziten `note:`- oder `notes:`-Marker auf eigener Zeile.
- Tab-Einrückung hat *keine* semantische Bedeutung mehr für Slide-vs-Notes-Trennung. Tabs sind reine Markdown-Listen-Einrückung (Subitems).

**Migration:** Hard break. Keine Auto-Migration. Bestehende Decks ohne `notes:`-Marker zeigen ihre Notes künftig auf der Slide — User muss alle Decks einmalig umstellen.

**Fix-Skizze:**
- `src/parser/SlideParser.ts`, `parseSlideIAPresenterMode` (Z.666–ca.900):
  - Z.893–894: aktuelles `speakerNotes.push(line)` als Default für nicht-erkannte Paragraphen → ersetzen durch `slide-visible` (parsen als normales Paragraph-Element).
  - Z.806–818: spezielle Tab-Indent-Behandlung entfernen. Tab-Indent ist nur noch ein Markdown-Detail (Listen-Verschachtelung), keine Visibility-Entscheidung.
  - `inExplicitSpeakerNotes` (Z.690–710) bleibt unverändert — das ist der einzige Notes-Trigger.
- `parseSlideAdvancedMode` (Z.909 ff.) ist bereits so gestrickt → als Referenz dienen. Möglicherweise lassen sich die beiden Funktionen am Ende fusionieren.
- Funktion `parseSlideIAPresenterMode` umbenennen (oder den Doppelmodus ganz auflösen) — der Name suggeriert iA-Presenter-Verhalten, das wir gerade ausbauen.

**Files mit Tab-Indent-Logik (zu prüfen / anzupassen):**
- `src/parser/SlideParser.ts` — Z.666–900, sowie `detectColumnBlocks` (Z.1140) und `countImageColumns` (Z.1179) — siehe B5.
- `src/types.ts` — wenn `contentMode`-Enum-Werte geändert werden.
- `docs/PERSPECTA-SLIDES-SPEC.md`, `docs/LAYOUT-BLUEPRINT.md` §5.2, §5.4 — Doku auf neue Regel umstellen.
- `~/.claude/skills/perspecta-slides/SKILL.md` — alle Beispiele und die Mini-Vorlage zeigen heute Tab-indented Content; muss komplett umgeschrieben werden (siehe B4).
- Demo-Decks im Perspecta-Dev-Vault: `Skill Demo — Perspecta in 5 Minuten.md`, weitere `.md` in `Perspecta Slides Demo/`.

**Akzeptanztest:**
- Slide ohne `notes:`-Marker: Fließtext und Bullets erscheinen auf der Slide.
- Slide mit `notes:`-Marker: alles davor auf der Slide, alles danach in den Notes.
- Verschachtelte Liste mit Tab-Subitems rendert korrekt als hierarchische Liste.

---

## B4. Skill und Demo-Decks auf neue Content-Konvention umstellen (Folge von B3)

**Status:** fixed (2026-05-19; SKILL.md komplett modernisiert, Demo-Deck `Skill Demo — Perspecta in 5 Minuten.md` neu geschrieben)
**Schwere:** mittel — Skill und Demo-Decks sind heute Lehrmaterial für die alte, falsche Konvention. Solange das so bleibt, wird der Agent weiter falsche Decks generieren.
**Scope:**
- `~/.claude/skills/perspecta-slides/SKILL.md`:
  - Sektion „Content-Regeln (`contentMode: perspecta`, Default)" — komplett umschreiben.
  - Mini-Vorlage (Z.570 ff.) — alle Tab-Indents entfernen, dafür `notes:`-Block am Slide-Ende ergänzen wo nötig.
  - Pattern-Bibliothek P1–P12 — alle Markdown-Skelette anpassen.
  - Anti-Patterns-Sektion — alte „Speaker-Notes vergessen — Fließtext ist gratis"-Hinweise überdenken.
- Demo-Decks im Perspecta-Dev-Vault — siehe B3 file-Liste.
- `docs/LAYOUT-BLUEPRINT.md` §5.2 und §5.4 — die Tabellen „Element placement" und „Content modes" auf neuen Mechanismus aktualisieren.

**Akzeptanztest:**
- Skill-Beispiele rendern mit dem gefixten Parser visuell identisch zur Intention der Pattern.
- Demo-Deck Slide #8 (aus B1) ist zwei-spaltig OHNE Tab-Indent, OHNE `--`-Trenner.

---

## B5. Spalten-Detection von Tab-Blöcken auf H3 + Bild-Reihen umstellen (Folge von B3)

**Status:** fixed (2026-05-19; bereits in `autoDetectColumnsNew` mit `splitByH3Headings`/`splitByH2Headings`/`splitByExplicitDelimiter` implementiert — wurde nach B3 wirksam, weil nicht-indentierte Bullets jetzt sichtbar sind)
**Schwere:** mittel — direkter Folgeschritt nach B3. Sobald der Tab seine Visibility-Bedeutung verliert, muss auch die Spalten-Erkennung umgestellt werden, sonst funktionieren Spalten gar nicht mehr.
**Hintergrund:**
- Heute erkennt `detectColumnBlocks` (Z.1140) Spalten anhand parallel angeordneter **Tab-indentierter** Blöcke.
- Nach B3 hat der Tab keine semantische Bedeutung mehr → diese Detection läuft ins Leere.

**Neue Regel (entschieden):**
- **Auto-Spalten-Detection für 2 Mechanismen:**
  1. **Mehrere parallele H3-Blöcke** in einer Slide → Auto-Spalten. Jedes H3 startet eine neue Spalte. Funktioniert sowohl im `default`-Layout (Spaltenzahl wird inferiert) als auch in `2-columns`/`3-columns` (Spaltenzahl wird vom Layout erzwungen, H3s werden gleichmäßig verteilt).
  2. **Mehrere nicht-indentierte Bilder** auf eigenen Zeilen → Bild-Spaltenraster (heute schon vorhanden, bleibt erhalten).
- **Expliziter Spaltentrenner `--`** auf eigener Zeile bleibt als manueller Override bestehen.

**Fix-Skizze:**
- `src/parser/SlideParser.ts`:
  - `detectColumnBlocks` → durch `detectH3ColumnBlocks` ersetzen (oder erweitern). Triggert auf `### Headline` als Spaltenanfang, alles bis zum nächsten `### ` (oder Slide-Ende) gehört zur Spalte.
  - `countImageColumns` (Z.1179) bleibt unverändert — Image-Spalten-Logik ist orthogonal.
  - Z.795–797 in `parseSlideIAPresenterMode`: Logik „Headline der aktuellen Spalte zuweisen" muss neu denken: jetzt ist die H3 *selbst* der Spaltenanfang, nicht ein Vorläufer von Spalten-Content.
  - Lookahead in der Leerzeilen-Branch (Z.724–746, B1-Bug) wird durch die neue Regel obsolet — eine H3 ist eindeutig ein Spaltenwechsel-Signal, ohne dass wir Lookahead durch Leerzeilen brauchen.
- Damit löst B5 implizit B1 mit.

**Akzeptanztest:**
- Slide mit `layout: 2-columns` und zwei H3-Blöcken (ohne Tab, ohne `--`) rendert zwei-spaltig.
- Slide mit drei H3-Blöcken im `default`-Layout wird automatisch drei-spaltig.
- Slide mit `--`-Trennern bleibt unverändert funktional.
- Bild-Reihen-Spalten (mehrere `![[…]]` auf eigenen Zeilen) bleiben funktional.

**Konsequenz für B1:** B1 wird durch B5 mitgelöst und kann gemeinsam geschlossen werden. B1-Eintrag oben aber stehen lassen als Test-Case-Quelle.

**Empirische Beobachtung (2026-05-19, Demo-Deck-Fix):** Selbst mit H3-Headlines am Zeilenanfang *plus* Tab-indentierten Bullets darunter erkennt der aktuelle Parser keinen Spaltenwechsel. Der einzige zuverlässige Mechanismus heute ist der explizite `--`-Trenner. Slide #8 im Demo-Deck musste mit `--` korrigiert werden, weil keine implizite Konvention ein zwei-spaltiges Rendering erzwingen konnte. Das macht den B5-Fix dringlicher: ohne neue H3-Detection ist „Auto-Spalten" heute praktisch eine Lüge.

---

---

## B6. Slide-Splitter: Code-Fences ignoriert + Leerzeile um Trenner verlangt

**Status:** fixed (2026-05-19; `parseSlides` nutzt jetzt `splitIntoSlideRawContents()`, einen line-based Scanner, der Code-Fences (```` ``` ```` / `~~~`) trackt und Trennerzeilen nur außerhalb dieser Fences erkennt. Außerdem: keine Leerzeile mehr nötig vor/nach dem Trenner — Meta-Blöcke dürfen direkt nach `---` stehen)
**Ursprüngliche Schwere:** mittel — bricht jeden Code-Block mit `---`/`-----`-Zeilen; zwingt User zu unnatürlichen Leerzeilen vor Meta-Blöcken.
**Reproduzieren:**
- Slide mit folgendem Inhalt:
  ````
  ## Slides trennen

  ```
  ---     drei Striche → neuer Slide
  -----   fünf Striche → neuer Akt
  ```
  ````
- Erwartung: Code-Block wird intakt gerendert.
- Tatsächlich: das innere `---` wird als Slide-Trenner interpretiert → Slide wird in der Mitte des Code-Blocks zerlegt; erste Zeile geht verloren, zweite landet auf einer separaten Slide ohne Headline.

**Ursache:**
- Slide-Splitting in `SlideParser.ts` läuft *vor* der Block-Erkennung. Der Splitter sieht `---` am Zeilenanfang und teilt, ohne zu wissen, dass er gerade in einem Fenced-Code-Block ist.

**Fix-Skizze:**
- Beim Splitten Code-Fences (` ``` ` und ` ~~~ `) tracken. Lines zwischen einem offenen und seinem schließenden Fence dürfen keinen Slide-Bruch auslösen.
- Gleicher Schutz für `inlineCode` ist nicht nötig, da Inline-Code per Definition keine eigene Zeile bewohnt.

**Workaround:**
- Backticks um die Trenner-Beispiele setzen statt sie in Code-Block-Fences zu packen (so im aktualisierten Demo-Deck).

**Verwandtes:**
- B6 ist orthogonal zu B3/B5; kann jederzeit gefixt werden.

---

## Konventionen für diese Datei

- Bug-IDs sind aufsteigend (`B1`, `B2`, …), keine Lücken bei `wontfix`.
- Jeder Bug hat: Reproduktion, Ursache (wenn recherchiert), Fix-Skizze, optional User-Workaround.
- Beim Fix-PR: Eintrag auf `fixed` setzen und PR-Link / Commit-SHA dazuschreiben. Erst beim nächsten Major-Release archivieren.
