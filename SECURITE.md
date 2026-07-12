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

## À faire plus tard (phase Android / avant gros trafic)

- [ ] **Firebase App Check** : reCAPTCHA v3 (web) + Play Integrity (Android via
      Capacitor). Bloque les clients qui ne sont pas l'app officielle.
- [ ] **Plan Blaze** + alertes budget : le plan gratuit est limité à
      **100 connexions simultanées** (~15-25 parties en même temps).
- [ ] Exclure la route `/admin` du build natif Android (admin = web only).
