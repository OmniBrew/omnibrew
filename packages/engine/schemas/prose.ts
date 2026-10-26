/**
 * MDC components that content may use in prose: markdown bodies and text
 * fields such as `shortDesc` or an advancement's `text`. The engine renders
 * each one (`app/components/content/<PascalName>.vue`), so content never needs
 * framework tags. The validator checks names, props and the ids they point at.
 *
 *   inline:  `within :distance{length="30"} of you`
 *   block:   `::source-reference{pages="39" source="basic"}` then a line with `::`
 */
export interface ProseProp {
  required?: boolean
  /** Allowed values. */
  values?: string[]
  /** Collection the value must be an id of. */
  ref?: string
  /** Enum the value must belong to. */
  enum?: string
}

export interface ProseComponent {
  kind: 'inline' | 'block'
  description: string
  props: Record<string, ProseProp>
  /** Rendered by a module the engine already uses (Nuxt UI / Nuxt Icon), not by an engine component. */
  external?: boolean
}

const metric = {
  'adj': {},
  'abbr': {},
  'num-only': {},
  /** Text shown instead of the unit; `{metric}` is replaced by the unit name. */
  'override': {},
} satisfies Record<string, ProseProp>

export const PROSE_COMPONENTS: Record<string, ProseComponent> = {
  'distance': {
    kind: 'inline',
    description: 'A distance stored in feet, shown in the reader\'s units (`large`: miles, `tiny`: inches)',
    props: { length: { required: true }, ...metric, 'large': {}, 'tiny': {}, 'text-if': { values: ['imperial', 'metric'] } },
  },
  'weight': {
    kind: 'inline',
    description: 'A weight stored in pounds, shown in the reader\'s units',
    props: { amount: { required: true }, ...metric },
  },
  'condition': {
    kind: 'inline',
    description: 'A condition name that links to its rules',
    props: { id: { required: true, ref: 'conditions' }, sub: {}, label: {} },
  },
  'change-badge': {
    kind: 'inline',
    description: 'Marks a heading as new or changed in this version',
    props: { type: { required: true, values: ['new', 'change'] } },
  },
  'icon': {
    kind: 'inline',
    description: 'An Iconify icon (`ic:baseline-filter-center-focus`)',
    props: { name: { required: true } },
    external: true,
  },
  'note': {
    kind: 'block',
    description: 'A callout set apart from the text: GM advice, examples, optional rules (rendered by `NoteBox`)',
    props: {},
  },
  'source-reference': {
    kind: 'block',
    description: 'Credits the source a text is adapted from (sources are listed in the app config)',
    props: { 'pages': {}, 'source': {}, ':additional': {} },
  },
  'edge-list': {
    kind: 'block',
    description: 'Lists every edge of one type with its description',
    props: { type: { required: true, enum: 'edgeTypes' } },
  },
  'figure': {
    kind: 'block',
    description: 'A framed image or other content, optionally narrower than the page',
    props: { 'max-width': {} },
  },
}
