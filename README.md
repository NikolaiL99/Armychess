# Armychess

Armychess ist Schach auf einem **16×16**-Brett. Weiß beginnt, die Könige stehen zu Beginn nicht auf dem Feld und müssen platziert werden. Gewonnen hat, wer den gegnerischen König **schlägt** — nicht, wer matt setzt.

## Regeln

- Grundreihe: 3 Türme, Springer, 3 Läufer, Dame, leeres Königsfeld, 3 Läufer, Springer, 3 Türme
- Vorletzte Reihe: 7 Springer, 2 Läufer, 7 Springer
- Danach zwei volle Bauernreihen
- Der König darf irgendwohin gesetzt werden. Steht dort eine Figur, kommt diese auf das ursprüngliche Königsfeld (i1 bzw. i16)
- Bauern dürfen beim ersten Zug zwei Felder ziehen, inklusive En passant
- Ziehen ist auch erlaubt, wenn der eigene König angegriffen ist
- Uhren: freie Startzeit plus optionaler Bonus pro Zug
- Herausforderungslinks für Partien zu zweit

## Online

Die Website läuft unter [https://armychess.onrender.com](https://armychess.onrender.com).

## Starten

```bash
npm install
npm test
npm run dev
```

Die Oberfläche läuft unter [http://localhost:5173](http://localhost:5173), der Multiplayer-Server unter Port 3001.

Produktion:

```bash
npm run build
npm start
```

Danach ist die App unter [http://localhost:3001](http://localhost:3001) erreichbar. Herausforderungslinks funktionieren im lokalen Netz über die IP des Rechners, im Internet nach dem Deploy (z. B. Render, Railway, Fly.io).
