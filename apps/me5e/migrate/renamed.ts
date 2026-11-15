/** Record ids renamed since the live data (collection → old → new). */
export const RENAMED_IDS: Record<string, Record<string, string>> = {
  vehicles: { 'destiny-acension': 'destiny-ascension' },
  // An earlier spelling of the turian trait, still picked by saved characters (plan/18, prod sample).
  traits: { 'thilium-skin': 'thulium-skin' },
}
