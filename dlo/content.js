const sources = {
  balance: 'https://www.observatoire-eau-guadeloupe.fr/services-publics-eau-assainissement/eau-potable/',
  report: 'https://www.observatoire-eau-guadeloupe.fr/content/uploads/2026/01/Chiffres_Cles_AEP-EU_2025_Rapport.pdf',
  audit: 'https://www.ccomptes.fr/sites/default/files/2025-07/RAN2025-0280.pdf',
  cuts: 'https://www.smgeag.fr/2026/09/04/planning-des-tours-deau-du-7-au-13-septembre-2026/',
  chlordecone: 'https://www.ameli.fr/assure/sante/themes/chlordecone/chlordecone-sante',
  sargassum: 'https://www.brgm.fr/fr/reference-projet-acheve/epandage-sargasses-guadeloupe-impact-environnemental-sites',
};
const link = (key, text) => '<a href="' + sources[key] + '" target="_blank" rel="noopener noreferrer">' + text + ' ↗</a>';
export const COPY = {
  fr: {
    place: 'GUADELOUPE', headline: 'L’eau perdue.', estimate: 'Estimation · données 2023',
    units: 'litres perdus ou non comptabilisés aujourd’hui.', perSecond: 'litres par seconde',
    details: 'Comprendre les chiffres', dayShare: 'de la journée écoulée', localTime: 'heure de Guadeloupe',
    fullBottle: 'Bouteille pleine =', drag: 'Faites glisser pour tourner.',
    reset: 'À minuit, le compteur repart. Les pertes continuent.',
    graphicsError: 'La vue 3D est indisponible sur cet appareil. L’estimation reste active.',
    pause: 'Pause', resume: 'Reprendre', pauseLabel: 'Mettre l’animation en pause', resumeLabel: 'Reprendre l’animation',
    sceneLabel: 'Faites glisser pour tourner la bouteille. Flèches du clavier pour l’incliner, R pour la recentrer.',
    sceneRole: 'bouteille 3D interactive', close: 'Fermer', navLabel: 'Langue et informations',
    counterLabel: 'Estimation des litres perdus ou non comptabilisés depuis minuit en Guadeloupe',
    title: 'dlo — L’eau perdue en Guadeloupe | Manu.Vision',
    description: 'En Guadeloupe, environ 122 millions de litres d’eau sont perdus ou non comptabilisés par jour. Une visualisation fondée sur le bilan public de 2023.',
    millionLitres: 'millions de litres',
    modal: `
<p class="intro">dlo, c’est l’eau en créole. En Guadeloupe, on peut consulter un calendrier pour savoir quand l’eau sera coupée. J’ai voulu partir de là.</p>
<section><h3>L’eau au quotidien</h3><p>Je suis originaire de la Caraïbe. Les « tours d’eau » organisent encore les coupures dans une partie de la Guadeloupe. Derrière un chiffre de pertes, il y a aussi cette question : quand pourra-t-on ouvrir le robinet ?</p>${link('cuts', 'SMGEAG · exemple de calendrier, 7–13 septembre 2026')}</section>
<section><h3>D’où vient ce chiffre ?</h3><p>Le bilan 2023 recense <strong>76,9 millions de m³ distribués</strong>, dont <strong>32,3 millions comptabilisés comme consommés</strong>. La différence : <strong>44,6 millions de m³</strong>, soit <strong>44,6 milliards de litres sur l’année</strong>, environ <strong>58 %</strong> du volume distribué.</p><p>Ce total concerne l’ensemble de la Guadeloupe. Réparti sur 365 jours, il représente <strong>environ 122,2 millions de litres par jour</strong>.</p>${link('report', 'Observatoire de l’eau · publication 2025, bilan 2023')}</section>
<section><h3>Tout ne s’échappe pas par une fuite</h3><p>Les pertes comprennent les fuites, mais aussi de l’eau consommée et mal comptée : compteurs défectueux, fichiers clients incomplets ou branchements non autorisés. Les fuites après le compteur des usagers sont exclues de ce bilan.</p>${link('balance', 'Observatoire de l’eau · distribution et pertes')}</section>
<section><h3>Des canalisations et une gestion à réparer</h3><p>La chambre régionale des comptes décrit un réseau trop peu renouvelé, des variations de pression qui fragilisent les canalisations et des défaillances de gestion. Les insuffisances d’entretien, de suivi et de renouvellement font partie du problème.</p><p>Les données utilisées ici ne permettent pas d’attribuer une quantité précise à la corrosion des tuyaux.</p>${link('audit', 'Chambre régionale des comptes · rapport 2025, p. 39 et 117')}</section>
<section><h3>Comment lire la bouteille</h3><p>Une bouteille pleine représente <strong>une journée moyenne de pertes et d’eau non comptabilisée</strong>. Elle se remplit au fil de l’heure locale : à midi en Guadeloupe, elle est à moitié pleine.</p><p>Le pourcentage près de la bouteille indique la part de la journée écoulée. <strong>Ce n’est pas le taux de perte de 58 %.</strong> À minuit en Guadeloupe (UTC−4), elle repart à zéro sans déborder. Ce redémarrage n’efface aucune perte.</p><p>Tourner la bouteille fait bouger l’eau, pas le total. La carte situe l’archipel ; elle ne montre ni l’emplacement des fuites ni un relief mesuré.</p></section>
<section><h3>Une moyenne historique, animée aujourd’hui</h3><div class="formula">44,6 milliards de litres ÷ 365 jours ÷ 86 400 secondes<br>× secondes écoulées depuis minuit en Guadeloupe</div><p><strong>Ce compteur n’est pas connecté à des capteurs.</strong> Il prolonge à rythme constant une moyenne de 2023. Il ne mesure pas les pertes réelles de 2026 et ne tient pas compte des coupures, réparations ou variations de pression du jour. Les chiffres de départ sont arrondis ; l’animation ne les rend pas plus précis.</p></section>
<details class="context-more"><summary>Et la qualité de l’eau, les sols, le littoral ?</summary><p>La chlordécone, utilisée dans les bananeraies de Guadeloupe et de Martinique jusqu’en 1993, contamine encore des sols et des milieux aquatiques. Les échouages de sargasses posent aussi un problème sur le littoral : leur décomposition libère des gaz nocifs.</p><p>Ces sujets comptent dans l’histoire de l’eau en Guadeloupe. Ils ne sont pas inclus dans le volume affiché, qui porte uniquement sur le bilan du réseau d’eau potable.</p>${link('chlordecone', 'Assurance Maladie · chlordécone')}${link('sargassum', 'BRGM · sargasses')}</details>
<p class="map-credit">Contours de Guadeloupe : Etalab / IGN. Extrusion illustrative. <a href="./map-attribution.txt" target="_blank" rel="noopener noreferrer">Source et licence de la carte ↗</a></p>
<p class="model-version">Données de référence : 2023 · Sources consultées le 9 septembre 2026</p>`,
  },
  en: {
    place: 'GUADELOUPE', headline: 'Water lost.', estimate: 'Estimate · 2023 data',
    units: 'litres lost or unaccounted for today.', perSecond: 'litres every second',
    details: 'Behind the numbers', dayShare: 'of the day elapsed', localTime: 'Guadeloupe time',
    fullBottle: 'Full bottle =', drag: 'Drag to turn.',
    reset: 'At midnight, the counter resets. The losses continue.',
    graphicsError: 'The 3D view is unavailable on this device. The estimate still works.',
    pause: 'Pause', resume: 'Resume', pauseLabel: 'Pause the animation', resumeLabel: 'Resume the animation',
    sceneLabel: 'Drag to rotate the bottle. Arrow keys tilt it. R resets it.',
    sceneRole: 'interactive 3D bottle', close: 'Close', navLabel: 'Language and information',
    counterLabel: 'Estimated litres lost or unaccounted for since midnight in Guadeloupe',
    title: 'dlo — Water lost in Guadeloupe | Manu.Vision',
    description: 'Water losses in Guadeloupe’s drinking-water network, made visible. An estimate through the day, based on public 2023 data.',
    millionLitres: 'million litres',
    modal: `
<p class="intro">dlo means water in Creole. In Guadeloupe, you can check a timetable to find out when the water will be cut off. I wanted to start there.</p>
<section><h3>Water in everyday life</h3><p>I’m from the Caribbean. Rotating water cuts, known as “tours d’eau,” still affect parts of Guadeloupe. Behind a water-loss figure is another question: when will the tap work?</p>${link('cuts', 'SMGEAG · example schedule, September 7–13, 2026')}</section>
<section><h3>Where does the number come from?</h3><p>The 2023 balance reports <strong>76.9 million m³ distributed</strong>, with <strong>32.3 million accounted as consumed</strong>. The difference is <strong>44.6 million m³</strong>, or <strong>44.6 billion litres that year</strong>: about <strong>58%</strong> of the distributed volume.</p><p>This covers all of Guadeloupe. Spread across 365 days, it amounts to <strong>about 122.2 million litres per day</strong>.</p>${link('report', 'Water Observatory · 2025 publication, 2023 balance')}</section>
<section><h3>It does not all escape through leaks</h3><p>Losses include leaks, as well as consumed water that is poorly accounted for: faulty meters, incomplete customer records or unauthorized connections. Leaks after customers’ meters are excluded from this balance.</p>${link('balance', 'Water Observatory · distribution and losses')}</section>
<section><h3>Pipes and management need repair</h3><p>The regional audit office describes insufficient pipe replacement, pressure changes that weaken pipes, and management failures. Shortfalls in maintenance, monitoring and network renewal are part of the problem.</p><p>The data used here cannot assign a specific volume to pipe corrosion.</p>${link('audit', 'Regional audit office · 2025 report, pp. 39 and 117')}</section>
<section><h3>How to read the bottle</h3><p>A full bottle represents <strong>one average day of losses and unaccounted-for water</strong>. It fills with local time: at noon in Guadeloupe, it is half full.</p><p>The percentage next to it shows how much of the day has passed. <strong>It is not the 58% loss rate.</strong> At midnight in Guadeloupe (UTC−4), it starts again without overflowing. That reset does not undo any losses.</p><p>Turning the bottle moves the water, not the total. The map locates the archipelago; it shows neither leak locations nor measured terrain.</p></section>
<section><h3>A historical average, animated today</h3><div class="formula">44.6 billion litres ÷ 365 days ÷ 86,400 seconds<br>× seconds since midnight in Guadeloupe</div><p><strong>This counter is not connected to sensors.</strong> It extends the 2023 average at a constant rate. It does not measure actual 2026 losses or account for today’s cuts, repairs or pressure changes. The source figures are rounded; animation does not make them more precise.</p></section>
<details class="context-more"><summary>What about water quality, soils and the coast?</summary><p>Chlordecone, used on banana plantations in Guadeloupe and Martinique until 1993, still contaminates soils and aquatic environments. Sargassum strandings also affect the coast: the seaweed releases harmful gases as it decomposes.</p><p>These issues belong in Guadeloupe’s water story. They are not included in the displayed volume, which covers only the drinking-water network balance.</p>${link('chlordecone', 'Assurance Maladie · chlordecone')}${link('sargassum', 'BRGM · sargassum')}</details>
<p class="map-credit">Guadeloupe outlines: Etalab / IGN. Illustrative extrusion. <a href="./map-attribution.txt" target="_blank" rel="noopener noreferrer">Map source and licence ↗</a></p>
<p class="model-version">Reference data: 2023 · Sources reviewed September 9, 2026</p>`,
  },
};
