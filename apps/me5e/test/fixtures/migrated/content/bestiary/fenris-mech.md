---
name: FENRIS Mech
image: https://vignette.wikia.nocookie.net/masseffect/images/3/32/ME2_FENRIS_Mech.png/revision/latest/scale-to-width-down/350?cb=20120419003938
type: synthetic
unit: mech
alignment: nn
profBonus: 2
ac: 14
hp:
  dieCount: 10
  dieType: 6
abilityScores:
  str: 12
  dex: 16
  con: 11
  int: 10
  wis: 14
  cha: 8
irv:
  conImm:
    - poisoned
  damImm:
    - poison
    - psychic
  vul:
    - lightning
savingThrows:
  - dex
senses:
  infrared-vision: 30
size: small
skills:
  - perception
speed:
  walk: 40
entries:
  features:
    - mod: int
      list:
        - id: shocking-grasp
          perDay: 3
      id: innate-powercasting
      name: Innate Powercasting
      text: "The fenris mech's innate powercasting ability is Intelligence (power save DC 10, +2 to hit with power attacks). It can innately cast the following powers:"
    - name: Aggressive
      text: As a bonus action, the fenris mech can move up to its speed toward a hostile creature that it can see.
      id: aggressive
    - name: Post-mortem Explosion
      text: If damage reduces the FENRIS mech to 3 or fewer hit points, it deactivates its primary systems and remains stationary. Any additional damage done to the mech while in this state causes it to explode. Any creature within a :distance{length="10" adj}-radius sphere must succeed on a DC 13 Constitution saving throw or take 7 (3d4) lightning damage.
      id: post-mortem-explosion
  actions:
    - attack: melee
      proficient: true
      range: 10
      mod: str
      damage:
        - dieCount: 2
          dieType: 6
          mod: true
          type: bludgeoning
      target: one
      id: pounce
      name: Pounce
      hit: " If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone"
    - attack: melee
      proficient: true
      range: 5
      mod: str
      damage:
        - dieCount: 2
          dieType: 8
          mod: true
          type: lightning
      target: one
      id: stun
      name: Stun
      hit: " If the target is a creature, it must succeed on a DC 13 Constitution saving throw or be stunned until the end of its next turn"
cr: "00500"
---
