<script setup lang="ts">
// The live site's PDF page (linked from Assets): each version's Homebrewery PDF, text unchanged.
useSeoMeta({ title: 'PDF', description: 'Mass Effect 5e PDF' })

interface Version { name: string, changelog: string, link: string, sections?: string[] }
const versions: Version[] = [
  {
    name: 'v1.2.0',
    changelog: '1-2-0',
    link: 'https://drive.google.com/file/d/1sEDVw7OkUistQUSXcbX8BcLVah4gGnFK/view?usp=sharing',
    sections: [
      'License', 'Introduction', 'Chapter 1: Step-by-Step Characters', 'Chapter 2: Races', 'Angara', 'Asari',
      'Batarian', 'Drell', 'Elcor', 'Geth', 'Hanar', 'Human', 'Krogan', 'Prothean', 'Quarian', 'Salarian',
      'Turian', 'Volus', 'Vorcha', 'Chapter 3: Classes', 'Adept', 'Engineer', 'Infiltrator', 'Sentinel', 'Soldier',
      'Vanguard', 'Chapter 4: Personality & Background', 'Chapter 5: Equipment', 'Chapter 6: Customization Options',
      'Chapter 7: Using Ability Scores', 'Chapter 8: Missions', 'Chapter 9: Combat', 'Chapter 10: Vehicles',
      'Chapter 11: Vehicle List', 'Chapter 12: Spellcasting', 'Chapter 13: Spells', 'Appendix A: Armor Sets',
      'Appendix B: Armor Mods', 'Appendix C: Weapons', 'Appendix D: Weapon Mods', 'Appendix E: Grenades & Mines',
      'Appendix F: Omni-tool Programs', 'Appendix G: Conditions', 'Appendix H: Bestiary',
    ],
  },
  { name: 'v1.1.0', changelog: '1-1-0', link: 'https://drive.google.com/file/d/1DcIQhXi2QuP-EuLGXnkk1rPnPe8Y3xzg/view?usp=sharing' },
  { name: 'v1.0.0', changelog: '1-0-0', link: 'https://drive.google.com/file/d/1PBVKryayPyAUibJ0XiEi2WvGSQGLrP9D/view?usp=sharing' },
  { name: 'v0.9.2', changelog: '0-9-2', link: 'https://drive.google.com/file/d/1hR63JVeS21uYYAnrV8PCCbsHV_jvKm8Y/view?usp=sharing' },
  { name: 'v0.9.0', changelog: '0-9-0', link: 'https://drive.google.com/file/d/1H6ywGQ80GPqoIYh0cvHnqs5UdEV5QZib/view?usp=sharing' },
  { name: 'v0.8.4', changelog: '0-8-4', link: 'https://drive.google.com/file/d/1DutYdSFORN7-jLi2r9-bpCK763je-k9h/view?usp=sharing' },
]

// A section's raw Homebrewery markdown in queryluke/masseffect-5e-pdf ("Chapter 3: Classes" → chapter-3.md).
function rawLink(version: Version, section: string) {
  const dir = version.name.toLowerCase().replaceAll(/\W/g, '')
  const chapter = section.match(/^Chapter (\d+):/)
  const file = chapter ? `chapter-${chapter[1]}` : section.toLowerCase().replaceAll(':', '').replaceAll(' ', '-')
  return `https://raw.githubusercontent.com/queryluke/masseffect-5e-pdf/master/${dir}/${file}.md`
}
</script>

<template>
  <UPage>
    <RecordHeader title="Mass Effect 5e PDF" />
    <UPageBody class="plain-prose">
      <p>
        With the release of v1.2.0, I've put the entirety of the Player's Manual
        into <a href="https://homebrewery.naturalcrit.com" target="_blank">Homebrewery</a>. Below you'll find the links
        each version of the final combined PDF, starting from v0.8.4. This is intended for people
        who want to use a specific version of the game (i.e., if they felt a previous version was more to their liking).
      </p>
      <p>
        Starting from v1.2.0, you can even download specific sections of that version, allowing you to pick and choose
        the parts you want to play with and even make your own edits in Homebrewery.
      </p>
      <UCard variant="outline" class="my-6">
        <h3 class="!mt-0">
          Making your own edits
        </h3>
        <ol>
          <li>Click the dropdown on the Version you want (<em>Note: only available after v1.2.0</em>)</li>
          <li>Click the section you want to use. This will navigate you to a raw markdown file.</li>
          <li>Copy the contents of this page (CTRL/CMD + A, then CTRL/CMD + C)</li>
          <li>Next, open up a <a href="https://homebrewery.naturalcrit.com/new" target="_blank">new homebrewery editor</a></li>
          <li>Paste the contents of the page from step 3 (CTRL/CMD + P)</li>
          <li>Edit away! Homebrewery is based on <a href="https://www.markdownguide.org/" target="_blank">Markdown</a> with a lot of additional bells and whistles. The editing menu has plenty of examples.</li>
        </ol>
      </UCard>
      <h2>Versions</h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="v in versions" :key="v.name" variant="outline">
          <p class="font-display text-xl font-bold text-highlighted">
            {{ v.name }}
          </p>
          <div class="mt-2 flex gap-2">
            <UButton :href="v.link" target="_blank" variant="ghost" label="PDF" class="-ms-2.5" />
            <UButton :to="`/changelog/${v.changelog}`" variant="ghost" label="Changelog" />
          </div>
          <UCollapsible v-if="v.sections" class="mt-2">
            <UButton variant="link" color="neutral" trailing-icon="i-lucide-chevron-down" label="Sections" class="-ms-2.5" />
            <template #content>
              <ul class="!list-none !ps-0 text-sm">
                <li v-for="s in v.sections" :key="s">
                  <a :href="rawLink(v, s)" target="_blank">{{ s }}</a>
                </li>
              </ul>
            </template>
          </UCollapsible>
        </UCard>
      </div>
    </UPageBody>
  </UPage>
</template>
