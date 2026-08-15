# Briscas

Baraja española: **oro, copa, espada y basto**. Números **1, 2, 3, 4, 5, 6, 7, 10, 11, 12**. No hay as, jack, ni 8 ni 9.

```bash
npm install
npm test
npm run dev
```

## Cartas

| Carta | Puntos | Fuerza |
| --- | --- | --- |
| 1 | 11 | la más alta |
| 3 | 10 | segunda |
| 12 | 4 | |
| 11 | 3 | |
| 10 | 2 | |
| 7, 6, 5, 4, 2 | 0 | 7 pega al 2 |

## La vida

Después de ganar una baza, clic en la carta de triunfo:

- Si es 1, 3, 12, 11 o 10, cámbiala por tu **7** de ese palo.
- Si es 7, 6, 5 o 4, cámbiala por tu **2** de ese palo.

El bot lo hace solo.
