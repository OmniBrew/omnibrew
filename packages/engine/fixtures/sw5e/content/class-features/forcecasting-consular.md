---
# SW5e sample: the consular's Forcecasting feature as a power-system mechanic.
# Casting ability follows the power's alignment; 6th+ level powers once each per long rest.
name: Forcecasting
klass: consular
level: 1
mechanics:
  - type: powercasting-points
    pool: points:force
    mod:
      byAlignment:
        light: wis
        dark: cha
        universal: [wis, cha]
    known: [9, 11, 13, 15, 17, 19, 21, 23, 25, 26, 28, 29, 31, 32, 34, 35, 37, 38, 39, 40]
    points: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80]
    maxPowerLevel: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9]
    multiclassConversion: 1
    limitedLevels: { from: 6, uses: 1, reset: long }
---
You learn force powers and cast them with force points.
