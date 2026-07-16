# Sécurité Firebase — checklist de mise en service

Le code applique désormais : auth anonyme pour les joueurs, compte email/mot de
passe pour l'admin, règles de sécurité dans `database.rules.json`. Pour que tout
fonctionne, il faut activer ces éléments **dans la console Firebase** (5-10 min).

## 1. Activer l'authentification

Console Firebase → **Authentication** → onglet **Sign-in method** :

- [ ] Activer **Anonyme** (obligatoire : sans ça, plus personne ne peut jouer)
- [ ] Activer **E-mail/Mot de passe**

## 2. Créer le compte admin

Console → **Authentication** → onglet **Users** → **Add user** :

- [ ] Email : ton adresse — Mot de passe : long et unique (gestionnaire de mdp)
- [ ] Copier l'**UID** du compte créé (colonne « User UID »)

## 3. Déclarer l'admin dans la base

Console → **Realtime Database** → onglet **Données** :

- [ ] Créer à la racine un nœud :

```
admin/
  <UID copié à l'étape 2>: true
```

(Ce nœud n'est ni lisible ni modifiable par les clients — règles `admin`.)

## 4. Publier les règles de sécurité

Console → **Realtime Database** → onglet **Règles** :

- [ ] Coller le contenu de `database.rules.json` → **Publier**

Ou en CLI : `npx firebase-tools deploy --only database` (le projet contient
`firebase.json` qui pointe vers le fichier de règles).

## 5. Vérifier que tout marche

- [ ] Jouer une partie test (créer room, rejoindre, jouer) → doit marcher
- [ ] Aller sur `/admin`, se connecter avec le compte email → CRUD cartes OK
- [ ] Test négatif : dans la console → Règles → **Simulateur** : une écriture
      sur `cards/x` **sans** auth doit être **refusée**

## Ce que ces règles garantissent

| Chemin | Lecture | Écriture |
|---|---|---|
| `rooms/*` | joueurs connectés (anonymes inclus) | joueurs connectés, code room 4 chars valide |
| `cards`, `categories` | joueurs connectés | **admin uniquement** |
| `deletedDefaults`, `deletedCategories` | joueurs connectés | **admin uniquement** |
| `users/$uid` | le joueur lui-même | **personne côté client** (serveur uniquement) |
| `admin` | personne | personne (console uniquement) |
| tout le reste | refusé | refusé |

Conséquence : le seed automatique des cartes par défaut (au premier lancement
d'un lobby) ne peut plus être fait par un joueur — c'est voulu. Pour seeder une
base vide : se connecter sur `/admin` (le seed s'exécute à l'ouverture du
dashboard, avec les droits admin).

## Limites connues (assumées pour un jeu d'apéro)

- Un joueur connecté peut écrire dans **n'importe quelle room dont il connaît
  le code** (pas de notion de « membre » vérifiée serveur). Risque : trolling
  d'une partie si le code fuit. Acceptable à ce stade ; durcissable plus tard.
- L'auth anonyme n'empêche pas un script d'obtenir un jeton anonyme. La vraie
  parade est **App Check** (voir ci-dessous).

## Monétisation : attribution des packs (CRITIQUE avant le 1er pack payant)

Le nœud `users/$uid` est en **lecture seule côté client** (`.write: false`).
Le joueur consulte ses droits (`users/$uid/packs`) mais **ne peut pas se les
attribuer** — sinon n'importe qui débloquerait les packs payants gratuitement
en écrivant `packs/pack_coquin: true` depuis la console du navigateur.

L'écriture des packs doit donc se faire **côté serveur uniquement**, après
vérification du reçu d'achat :

- [ ] **Cloud Function / webhook RevenueCat** (Admin SDK, qui contourne les
      règles) qui, à réception d'un achat validé (Play Billing), écrit
      `users/$uid/packs/<packId>: true`.
- [ ] Tant que ce back-end n'existe pas, **aucun pack ne peut être débloqué**
      (c'est voulu : mieux vaut « pas encore de packs » que « packs gratuits
      pour tous »).
- [ ] Rappel : le *contenu* des cartes premium reste téléchargeable par tout
      client (`cards` lisible par tous). Le verrou est côté sélection, pas côté
      données. Acceptable pour des packs à ~2 € ; à revoir si on veut une vraie
      protection du contenu (livraison via fonction serveur).

## À faire plus tard (phase Android / avant gros trafic)

- [ ] **Firebase App Check** : reCAPTCHA v3 (web) + Play Integrity (Android via
      Capacitor). Bloque les clients qui ne sont pas l'app officielle.
      ⚠️ Ne PAS activer l'« enforcement » avant d'avoir enregistré les deux
      fournisseurs dans la console + intégré le SDK client, sinon TOUTES les
      requêtes sont rejetées et l'app casse.
- [ ] **Plan Blaze** + alertes budget : le plan gratuit est limité à
      **100 connexions simultanées** (~15-25 parties en même temps). À activer
      avant toute promo, sinon l'app cesse de répondre aux nouveaux joueurs.
- [ ] Exclure la route `/admin` du build natif Android (admin = web only).
- [ ] (Hygiène) Passer Firebase du SDK v10 à v11. Les 12 vulns `npm audit`
      viennent de `undici` via `firestore`/`functions`/`storage`, modules NON
      importés → tree-shakés hors du bundle, risque réel faible. À faire à froid
      (pas sur un build prêt à publier), avec re-test complet.

## Déploiement des règles après modification

Toute modif de `database.rules.json` doit être **publiée** pour prendre effet :

```
npx firebase-tools deploy --only database
```

(ou coller le contenu du fichier dans Console → Realtime Database → Règles →
Publier). Tant que ce n'est pas fait, les règles en vigueur restent les
anciennes.
