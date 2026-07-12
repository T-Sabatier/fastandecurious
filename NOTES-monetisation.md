# Notes monétisation — Fast & Curious

Réflexion stratégique sur les packs payants (à implémenter plus tard).

## Principe de base : pack = nouvelle(s) catégorie(s), jamais d'ajout au deck gratuit
- Un pack payant = **une (ou plusieurs) nouvelle(s) catégorie(s)** activable(s) via le toggle du salon.
- On **n'ajoute pas** de cartes aux catégories gratuites existantes (ça les déséquilibrerait dans le jeu mélangé).
- Colle déjà à l'archi : système de toggle par catégorie + flag `spicy: true` + `categoriesStore` qui gère add/remove dynamiquement.

## Pourquoi c'est le bon choix
1. **Mécanique** : une catégorie payante n'affecte pas les proportions des catégories gratuites.
2. **Commercial** : « Pack +18 » = valeur tangible et visible, vs « ajoute des cartes un peu partout » = flou.
3. **Légal / stores** : le contenu +18 DOIT être une catégorie isolable et désactivable (confirmation d'âge, verrouillage par défaut).

## Taille des catégories/packs
- **Catégorie gratuite** (deck de base, jeu mélangé) : **15-20 cartes** → équilibrage garanti.
- **Pack payant qui se mixe au deck** : **~18 cartes** pour rester équilibré avec les catégories cochées à côté.
- **Mode dédié joué en focus** (+18, Soirée) : peut monter à **60-100+** SANS problème d'équilibre, car joué seul (pas mélangé proportionnellement).

### Règle d'or de l'équilibrage
L'équilibre compte **par sélection de catégories cochées**, PAS sur le total du deck.
- Si chaque catégorie ≈ 15-20 cartes, **n'importe quelle combinaison choisie reste équilibrée**.
- Un deck total de 250 ou 800 cartes n'a aucun impact sur l'équilibre d'une partie donnée.
- Ce qu'il faut éviter : une catégorie à 50 cochée à côté de catégories à 15.

## Prix (micro-achat mobile)
| Prix | Effet |
|------|-------|
| **1,99 € / 2 €** | Sweet spot — achat impulsif, conversion max |
| 2,99 € | Passe encore, on perd des acheteurs |
| 3,99 €+ | Trop cher pour ~18 cartes, beaucoup renoncent |

- **2 € = prix qui maximise le nombre d'acheteurs.** Un pack à 2 € × 1000 acheteurs > un pack à 4 € × 300.

## Stratégie revenus
- **Beaucoup de petits packs à 2 €** (prix d'appel, tout le monde en prend au moins un).
- **« Tout débloquer / Premium »** à ~9,99 € (tous les packs actuels + futurs) → souvent la meilleure source de revenus (les fans prennent direct).
- **Bundles thématiques** (3 packs pour 5 €).

## Renouvellement du contenu (anti « panne d'idées »)
- **Approfondir les thèmes payants existants** plutôt qu'inventer une catégorie à chaque fois (modèle Cards Against Humanity : +18 vol.1, vol.2, vol.3…).
- **Packs saisonniers/événementiels** = renouvelable à l'infini car calés sur le calendrier : Noël 🎄, Été ☀️, St-Valentin ❤️, Coupe du monde ⚽…
- Génération des cartes à la demande (assistant IA) → le volume n'est pas le goulot d'étranglement.

## Rejouabilité vs couverture
- Partie courte (premier à 5 points) → on ne voit qu'une petite fraction du deck par partie. **C'est normal et voulu** : un gros pool = fraîcheur de soirée en soirée, pas « tout voir en une partie ».
- Option future si besoin de montrer plus de contenu : **mode « partie longue » (premier à 10)**. Garder le 5-points comme défaut (parfait pour l'apéro).
